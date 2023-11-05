import {
  CompiledProgram,
  Database,
  Fact,
  InternalPartialRule,
  InternalPremise,
  Prefix,
  Program,
  insertFact,
} from './engine';
import PQ from './binqueue';
import { Declaration, Premise } from './syntax';
import { assertData, freeVars } from './terms';


function indexToRuleName(index: number): string {
  if (index >= 26) {
    return `${indexToRuleName(Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`;
  }
  return String.fromCharCode(97 + index);
}

export function compilePremises(
  rule: string,
  premises: Premise[],
): {
  seed: string;
  rules: [string, InternalPartialRule][];
  conclusion: string;
} {
  const knownFreeVars = new Set<string>();
  const rules = premises.map((premise, i): [string, InternalPartialRule] => {
    const thisPartial = `${rule}${i}`;
    const nextPartial = `${rule}${i + 1}`;
    switch (premise.type) {
      case 'Inequality': {
        const fv = freeVars(premise.a, premise.b);
        return [thisPartial, { next: [nextPartial], shared: [...fv], premise }];
      }

      case 'Equality': {
        const fvA = freeVars(premise.a);
        const fvB = freeVars(premise.b);
        const shared = [];
        for (const v of fvA) {
          shared.push(v);
        }
        for (const v of fvB) {
          if (fvA.has(v)) {
            // Do nothing
          } else if (knownFreeVars.has(v)) {
            shared.push(v);
          } else {
            knownFreeVars.add(v);
          }
        }
        return [thisPartial, { next: [nextPartial], shared, premise }];
      }

      case 'Proposition': {
        const newPremise: InternalPremise = {
          ...premise,
          value: premise.value ?? { type: 'triv' },
        };
        const fv = freeVars(...newPremise.args, newPremise.value);
        const shared = [];
        for (const v of fv) {
          if (knownFreeVars.has(v)) {
            shared.push(v);
          } else {
            knownFreeVars.add(v);
          }
        }
        return [thisPartial, { next: [nextPartial], shared, premise: newPremise }];
      }
    }
  });

  return {
    seed: `${rule}0`,
    rules,
    conclusion: `${rule}${premises.length}`,
  };
}

export function compile(decls: Declaration[]): CompiledProgram {
  const program: Program = {
    rules: {},
    conclusions: {},
  };
  let initialFacts: Fact[] = [];
  let initialPrefixes: string[] = [];

  let ruleNum = 0;
  for (const decl of decls) {
    switch (decl.type) {
      case 'Forbid': {
        const { seed, rules, conclusion } = compilePremises(
          indexToRuleName(ruleNum++),
          decl.premises,
        );
        for (const [name, rule] of rules) {
          program.rules[name] = rule;
        }
        initialPrefixes.push(seed);
        program.conclusions[conclusion] = { type: 'Contradiction' };
        break;
      }

      case 'Demand': {
        throw new Error('todo');
      }

      case 'Rule': {
        if (
          decl.premises.length === 0 &&
          (decl.conclusion.values === null || decl.conclusion.values.length) === 1 &&
          decl.conclusion.exhaustive
        ) {
          // This is just a fact
          initialFacts.push({
            type: 'Fact',
            name: decl.conclusion.name,
            args: decl.conclusion.args.map(assertData), // TODO test case and fix
            value: assertData(decl.conclusion.values?.[0] ?? { type: 'triv' }),
          });
        }

        const { seed, rules, conclusion } = compilePremises(
          indexToRuleName(ruleNum++),
          decl.premises,
        );

        for (const [name, rule] of rules) {
          program.rules[name] = rule;
        }
        initialPrefixes.push(seed);
        program.conclusions[conclusion] = {
          type: 'NewFact',
          name: decl.conclusion.name,
          args: decl.conclusion.args,
          exhaustive: decl.conclusion.exhaustive,
          values: decl.conclusion.values ?? [{ type: 'triv' }],
        };
        break;
      }
    }
  }

  return { program, initialFacts, initialPrefixes };
}
