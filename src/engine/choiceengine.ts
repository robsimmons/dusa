import { Data, TRIV_DATA, dataToString, hide } from '../datastructures/data.js';
import { DataMap } from '../datastructures/datamap.js';
import { Database, dbToString, insertFact, listFacts, stepDb } from './forwardengine.js';
import { IndexedProgram } from '../language/indexize.js';
import { equal } from './dataterm.js';

export interface ChoiceTreeLeaf {
  type: 'leaf';
  db: Database;
}

export interface ChoiceTreeNode {
  type: 'choice';
  base: Database;
  attribute: [string, Data[]];
  children: DataMap<null | ChoiceTree>;
  defer: 'exhaustive' | ChoiceTree;
}

export type ChoiceTree = ChoiceTreeLeaf | ChoiceTreeNode;

function maybeStep(
  program: IndexedProgram,
  ref: { db: Database },
): 'solution' | 'discard' | 'choose' | 'stepped' {
  if (ref.db.queue.length === 0) {
    if (ref.db.deferredChoices.length === 0) {
      // Saturation! Check that it meets requirements
      // TODO this "every" is quite inefficient. As an alternative, we could
      // add facts that need to be positively asserted to remainingDemands or
      // something equivalent, and just check that the remaining un-asserted
      // fact set is null
      if (
        [...ref.db.factValues.entries()].every(({ value }) => value.type === 'is') &&
        ref.db.remainingDemands.length === 0
      ) {
        return 'solution';
      } else {
        return 'discard';
      }
    } else {
      // Must make a choice
      return 'choose';
    }
  } else {
    const db = stepDb(program, ref.db);
    if (db === null) {
      return 'discard';
    } else {
      ref.db = db;
      return 'stepped';
    }
  }
}

export interface Stats {
  cycles: number;
  deadEnds: number;
}

function cleanPath(
  path: [ChoiceTreeNode, Data | 'defer'][],
): { tree: null } | { tree: ChoiceTree; path: [ChoiceTreeNode, Data | 'defer'][] } {
  while (path.length > 0) {
    const [parentNode, parentChoice] = path.pop()!;
    if (parentChoice === 'defer') {
      parentNode.defer = 'exhaustive';
    } else {
      parentNode.children = parentNode.children.remove(parentChoice)![1];
    }
    if (parentNode.defer !== 'exhaustive' || parentNode.children.length > 0) {
      return { tree: parentNode, path };
    }
  }
  return { tree: null };
}

/* A decision will always take the form "this attribute takes one of these values", or
 * "this attribute takes one of these values, or maybe some other values."
 *
 * Given a database, we can prune any possibilities that are inconsistent with respect to that
 * database, ideally getting a single possibility that we can then use to continue reasoning.
 */
function prune(pred: string, args: Data[], values: Data[], exhaustive: boolean, db: Database) {
  const knownValue = db.factValues.get(pred, args);

  if (knownValue?.type === 'is') {
    // Each choice is redundant or is immediately contradictory
    // Check for contradiction with the provided options
    if (exhaustive && !values.some((value) => equal(value, knownValue.value))) {
      return { values: [], exhaustive: true };
    }

    // No contradiction, so just continue, nothing was learned
    return { values: [knownValue.value], exhaustive: true };
  }

  if (knownValue?.type === 'is not') {
    values = values.filter(
      (value) => !knownValue.value.some((excludedValue) => equal(excludedValue, value)),
    );
  }

  return { values, exhaustive };
}

export function stepTreeRandomDFS(
  program: IndexedProgram,
  tree: ChoiceTree,
  path: [ChoiceTreeNode, Data | 'defer'][],
  stats: Stats,
):
  | { tree: ChoiceTree; path: [ChoiceTreeNode, Data | 'defer'][]; solution?: Database }
  | { tree: null; solution?: Database } {
  switch (tree.type) {
    case 'leaf': {
      const stepResult = maybeStep(program, tree);
      switch (stepResult) {
        case 'stepped': {
          stats.cycles += 1;
          return { tree, path };
        }

        case 'solution': {
          // Return to the root
          const cleaned = cleanPath(path);
          if (cleaned.tree === null) return { tree: null, solution: tree.db };
          if (cleaned.path.length === 0) return { tree: cleaned.tree, path: [], solution: tree.db };
          return { tree: cleaned.path[0][0], path: [], solution: tree.db };
        }

        case 'choose': {
          // Forced to make a choice
          // TODO prune everything: if a choice has become unitary we shouldn't branch
          if (tree.db.deferredChoices.length === 0) {
            // This case may be impossible?
            console.error('====== unexpected point reached ======');
            return cleanPath(path);
          }

          const [pred, args, unpruned, deferredChoices] = tree.db.deferredChoices.popRandom();
          const { values, exhaustive } = prune(
            pred,
            args,
            unpruned.values,
            unpruned.exhaustive,
            tree.db,
          );
          const newTree: ChoiceTreeNode = {
            type: 'choice',
            base: { ...tree.db, deferredChoices },
            attribute: [pred, args],
            children: DataMap.new(), // A default, we may change this below
            defer: 'exhaustive', // A default, we may change this below
          };

          // Add a child for each positive choice of value
          for (const choice of values) {
            newTree.children = newTree.children.set(choice, null);
          }

          // If the tree is open-ended, add a child for all negative choices of value
          if (!exhaustive) {
            const currentAssignment = tree.db.factValues.get(pred, args) ?? {
              type: 'is not',
              value: [],
            };
            if (currentAssignment.type === 'is') {
              throw new Error('Invariant: prunedChoice should have returned exhaustive === true');
            }
            newTree.defer = {
              type: 'leaf',
              db: {
                ...tree.db,
                deferredChoices,
                factValues: tree.db.factValues.set(pred, args, {
                  type: 'is not',
                  value: currentAssignment.value.concat(
                    values.filter((v1) => !currentAssignment.value.some((v2) => equal(v1, v2))),
                  ),
                }).result,
              },
            };
          }

          // Fix up the parent pointer
          if (path.length > 0) {
            const [parent, route] = path[path.length - 1];
            if (route === 'defer') {
              parent.defer = newTree;
            } else {
              parent.children = parent.children.set(route, newTree);
            }
          }

          return { tree: newTree, path };
        }

        case 'discard': {
          // Return only as far as possible
          stats.deadEnds += 1;
          const result = cleanPath(path);
          if (result.tree === null || result.path.length === 0) return result;
          if (Math.random() > 0.01) return result;
          return { tree: result.path[0][0], path: [] };
        }

        default:
          throw new Error('should be unreachable');
      }
    }

    case 'choice': {
      if (tree.children.length === 0) {
        if (tree.defer === 'exhaustive') {
          return cleanPath(path);
        }
        path.push([tree, 'defer']);
        return { tree: tree.defer, path };
      } else {
        const [value, existingChild] = tree.children.getNth(
          Math.floor(Math.random() * tree.children.length),
        );
        if (existingChild !== null) {
          path.push([tree, value]);
          return { tree: existingChild, path };
        }
        const newDb = { ...tree.base };
        if (!insertFact(tree.attribute[0], tree.attribute[1], value, newDb)) {
          tree.children = tree.children.remove(value)![1];
          return { tree, path };
        }
        const newChild: ChoiceTreeLeaf = { type: 'leaf', db: newDb };
        tree.children = tree.children.set(value, newChild);
        path.push([tree, value]);
        return { tree: newChild, path };
      }
    }
  }
}

/**** Debugging ****/

interface Fact {
  name: string;
  args: Data[];
  value: Data;
}

interface Solution {
  facts: Fact[];
}

export function execute(program: IndexedProgram, db: Database, debug = false) {
  let tree: null | ChoiceTree = { type: 'leaf', db };
  let path: [ChoiceTreeNode, Data | 'defer'][] = [];
  const stats: Stats = { cycles: 0, deadEnds: 0 };
  const solutions: Solution[] = [];

  for (;;) {
    if (tree === null) return { solutions, steps: stats.cycles, deadEnds: stats.deadEnds };
    if (debug) {
      console.log(pathToString(tree, path));
    }

    const result = stepTreeRandomDFS(program, tree, path, stats);
    tree = result.tree;
    path = result.tree === null ? path : result.path;

    if (result.solution) {
      solutions.push({ facts: [...listFacts(result.solution)] });
    }
  }
}

export function pathToString(tree: ChoiceTree, path: [ChoiceTreeNode, Data | 'defer'][]) {
  return `~~~~~~~~~~~~~~
${path.map(([node, data]) => choiceTreeNodeToString(node, data)).join('\n\n')}
${tree.type === 'leaf' ? dbToString(tree.db) : choiceTreeNodeToString(tree)}`;
}

function choiceTreeNodeToString(
  { attribute, children, defer }: ChoiceTreeNode,
  data?: Data | 'defer',
) {
  return `Tree node for attribute ${dataToString(
    hide({ type: 'const', name: attribute[0], args: attribute[1] }),
  )}${children
    .entries()
    .map(
      ([dataOption, child]) =>
        `${
          data !== undefined && data !== 'defer' && equal(data, dataOption) ? '\n * ' : '\n   '
        }${dataToString(dataOption)}:${child === null ? ' null' : ' ...'}`,
    )
    .join('')}${defer === 'exhaustive' ? '' : `\n${data === 'defer' ? ' * ' : '   '}<defer>: ...`}`;
}

export function factToString(fact: Fact): string {
  const args = fact.args.map((arg) => ` ${dataToString(arg)}`).join('');
  const value = equal(fact.value, TRIV_DATA) ? '' : ` is ${dataToString(fact.value)}`;
  return `${fact.name}${args}${value}`;
}

export function solutionsToStrings(solutions: Solution[]) {
  return solutions.map((solution) => solution.facts.map(factToString).sort().join(', ')).sort();
}
