import { AttributeMap } from '../datastructures/attributemap.js';
import PQ from '../datastructures/binqueue.js';
import { Data, dataToString } from '../datastructures/data.js';
import { TrieMap } from '../datastructures/datamap.js';
import {
  IndexInsertionRule,
  IndexedBinaryRule,
  IndexedConclusion,
  IndexedProgram,
} from '../language/indexize.js';
import { runBuiltinBackward, runBuiltinForward } from './builtin.js';
import { Substitution, apply, equal, match } from './dataterm.js';

type Prefix = { type: 'prefix'; name: string; shared: Data[]; passed: Data[] };
type NewFact = { type: 'fact'; name: string; args: Data[]; value: Data };
type Index = { type: 'index'; name: string; shared: Data[]; introduced: Data[] };

type QueueMember = Prefix | Index | NewFact;

export interface Database {
  factValues: TrieMap<Data, { type: 'is'; value: Data } | { type: 'is not'; value: Data[] }>;
  prefixes: AttributeMap<Data[][]>;
  indexes: AttributeMap<Data[][]>;
  queue: PQ<QueueMember>;
  deferredChoices: AttributeMap<{ values: Data[]; exhaustive: boolean }>;
  remainingDemands: AttributeMap<true>;
}

export function makeInitialDb(program: IndexedProgram): Database {
  const prefixes = program.seeds.reduce(
    (prefixes, seed) => prefixes.set(seed, [], [[]]),
    AttributeMap.new<Data[][]>(),
  );
  return {
    factValues: TrieMap.new(),
    prefixes,
    indexes: AttributeMap.new(),
    queue: program.seeds.reduce(
      (q, seed) => q.push(0, { type: 'prefix', name: seed, shared: [], passed: [] }),
      PQ.new<QueueMember>(),
    ),
    deferredChoices: AttributeMap.new(),
    remainingDemands: [...program.demands].reduce(
      (demands, demand) => demands.set(demand, [], true),
      AttributeMap.new<true>(),
    ),
  };
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

/** Imperative: modifies the current database */
export function insertFact(name: string, args: Data[], value: Data, db: Database): boolean {
  const existingFact = db.factValues.get(name, args);
  if (existingFact?.type === 'is not') {
    if (existingFact.value.some((excluded) => equal(excluded, value))) {
      return false;
    }
  } else if (existingFact?.type === 'is') {
    if (!equal(existingFact.value, value)) {
      return false;
    }
  }

  db.queue = db.queue.push(0, { type: 'fact', name, args, value });
  db.factValues = db.factValues.set(name, args, { type: 'is', value }).result;
  return true;
}

function stepConclusion(rule: IndexedConclusion, inArgs: Data[], db: Database): boolean {
  const substitution: Substitution = {};
  for (const [index, v] of rule.inVars.entries()) {
    substitution[v] = inArgs[index];
  }
  const args = rule.args.map((arg) => apply(substitution, arg));
  let { values, exhaustive } = prune(
    rule.name,
    args,
    rule.values.map((value) => apply(substitution, value)),
    rule.exhaustive,
    db,
  );

  // Merge the conclusion with any existing deferred values
  const [deferredChoice, deferredChoices] = db.deferredChoices.remove(rule.name, args) ?? [
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

  // Hey kids, what time is it?
  if (exhaustive && values.length === 0) {
    // Time to give up
    return false;
  }
  if (exhaustive && values.length === 1) {
    // Time to assert a fact
    db.deferredChoices = deferredChoices;
    return insertFact(rule.name, args, values[0], db);
  }
  // Time to defer some choices
  db.deferredChoices = deferredChoices.set(rule.name, args, { values, exhaustive });
  return true;
}

function stepFact(rules: IndexInsertionRule[], args: Data[], value: Data, db: Database): void {
  for (const rule of rules) {
    let substitution: Substitution | null = match({}, rule.value, value);
    for (const [index, pattern] of rule.args.entries()) {
      if (substitution === null) break;
      substitution = match(substitution, pattern, args[index]);
    }
    if (substitution !== null) {
      const shared = rule.shared.map((v) => substitution![v]);
      const introduced = rule.introduced.map((v) => substitution![v]);
      const known = db.indexes.get(rule.indexName, shared) ?? [];
      // TODO deeply suspicious of this concat
      db.indexes = db.indexes.set(rule.indexName, shared, known.concat([introduced]));
      db.queue = db.queue.push(0, { type: 'index', name: rule.indexName, shared, introduced });
    }
  }
}

function nextPrefix(
  rule: IndexedBinaryRule,
  shared: Data[],
  passed: Data[],
  introduced: Data[],
): Prefix {
  const lookup = ([location, index]: ['shared' | 'passed' | 'introduced', number]) =>
    location === 'shared'
      ? shared[index]
      : location === 'passed'
        ? passed[index]
        : introduced[index];

  return {
    type: 'prefix',
    name: rule.outName,
    shared: rule.outShared.map(lookup),
    passed: rule.outPassed.map(lookup),
  };
}

function extendDbWithPrefixes(candidatePrefixList: Prefix[], db: Database): void {
  for (const prefix of candidatePrefixList) {
    if (db.prefixes.get(prefix.name, prefix.shared.concat(prefix.passed)) === null) {
      // TODO deeply suspicious of this concat
      const known = db.prefixes.get(prefix.name, prefix.shared)?.concat([prefix.passed]) ?? [
        prefix.passed,
      ];
      db.prefixes = db.prefixes
        .set(prefix.name, prefix.shared.concat(prefix.passed), [])
        .set(prefix.name, prefix.shared, known);
      db.queue = db.queue.push(0, prefix);
    }
  }
}

function stepPrefix(rule: IndexedBinaryRule, shared: Data[], passed: Data[], db: Database): void {
  const newPrefixes: Prefix[] = [];

  if (rule.type === 'IndexLookup') {
    for (const introduced of db.indexes.get(rule.indexName, shared) ?? []) {
      newPrefixes.push(nextPrefix(rule, shared, passed, introduced));
    }
  } else {
    const substitution: Substitution = {};
    for (const [index, v] of rule.shared.entries()) {
      substitution[v] = shared[index];
    }
    if (rule.matchPosition === null) {
      const args = rule.args.map((arg) => apply(substitution, arg));
      const result = runBuiltinForward(rule.name, args);
      if (result !== null) {
        const outputSubst = match(substitution, rule.value, result);
        if (outputSubst !== null) {
          const introduced = rule.introduced.map((v) => outputSubst[v]);
          newPrefixes.push(nextPrefix(rule, shared, passed, introduced));
        }
      }
    } else {
      const prefixArgs: Data[] = [];
      const postfixArgs: Data[] = [];
      let i = 0;
      for (; i < rule.matchPosition; i++) {
        prefixArgs.push(apply(substitution, rule.args[i]));
      }
      const matchedPosition = rule.args[i++];
      for (; i < rule.args.length; i++) {
        postfixArgs.push(apply(substitution, rule.args[i]));
      }
      for (const outputSubst of runBuiltinBackward(
        rule.name,
        prefixArgs,
        matchedPosition,
        postfixArgs,
        apply(substitution, rule.value),
        substitution,
      )) {
        const introduced = rule.introduced.map((v) => outputSubst[v]);
        newPrefixes.push(nextPrefix(rule, shared, passed, introduced));
      }
    }
  }
  extendDbWithPrefixes(newPrefixes, db);
}

function stepIndex(
  rule: IndexedBinaryRule,
  shared: Data[],
  introduced: Data[],
  db: Database,
): void {
  const newPrefixes: Prefix[] = [];

  for (const passed of db.prefixes.get(rule.inName, shared) ?? []) {
    newPrefixes.push(nextPrefix(rule, shared, passed, introduced));
  }

  extendDbWithPrefixes(newPrefixes, db);
}

/** Functional: does not modify the provided database */
export function stepDb(program: IndexedProgram, db: Database): Database | null {
  const [current, rest] = db.queue.pop();
  db = { ...db, queue: rest };
  if (current.type === 'index') {
    stepIndex(program.indexToRule[current.name], current.shared, current.introduced, db);
    return db;
  }
  if (current.type === 'fact') {
    stepFact(program.factToRules[current.name] || [], current.args, current.value, db);
    return db;
  } else if (program.forbids.has(current.name)) {
    return null;
  } else if (program.demands.has(current.name)) {
    db.remainingDemands = db.remainingDemands.remove(current.name, [])?.[1] ?? db.remainingDemands;
    return db;
  } else if (program.prefixToRule[current.name]) {
    stepPrefix(program.prefixToRule[current.name], current.shared, current.passed, db);
    return db;
  } else if (program.prefixToConclusion[current.name]) {
    const conclusionIsConsistent = stepConclusion(
      program.prefixToConclusion[current.name],
      current.passed,
      db,
    );
    return conclusionIsConsistent ? db : null;
  } else {
    throw new Error(`Unable to look up rule $${current.name}prefix`);
  }
}

export function listFacts(
  db: Database,
): IterableIterator<{ name: string; args: Data[]; value: Data }> {
  function* iterator() {
    for (const { name, keys, value } of db.factValues.entries()) {
      if (value.type === 'is') {
        yield { name, args: keys, value: value.value };
      }
    }
  }

  return iterator();
}

export function* lookup(
  db: Database,
  name: string,
  args: Data[],
): IterableIterator<{ args: Data[]; value: Data }> {
  const arity = db.factValues.arity(name);
  if (arity !== null && arity < args.length) {
    throw new TypeError(
      `${name} takes ${arity} argument${arity === 1 ? '' : 's'}, but ${args.length} were given`,
    );
  }
  for (const { keys, value } of db.factValues.lookup(name, args)) {
    if (value.type === 'is') {
      yield { args: keys, value: value.value };
    }
  }
}

export function get(db: Database, name: string, args: Data[]): undefined | Data {
  const arity = db.factValues.arity(name);
  if (arity === null) return undefined;
  if (args.length !== arity) {
    throw new TypeError(
      `${name} takes ${arity} argument${arity === 1 ? '' : 's'}, but ${args.length} were given`,
    );
  }
  for (const { value } of db.factValues.lookup(name, args)) {
    if (value.type === 'is') return value.value;
  }
  return undefined;
}

function argsetToString(args: Data[]) {
  return `[ ${args.map((v) => dataToString(v)).join(', ')} ]`;
}

export function queueToString(db: Database) {
  return db.queue
    .toList()
    .map((item) => {
      if (item.type === 'prefix') {
        return `$${item.name}prefix ${argsetToString(item.shared)} ${argsetToString(
          item.passed,
        )}\n`;
      } else if (item.type === 'index') {
        return `$${item.name}index ${argsetToString(item.shared)} ${argsetToString(
          item.introduced,
        )}\n`;
      } else {
        return `${item.name}${item.args.map((v) => ` ${dataToString(v)}`)} is ${dataToString(
          item.value,
        )}\n`;
      }
    })
    .join('');
}

/** Warning: VERY inefficient */
export function dbToString(db: Database) {
  return `Queue: 
${queueToString(db)}
Facts known:
${[...db.factValues.entries()]
  .map(({ name, keys, value }) =>
    value.type === 'is'
      ? `${name}${keys.map((arg) => ` ${dataToString(arg)}`)} is ${dataToString(value.value)}\n`
      : `${name}${keys.map(
          (arg) =>
            ` ${dataToString(arg)} is none of ${value.value
              .map((value) => dataToString(value))
              .sort()
              .join(', ')}\n`,
        )}`,
  )
  .sort()
  .join('')}
Prefixes known:
${db.prefixes
  .entries()
  .flatMap(([prefix, keys, valuess]) =>
    valuess.map((values) => `$${prefix}prefix ${argsetToString(keys)} ${argsetToString(values)}\n`),
  )
  .sort()
  .join('')}`;
}
