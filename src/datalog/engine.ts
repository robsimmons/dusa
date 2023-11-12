import { FACT_PRIO, INITIAL_PREFIX_PRIO } from '../constants';
import { AttributeMap } from './attributemap';
import PQ from './binqueue';
import { Data, TRIV_DATA, dataToString, hide } from './data';
import { DataMap } from './datamap';
import { Proposition } from './syntax';
import { Substitution, Pattern, match, apply, equal } from './terms';

export interface Program {
  rules: { [name: string]: InternalPartialRule };
  conclusions: { [r: string]: InternalConclusion };
  demands: { [r: string]: boolean };
}

export interface CompiledProgram {
  program: Program;
  initialPrefixes: string[];
  initialFacts: Proposition[];
}

export type InternalPremise =
  | {
      type: 'Proposition';
      name: string;
      args: Pattern[];
      value: Pattern;
    }
  | {
      type: 'Equality' | 'Inequality';
      a: Pattern; // Must have no new free variables
      b: Pattern; // May have new free variables
    };

export type InternalPartialRule = {
  next: string[];
  shared: string[];
  premise: InternalPremise;
  priority: number;
};

export type InternalConclusion =
  | {
      type: 'NewFact';
      name: string;
      args: Pattern[];
      values: Pattern[];
      exhaustive: boolean;
    }
  | { type: 'Contradiction' };

export interface Fact {
  type: 'Fact';
  name: string;
  args: Data[];
  value: Data;
}

export interface Prefix {
  type: 'Prefix';
  name: string;
  args: Substitution;
  priority: number;
}

export interface Database {
  facts: { [predicate: string]: [Data[], Data][] };
  factValues: AttributeMap<{ type: 'is'; value: Data } | { type: 'is not'; value: Data[] }>;
  prefixes: { [name: string]: Substitution[] };
  queue: PQ<Fact | Prefix>;
  deferredChoices: AttributeMap<{ values: Data[]; exhaustive: boolean }>;
  remainingDemands: DataMap<true>;
}

export function makeInitialDb(prog: CompiledProgram): Database {
  let db: Database = {
    facts: {},
    factValues: AttributeMap.new(),
    prefixes: {},
    queue: PQ.new(),
    deferredChoices: AttributeMap.new(),
    remainingDemands: DataMap.new(),
  };
  for (const seed of prog.initialPrefixes) {
    db.queue = db.queue.push(INITIAL_PREFIX_PRIO, {
      type: 'Prefix',
      priority: INITIAL_PREFIX_PRIO,
      name: seed,
      args: {},
    });
    db.prefixes[seed] = [{}];
  }
  for (const fact of prog.initialFacts) {
    db = insertFact(
      fact.name,
      fact.args.map((arg) => apply({}, arg)),
      fact.value === null ? TRIV_DATA : apply({}, fact.value),
      db,
    )!; // XXX TODO this _could_ fail if there's contradictary initial facts!
  }
  for (const demand of Object.keys(prog.program.demands)) {
    db.remainingDemands = db.remainingDemands.set(hide({ type: 'string', value: demand }), true);
  }
  return db;
}

function matchPatterns(
  substitution: Substitution,
  pattern: Pattern[],
  data: Data[],
): null | Substitution {
  if (pattern.length !== data.length) {
    return null;
  }

  for (let i = 0; i < pattern.length; i++) {
    const candidate = match(substitution, pattern[i], data[i]);
    if (candidate === null) return null;
    substitution = candidate;
  }

  return substitution;
}

function matchFact(substitution: Substitution, proposition: Proposition, fact: Fact) {
  if (proposition.name !== fact.name) {
    return null;
  }
  return matchPatterns(
    substitution,
    [...proposition.args, proposition.value ?? { type: 'triv' }],
    [...fact.args, fact.value],
  );
}

export function factToString(fact: Fact): string {
  const args = fact.args.map((arg) => ` ${dataToString(arg)}`).join('');
  const value = fact.value === TRIV_DATA ? '' : ` is ${dataToString(fact.value)}`;
  return `${fact.name}${args}${value}`;
}

function substitutionToString(args: Substitution): string {
  if (Object.keys(args).length === 0) return `{}`;
  return `{ ${Object.entries(args)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([varName, term]) => `${dataToString(term)}/${varName}`)
    .join(', ')} }`;
}

function prefixToString(prefix: Prefix): string {
  return `${prefix.name}${substitutionToString(prefix.args)}[${prefix.priority}]`;
}

function dbItemToString(item: Fact | Prefix) {
  if (item.type === 'Fact') return factToString(item);
  return prefixToString(item);
}

function stepConclusion(
  conclusion: InternalConclusion,
  prefix: Prefix,
  db: Database,
): Database | null {
  if (conclusion.type === 'Contradiction') return null;
  const args = conclusion.args.map((arg) => apply(prefix.args, arg));
  let { values, exhaustive } = prune(
    conclusion.name,
    args,
    conclusion.values.map((value) => apply(prefix.args, value)),
    conclusion.exhaustive,
    db,
  );

  // merge the conclusion with any existing deferred values
  const [deferredChoice, deferredChoices] = db.deferredChoices.remove(conclusion.name, args) ?? [
    null,
    db.deferredChoices,
  ];
  if (deferredChoice !== null) {
    if (exhaustive && deferredChoice.exhaustive) {
      // Intersect values
      values = values.filter((v1) => deferredChoice.values.some((v2) => equal(v1, v2)));
    } else if (exhaustive) {
      // Ignore deferred values
    } else if (deferredChoice.exhaustive) {
      // Ignore values in this conclusion
      values = deferredChoice.values;
    } else {
      // Union values
      values = deferredChoice.values.concat(
        values.filter((v1) => !deferredChoice.values.some((v2) => equal(v1, v2))),
      );
    }

    exhaustive = exhaustive || deferredChoice.exhaustive;
  }

  if (exhaustive && values.length === 0) {
    return null;
  }

  if (
    exhaustive &&
    values.length === 1 &&
    db.factValues.get(conclusion.name, args)?.type !== 'is'
  ) {
    const existingFacts = db.facts[conclusion.name] || [];
    const value = values[0];
    return {
      ...db,
      facts: { ...db.facts, [conclusion.name]: [...existingFacts, [args, value]] },
      factValues: db.factValues.set(conclusion.name, args, { type: 'is', value }),
      queue: db.queue.push(FACT_PRIO, { type: 'Fact', name: conclusion.name, args, value }),
      deferredChoices,
    };
  }
  return {
    ...db,
    deferredChoices: deferredChoices.set(conclusion.name, args, { values, exhaustive }),
  };
}

export function insertFact(name: string, args: Data[], value: Data, db: Database): Database | null {
  const knownValue = db.factValues.get(name, args);
  if (knownValue?.type === 'is') {
    return equal(knownValue.value, value) ? db : null;
  } else {
    if (knownValue?.type === 'is not') {
      if (knownValue.value.some((excludedValue) => equal(excludedValue, value))) {
        return null;
      }
    }

    const existingFacts = db.facts[name] || [];
    return {
      ...db,
      facts: { ...db.facts, [name]: [...existingFacts, [args, value]] },
      factValues: db.factValues.set(name, args, { type: 'is', value }),
      queue: db.queue.push(FACT_PRIO, { type: 'Fact', name, args, value }),
    };
  }
}

function stepPrefix(
  rules: { [name: string]: InternalPartialRule },
  prefix: Prefix,
  db: Database,
): Database {
  const rule = rules[prefix.name];
  if (!rule) {
    throw new Error(`Internal: expected rule '${prefix.name}' in rules.`);
  }

  const newPrefixes: Prefix[] = [];

  if (rule.premise.type === 'Inequality') {
    const a = apply(prefix.args, rule.premise.a);

    if (matchPatterns(prefix.args, [rule.premise.b], [a]) === null) {
      newPrefixes.push(
        ...rule.next.map<Prefix>((next) => ({
          type: 'Prefix',
          name: next,
          args: prefix.args,
          priority: rule.priority,
        })),
      );
    }
  }

  if (rule.premise.type === 'Equality') {
    const a = apply(prefix.args, rule.premise.a);
    const candidate = matchPatterns(prefix.args, [rule.premise.b], [a]);

    if (candidate !== null) {
      newPrefixes.push(
        ...rule.next.map<Prefix>((next) => ({
          type: 'Prefix',
          name: next,
          args: candidate,
          priority: rule.priority,
        })),
      );
    }
  }

  if (rule.premise.type === 'Proposition') {
    const knownFacts = db.facts[rule.premise.name] || [];

    for (const [factArgs, factValue] of knownFacts) {
      const candidate1 = matchPatterns(prefix.args, rule.premise.args, factArgs);
      if (candidate1 !== null) {
        const candidate2 = matchPatterns(candidate1, [rule.premise.value], [factValue]);
        if (candidate2 !== null) {
          newPrefixes.push(
            ...rule.next.map<Prefix>((next) => ({
              type: 'Prefix',
              name: next,
              args: candidate2,
              priority: rule.priority,
            })),
          );
        }
      }
    }
  }

  return extendDbWithPrefixes(newPrefixes, db);
}

function stepFact(
  rules: { [name: string]: InternalPartialRule },
  fact: Fact,
  db: Database,
): Database {
  const newPrefixes: Prefix[] = [];
  for (const ruleName of Object.keys(rules)) {
    const rule = rules[ruleName];
    if (rule.premise.type === 'Proposition') {
      for (const prefixSubst of db.prefixes[ruleName] || []) {
        const substitution = matchFact(prefixSubst, rule.premise, fact);
        if (substitution !== null) {
          newPrefixes.push(
            ...rule.next.map<Prefix>((next) => ({
              type: 'Prefix',
              name: next,
              args: { ...substitution, ...prefixSubst },
              priority: rule.priority,
            })),
          );
        }
      }
    }
  }

  return extendDbWithPrefixes(newPrefixes, db);
}

function extendDbWithPrefixes(candidatePrefixList: Prefix[], db: Database): Database {
  let copied = false;
  for (const prefix of candidatePrefixList) {
    if (!db.prefixes[prefix.name]) {
      db.prefixes[prefix.name] = [];
    }

    // Filter out prefixes that are already in the database
    // Relies on the fact that all prefixes with the same name
    // have the same set of variables that they ground
    if (
      !db.prefixes[prefix.name].some((substitution) => {
        return Object.keys(substitution).every((varName) =>
          equal(substitution[varName], prefix.args[varName]),
        );
      })
    ) {
      // copy on write
      if (!copied) {
        copied = true;
        db = { ...db, prefixes: { ...db.prefixes } };
      }

      db.prefixes[prefix.name] = [...db.prefixes[prefix.name], prefix.args];
      db.queue = db.queue.push(prefix.priority, prefix);
    }
  }

  return db;
}

export function queueToString(db: Database) {
  return db.queue
    .toList()
    .map((item) => dbItemToString(item))
    .join(', ');
}

export function dbToString(db: Database) {
  return `Queue: ${queueToString(db)}
Prefixes: 
${Object.keys(db.prefixes)
  .sort()
  .map((key) => `${key}: ${db.prefixes[key].map(substitutionToString).join(', ')}`)
  .join('\n')}
Facts:
${db.factValues
  .entries()
  .map(([name, args, entry]) => {
    const attribute = dataToString(hide({ type: 'const', name, args }), false);
    const postfix =
      entry.type === 'is not'
        ? ` is not ${entry.value.map((term) => dataToString(term, false)).join(' or ')}`
        : entry.value === TRIV_DATA
        ? ''
        : ` is ${dataToString(entry.value)}`;
    return `${attribute}${postfix};`;
  })
  .sort()
  .join('\n')}
`;
}

export function stepDb(program: Program, db: Database): Database | null {
  const [current, rest] = db.queue.pop();
  db = { ...db, queue: rest };
  if (current.type === 'Fact') {
    return stepFact(program.rules, current, db);
  } else if (program.conclusions[current.name]) {
    return stepConclusion(program.conclusions[current.name], current, db);
  } else if (program.demands[current.name]) {
    db.remainingDemands =
      db.remainingDemands.remove(hide({ type: 'string', value: current.name }))?.[1] ??
      db.remainingDemands;
    return db;
  } else {
    return stepPrefix(program.rules, current, db);
  }
}

export interface Solution {
  facts: Fact[];
}

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
  program: Program,
  ref: { db: Database },
): 'solution' | 'discard' | 'choose' | 'stepped' {
  if (ref.db.queue.length === 0) {
    if (ref.db.deferredChoices.length === 0) {
      // Saturation! Check that it meets requirements
      if (
        ref.db.factValues.every((_name, _args, { type }) => type === 'is') &&
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

export function pathToString(tree: ChoiceTree, path: [ChoiceTreeNode, Data | 'defer'][]) {
  return `~~~~~~~~~~~~~~
${path.map(([node, data]) => choiceTreeNodeToString(node, data)).join('\n\n')}

${tree.type === 'leaf' ? dbToString(tree.db) : choiceTreeNodeToString(tree)}`;
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
  program: Program,
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
                }),
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
          return cleanPath(path);
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
        const newDb = insertFact(tree.attribute[0], tree.attribute[1], value, tree.base);
        if (newDb === null) {
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

export function execute(program: Program, db: Database) {
  let tree: null | ChoiceTree = { type: 'leaf', db };
  let path: [ChoiceTreeNode, Data | 'defer'][] = [];
  const stats: Stats = { cycles: 0, deadEnds: 0 };
  const solutions: Solution[] = [];

  for (;;) {
    if (tree === null) return { solutions, steps: stats.cycles, deadEnds: stats.deadEnds };

    const result = stepTreeRandomDFS(program, tree, path, stats);
    tree = result.tree;
    path = result.tree === null ? path : result.path;

    if (result.solution) {
      solutions.push({
        facts: ([] as Fact[]).concat(
          ...Object.entries(result.solution.facts).map(([name, argses]) =>
            argses.map<Fact>(([args, value]) => ({
              type: 'Fact',
              name: name,
              args,
              value,
            })),
          ),
        ),
      });
    }
  }
}
