import { cons, List, uncons } from '../datastructures/conslist.js';
import { Data, DataMap, DataSet } from '../datastructures/data.js';
import { Database } from '../datastructures/database.js';
import {
  Conflict,
  createSearchState,
  empty,
  learnImmediateConsequences,
  SearchState,
} from './forwardengine.js';
import { Program } from './program.js';

export type ChoiceTree = ChoiceTreeLeaf | ChoiceTreeNode;
export type ChoiceZipper = List<[ChoiceTreeNode, ChoiceIndex]>;

interface ChoiceTreeLeaf {
  type: 'leaf';
  state: SearchState; // state.agenda !== null
}

/** A valid ChoiceTreeNode must have at least one LazyChoiceTree child */
interface ChoiceTreeNode {
  type: 'choice';
  state: SearchState; // state.agenda === null
  attribute: [string, Data[]];
  justChild: DataMap<LazyChoiceTree>;
  noneOfChild: null | LazyChoiceTree;
}

/** A lazy choice tree might not have had its child state created yet */
type LazyChoiceTree = { ref: ChoiceTree | null };
type ForcedChoiceTree = { ref: ChoiceTree };
type ChoiceIndex = { type: 'just'; just: Data } | { type: 'noneOf' };

export function followChoice(parent: ChoiceTreeNode, choice: ChoiceIndex): LazyChoiceTree {
  switch (choice.type) {
    case 'just':
      return parent.justChild.get(choice.just)!;
    case 'noneOf':
      return parent.noneOfChild!;
  }
}

function forceChoice(parent: ChoiceTreeNode, choice: ChoiceIndex): ForcedChoiceTree {
  const child = followChoice(parent, choice);
  if (child.ref !== null) return child as ForcedChoiceTree;

  const state = { ...parent.state };
  const [name, args] = parent.attribute;

  switch (choice.type) {
    case 'just': {
      // Collapse the frontier down to a single value and add the attribute to the agenda
      const values = DataSet.singleton(choice.just);
      const [frontier] = state.frontier.set(name, args, { values, open: false });
      const [deferred] = state.deferred.remove(name, args)!;
      state.frontier = frontier;
      state.deferred = deferred;
      state.agenda = cons(null, { type: 'fact', name, args });
      break;
    }
    case 'noneOf': {
      // Get existing noneOf constraint, extend it with the choices not taken at the frontier
      const alreadyExplored = state.explored.get(name, args) ?? { type: 'noneOf', noneOf: empty };
      if (alreadyExplored.type !== 'noneOf') throw new Error('forceNoneOf invariant');
      let noneOf: DataSet = alreadyExplored.noneOf;

      const [frontier, removed] = state.frontier.remove(name, args)!;
      if (!removed.open) throw new Error('forceChoice invariant');
      for (const choice of removed.values) {
        noneOf = noneOf.add(choice);
      }
      const [explored] = state.explored.set(name, args, { type: 'noneOf', noneOf });
      const [deferred] = state.deferred.remove(name, args)!;
      state.frontier = frontier;
      state.deferred = deferred;
      state.explored = explored;
    }
  }

  child.ref = { type: 'leaf', state };
  return child as ForcedChoiceTree;
}

enum StepResult {
  SOLUTION = 0,
  DEFERRED = 2,
  STEPPED = 3,
}

/** When a node has been fully explored, this function will remove it from the tree. */
function collapseTreeUp(pathToCollapseUp: ChoiceZipper): [ChoiceZipper, ChoiceTree | null] {
  if (pathToCollapseUp === null) return [null, null];
  const [path, [tree, fullyExploredChoiceToCollapse]] = uncons(pathToCollapseUp);

  // Remove the fully explored choice from the choiceNode
  switch (fullyExploredChoiceToCollapse.type) {
    case 'just': {
      const [justChild] = tree.justChild.remove(fullyExploredChoiceToCollapse.just)!;
      tree.justChild = justChild;
      break;
    }
    case 'noneOf': {
      tree.noneOfChild = null;
      break;
    }
  }

  // Ensure that we're returning a tree that has more than one child
  const noneOfSize = tree.noneOfChild === null ? 0 : 1;
  if (tree.justChild.size + noneOfSize > 1) {
    return [path, tree];
  } else {
    let choiceIndex: ChoiceIndex;
    if (tree.noneOfChild !== null) {
      choiceIndex = { type: 'noneOf' };
    } else {
      const [just] = tree.justChild.getSingleton()!;
      choiceIndex = { type: 'just', just };
    }

    const replacementTree = forceChoice(tree, choiceIndex).ref;
    if (path !== null) {
      // We need to fix the parent's pointer to point to our replacement tree
      const [parent, choiceIndexToChild] = path.data;
      followChoice(parent, choiceIndexToChild).ref = replacementTree;
    }
    return [path, replacementTree];
  }
}

function stepState(prog: Program, state: SearchState): StepResult | Conflict {
  if (state.agenda === null) {
    if (state.deferred.size > 0) {
      return StepResult.DEFERRED;
    } else if (state.demands.size > 1) {
      return { type: 'demand', name: state.demands.example()!.name };
    } else {
      return StepResult.SOLUTION;
    }
  } else {
    const [agenda, attribute] = uncons(state.agenda);
    state.agenda = agenda;
    const conflict = learnImmediateConsequences(prog, state, attribute);
    const demandFailure =
      state.agenda === null && state.deferred.size === 0 && state.demands.size > 0;
    return (
      conflict ??
      (demandFailure ? { type: 'demand', name: state.demands.example()!.name } : StepResult.STEPPED)
    );
  }
}

function stepLeaf(
  prog: Program,
  path: ChoiceZipper,
  tree: ChoiceTreeLeaf,
): [ChoiceZipper, null | ChoiceTree, Database | null] {
  switch (stepState(prog, tree.state)) {
    case StepResult.STEPPED: {
      return [path, tree, null];
    }
    case StepResult.SOLUTION: {
      const solution = tree.state.explored;
      return [...collapseTreeUp(path), solution];
    }
    case StepResult.DEFERRED: {
      const { name, args } = tree.state.deferred.choose()!;
      const { values: choices, open } = tree.state.frontier.get(name, args)!;
      const noneOfChild: null | LazyChoiceTree = open ? { ref: null } : null;
      let justChild: DataMap<LazyChoiceTree> = DataMap.empty();
      for (const choice of choices) {
        justChild = justChild.set(choice, { ref: null });
      }
      const replacementTree: ChoiceTreeNode = {
        type: 'choice',
        state: tree.state,
        attribute: [name, args],
        justChild,
        noneOfChild,
      };
      if (path !== null) {
        followChoice(path.data[0], path.data[1]).ref = replacementTree;
      }
      return [path, replacementTree, null];
    }
    default: {
      // Conflict, UNSAT
      return [...collapseTreeUp(path), null];
    }
  }
}

function ascendToRoot(path: ChoiceZipper, tree: ChoiceTree | null): ChoiceTree | null {
  while (path !== null) {
    tree = path.data[0];
    path = path.next;
  }
  return tree;
}

function descendToLeaf(path: ChoiceZipper, tree: ChoiceTree): [ChoiceZipper, ChoiceTreeLeaf] {
  while (tree.type !== 'leaf') {
    const [just] = tree.justChild.choose()!;
    const choice: ChoiceIndex = { type: 'just', just };
    const child = forceChoice(tree, choice);
    path = cons(path, [tree, choice]);
    tree = child.ref;
  }
  return [path, tree];
}

export function step(
  prog: Program,
  path: ChoiceZipper,
  tree: ChoiceTree,
): [ChoiceZipper, ChoiceTree | null, Database | null] {
  let leaf: ChoiceTreeLeaf;
  [path, leaf] = descendToLeaf(path, tree);
  return stepLeaf(prog, path, leaf);
}

export function* execute(prog: Program) {
  let tree: null | ChoiceTree = { type: 'leaf', state: createSearchState(prog) };
  let path: ChoiceZipper = null;
  let solution: Database | null;

  while (tree !== null) {
    [path, tree, solution] = step(prog, path, tree);
    if (solution) {
      yield solution;
      tree = ascendToRoot(path, tree);
      path = null;
    }
  }
}
