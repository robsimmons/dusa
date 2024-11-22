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

/**
 * Executing a finite choice logic program is the process of gradually
 * expanding out and exploring a tree of possible choices. We modify the
 * choice tree as we go in order to ensure that any fully-explored parts of
 * the tree are removed.
 *
 * We keep track not only of an imperatively updated tree but also a
 * particular location within that tree, in the form of a relatively standard
 * zipper data structure. The search state therefore consists of both a
 * subtree representing the subtree that we're currently focused on and a
 * zipper that contains the stack of parent trees up to the root.
 *
 * Zippers for imperatively-modified trees can get a little bit hairy! But it
 * seems to work okay, and is certainly preferable to trying to keep track of
 * parent pointers.
 */
export type ChoiceTree = ChoiceTreeLeaf | ChoiceTreeNode;
export type ChoiceZipper = List<[ChoiceTreeNode, ChoiceIndex]>;

export interface ChoiceTreeLeaf {
  type: 'leaf';
  state: SearchState; // state.agenda !== null
}

/** A valid ChoiceTreeNode must have at least *TWO* LazyChoiceTree children */
export interface ChoiceTreeNode {
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
      // Collapse the frontier for an attribute down to a single value
      const values = DataSet.singleton(choice.just);
      const [frontier] = state.frontier.set(name, args, { values, open: false });
      state.frontier = frontier;

      // Move that attribute from the deferred agenda to the active agenda
      const [deferred] = state.deferred.remove(name, args)!;
      state.deferred = deferred;
      state.agenda = cons(null, { type: 'fact', name, args });
      break;
    }
    case 'noneOf': {
      // Get existing noneOf constraint
      const alreadyExplored = state.explored.get(name, args) ?? { type: 'noneOf', noneOf: empty };
      if (alreadyExplored.type !== 'noneOf') throw new Error('forceNoneOf invariant');
      let noneOf: DataSet = alreadyExplored.noneOf;

      // Extend existing noneOf with the choices not taken at the frontier
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

export enum StepResult {
  IS_MODEL = 0,
  DEFERRED = 2,
  STEPPED = 3,
}

/**
 * A zipper always points to a particular subtree. This function deletes that
 * pointed-to tree from the tree.
 *
 * This may mean that the deleted tree's parent now only has one child. In
 * that case, the parent is also deleted and replaced with its singleton
 * child, the node that was previously the now-deleted subtree's sibling.
 */
export function collapseTreeUp(pathToCollapseUp: ChoiceZipper): [ChoiceZipper, ChoiceTree | null] {
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
      // XXX COVERAGE: currently we never explore a noneOfChild first, leaving
      // these lines uncovered. But this is a change we eventually want to
      // make to the engine, to stop deterministically preferring the positive
      // branches always, so it's good to leave these lines untested for now.
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

export interface Stats {
  deductions: number;
  rejected: number;
  choices: number;
  models: number;
}

export function stepState(prog: Program, state: SearchState): StepResult | Conflict {
  if (state.agenda === null) {
    if (state.deferred.size > 0) {
      return StepResult.DEFERRED;
    } else if (state.demands.size > 0) {
      return { type: 'demand', name: state.demands.example()!.name };
    } else {
      return StepResult.IS_MODEL;
    }
  } else {
    const [agenda, attribute] = uncons(state.agenda);
    state.agenda = agenda;
    return learnImmediateConsequences(prog, state, attribute) ?? StepResult.STEPPED;
  }
}

export function ascendToRoot(path: ChoiceZipper, tree: ChoiceTree): ChoiceTree | null {
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

/**
 * Advances the state of the choice tree imperatively.
 *
 *  - Either the path must be non-empty or the tree must be non-null.
 *
 *  - If the tree is not a leaf, pick a random child (creating new leaf nodes
 *    for unexplored children as needed) and descend to the child repeatedly
 *    until a leaf is reached.
 *
 *  - If the tree is a leaf, and the leaf has a non-empty agenda, imperatively
 *    update the leaf with the forward engine. If a conflict is discovered,
 *    signal that the subtree should be discarded by returning `null` for the
 *    tree.
 *
 *  - If the tree is a non-empty leaf with an empty agenda:
 *    - If there are deferred choices, select a random attribute and turn the
 *      leaf into a choice node branching on that attribute.
 *    - If there are no deferred choices and there are unsatisfied `require`
 *      constraints, return `null` for the tree.
 *    - Otherwise, we have a model. Return `null` for the tree and return the
 *      leaf's database as a model. (Note: this model may contain non-positive
 *      constraints! You can check the number of non-positive mappings in a
 *      model by querying `model.size.neg`.)
 *
 *  - If the tree is null, that means that in the last step we discarded a
 *    leaf (possibly returning its contents as a model), but if the path isn't
 *    empty, the top of the path is a parent node that still contains that
 *    leaf! The step will take the following steps:
 *    1. Ascend in the tree to the parent.
 *    2. Delete the former leaf from the parent
 *    3. Check whether the parent now has only one child. If so, the parent
 *       is no longer needed, and we can replace it with its (now unique)
 *       child, a sibling of the deleted node, which may be a choice node or a
 *       leaf node.
 */
export function step(
  prog: Program,
  path: ChoiceZipper,
  tree: ChoiceTree | null,
  stats?: Stats,
): [ChoiceZipper, ChoiceTree | null, Database | null] {
  if (path === null && tree === null) throw new Error('step precondition failed');

  if (tree === null) {
    return [...collapseTreeUp(path), null];
  }

  if (tree.type === 'choice') {
    return [...descendToLeaf(path, tree), null];
  }

  switch (stepState(prog, tree.state)) {
    case StepResult.STEPPED: {
      if (stats) stats.deductions++;
      return [path, tree, null];
    }

    case StepResult.IS_MODEL: {
      if (stats) stats.models++;
      return [path, null, tree.state.explored];
    }

    case StepResult.DEFERRED: {
      if (stats) stats.choices++;
      const { name, args } = tree.state.deferred.choose()!;
      const { values: choices, open } = tree.state.frontier.get(name, args)!;
      let justChild: DataMap<LazyChoiceTree> = DataMap.empty();
      for (const choice of choices) {
        justChild = justChild.set(choice, { ref: null });
      }
      const noneOfChild: null | LazyChoiceTree = open ? { ref: null } : null;

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
      if (stats) stats.rejected++;
      return [path, null, null];
    }
  }
}

export function* execute(prog: Program) {
  let tree: null | ChoiceTree = { type: 'leaf', state: createSearchState(prog) };
  let path: ChoiceZipper = null;
  let model: Database | null;
  let needToAscend = false;

  while (path !== null || tree !== null) {
    if (needToAscend && tree !== null) {
      tree = ascendToRoot(path, tree);
      needToAscend = false;
      path = null;
    }

    [path, tree, model] = step(prog, path, tree);
    if (model) {
      yield model;
      needToAscend = true;
    }
  }
}
