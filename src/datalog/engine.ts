import { Premise, Proposition, propToString } from './syntax';
import { Substitution, Pattern, Data, match, apply, equal, termToString } from './terms';

export interface Program {
  rules: { [name: string]: InternalPartialRule };
  conclusions: { [r: string]: InternalConclusion };
}

export type InternalPartialRule = {
  next: string[];
  shared: string[];
  premise: Premise;
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
}

export interface Prefix {
  type: 'Prefix';
  name: string;
  args: Substitution;
}

export interface Database {
  facts: { [predicate: string]: Data[][] };
  factValues: { [prop: string]: { type: 'is'; value: Data } | { type: 'is not'; value: Data[] } };
  prefixes: { [name: string]: Substitution[] };
  queue: (Fact | Prefix)[];
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
  return matchPatterns(substitution, proposition.args, fact.args);
}

export function factToString(fact: Fact): string {
  return propToString({ ...fact, type: 'Proposition' });
}

function substitutionToString(args: Substitution): string {
  if (Object.keys(args).length === 0) return `{}`;
  return `{ ${Object.entries(args)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([varName, term]) => `${termToString(term)}/${varName}`)
    .join(', ')} }`;
}

function prefixToString(prefix: Prefix): string {
  return `${prefix.name}${substitutionToString(prefix.args)}`;
}

function dbItemToString(item: Fact | Prefix) {
  if (item.type === 'Fact') return factToString(item);
  return prefixToString(item);
}

function stepConclusion(conclusion: InternalConclusion, prefix: Prefix, db: Database): Database[] {
  if (conclusion.type === 'Contradiction') return [];
  const args = conclusion.args.map((arg) => apply(prefix.args, arg));
  let values = conclusion.values.map((value) => apply(prefix.args, value));

  const key = `${conclusion.name}${args.map((arg) => ` ${termToString(arg)}`).join('')}`;
  const knownValue = db.factValues[key];

  if (knownValue?.type === 'is') {
    // Either this conclusion will be redundant or cause a contradiction
    if (conclusion.exhaustive && !values.some((value) => equal(value, knownValue.value))) {
      return [];
    }
    return [db];
  } else {
    // Just have to make sure options are not already excluded from this branch
    let isNot = knownValue ? knownValue.value : [];
    values = values.filter((value) => !isNot.some((excludedValue) => equal(value, excludedValue)));

    // If this conclusion is nonexhaustive, add any new concrete outcomes to the
    // nonexhaustive branch
    isNot = [...isNot, ...values];

    const nonExhaustive: Database[] = conclusion.exhaustive
      ? []
      : [
          {
            ...db,
            factValues: { ...db.factValues, [key]: { type: 'is not', value: isNot } },
          },
        ];

    const existingFacts = db.facts[conclusion.name] || [];
    return nonExhaustive.concat(
      values.map<Database>((value) => ({
        ...db,
        facts: { ...db.facts, [conclusion.name]: [...existingFacts, [...args, value]] },
        factValues: { ...db.factValues, [key]: { type: 'is', value } },
        queue: [...db.queue, { type: 'Fact', name: conclusion.name, args: [...args, value] }],
      })),
    );
  }
}

export function insertFact(name: string, args: Data[], value: Data, db: Database): Database {
  const key = `${name}${args.map((arg) => ` ${termToString(arg)}`).join('')}`;
  const existingFacts = db.facts[name] || [];
  return {
    ...db,
    facts: { ...db.facts, [name]: [...existingFacts, [...args, value]] },
    factValues: { ...db.factValues, [key]: { type: 'is', value } },
    queue: [...db.queue, { type: 'Fact', name, args: [...args, value] }],
  };
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
    const b = apply(prefix.args, rule.premise.b);

    if (!equal(a, b)) {
      newPrefixes.push(
        ...rule.next.map<Prefix>((next) => ({
          type: 'Prefix',
          name: next,
          args: prefix.args,
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
        })),
      );
    }
  }

  if (rule.premise.type === 'Proposition') {
    const knownFacts = db.facts[rule.premise.name] || [];

    for (const fact of knownFacts) {
      const candidate = matchPatterns(prefix.args, rule.premise.args, fact);

      if (candidate !== null) {
        newPrefixes.push(
          ...rule.next.map<Prefix>((next) => ({
            type: 'Prefix',
            name: next,
            args: candidate,
          })),
        );
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
      const substitution = matchFact({}, rule.premise, fact);
      if (substitution !== null) {
        for (const item of db.prefixes[ruleName] || []) {
          if (rule.shared.every((varName) => equal(substitution[varName], item[varName]))) {
            newPrefixes.push(
              ...rule.next.map<Prefix>((next) => ({
                type: 'Prefix',
                name: next,
                args: { ...substitution, ...item },
              })),
            );
          }
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
        db = { ...db, prefixes: { ...db.prefixes }, queue: [...db.queue] };
      }

      db.prefixes[prefix.name] = [...db.prefixes[prefix.name], prefix.args];
      db.queue.push(prefix);
    }
  }

  return db;
}

export function dbToString(db: Database) {
  return `Queue: ${db.queue.map((item) => dbItemToString(item)).join(', ')}
Prefixes: 
${Object.keys(db.prefixes)
  .sort()
  .map((key) => `${key}: ${db.prefixes[key].map(substitutionToString).join(', ')}`)
  .join('\n')}
Facts:
${Object.keys(db.factValues)
  .sort()
  .map((fact) => {
    const entry = db.factValues[fact];
    if (entry.type === 'is') {
      return entry.value.type === 'triv' ? fact : `${fact} is ${termToString(entry.value)}`;
    } else {
      return `${fact} is not ${entry.value.map(termToString).join(' or ')}`;
    }
  })
  .join('\n')}
`;
}

export function step(program: Program, db: Database): Database[] {
  const [current, ...rest] = db.queue;
  db = { ...db, queue: rest };
  if (current.type === 'Fact') {
    return [stepFact(program.rules, current, db)];
  } else if (program.conclusions[current.name]) {
    return stepConclusion(program.conclusions[current.name], current, db);
  } else {
    return [stepPrefix(program.rules, current, db)];
  }
}

export interface Solution {
  facts: Fact[];
  unfacts: [string, Data[]][];
}

export function execute(
  program: Program,
  db: Database,
): { solutions: Solution[]; steps: number; deadEnds: number; splits: number; highWater: number } {
  const dbStack: Database[] = [db];
  const solutions: Solution[] = [];
  let steps = 0;
  let deadEnds = 0;
  let highWater = 0;
  let splits = 0;
  while (dbStack.length > 0) {
    if (dbStack.length > highWater) highWater = dbStack.length;

    const db = dbStack.pop()!;
    if (db.queue.length === 0) {
      solutions.push({
        facts: ([] as Fact[]).concat(
          ...Object.entries(db.facts).map(([name, argses]) =>
            argses.map<Fact>((args) => ({ type: 'Fact', name: name, args })),
          ),
        ),
        unfacts: Object.entries(db.factValues)
          .filter(
            (arg): arg is [string, { type: 'is not'; value: Data[] }] => arg[1].type === 'is not',
          )
          .map(([attribute, { value }]) => [attribute, value]),
      });
    } else {
      steps += 1;
      const newDbs = step(program, db);
      if (newDbs.length === 0) deadEnds += 1;
      if (newDbs.length > 1) splits += 1;
      dbStack.push(...newDbs);
    }
  }

  return { solutions, steps, deadEnds, splits, highWater };
}
