import { CHOICE_PRIO, CONSTRAINT_PRIO, DEMAND_PRIO, PREFIX_PRIO } from '../constants';
import { CompiledProgram, InternalPartialRule, InternalPremise, Program } from './engine';
import { Declaration, Premise, Proposition } from './syntax';
import { Pattern, freeVars } from './terms';

export function indexToRuleName(index: number): string {
  if (index >= 26) {
    return `${indexToRuleName(Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`;
  }
  return String.fromCharCode(97 + index);
}


export function compilePremises(
  rule: string,
  premises: Premise[],
  rulePriority: number,
): {
  seed: string;
  rules: [string, InternalPartialRule][];
  conclusion: string;
} {
  const knownFreeVars = new Set<string>();
  const rules = premises.map((premise, i): [string, InternalPartialRule] => {
    const thisPartial = `${rule}${i}`;
    const nextPartial = `${rule}${i + 1}`;
    const priority = i === premises.length - 1 ? rulePriority : rulePriority - 1 / (i + 2);
    switch (premise.type) {
      case 'Inequality': {
        const fv = freeVars(premise.a, premise.b);
        return [thisPartial, { next: [nextPartial], shared: [...fv], premise, priority }];
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
        return [thisPartial, { next: [nextPartial], shared, premise, priority }];
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
        return [thisPartial, { next: [nextPartial], shared, premise: newPremise, priority }];
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
    demands: {},
  };
  const initialFacts: Proposition[] = [];
  const initialPrefixes: string[] = [];

  let ruleNum = 0;
  for (const decl of decls) {
    switch (decl.type) {
      case 'Forbid': {
        const { seed, rules, conclusion } = compilePremises(
          indexToRuleName(ruleNum++),
          decl.premises,
          CONSTRAINT_PRIO,
        );
        for (const [name, rule] of rules) {
          program.rules[name] = rule;
        }
        initialPrefixes.push(seed);
        program.conclusions[conclusion] = { type: 'Contradiction' };
        break;
      }

      case 'Demand': {
        const { seed, rules, conclusion } = compilePremises(
          indexToRuleName(ruleNum++),
          decl.premises,
          DEMAND_PRIO,
        );
        for (const [name, rule] of rules) {
          program.rules[name] = rule;
        }
        initialPrefixes.push(seed);
        program.demands[conclusion] = true;
        break;
      }

      case 'Rule': {
        if (
          decl.premises.length === 0 &&
          (decl.conclusion.values === null || decl.conclusion.values.length) === 1 &&
          decl.conclusion.exhaustive
        ) {
          // This is just a fact
          initialFacts.push({
            type: 'Proposition',
            name: decl.conclusion.name,
            args: decl.conclusion.args,
            value: decl.conclusion.values?.[0] ?? { type: 'triv' },
          });
        }

        const { seed, rules, conclusion } = compilePremises(
          indexToRuleName(ruleNum++),
          decl.premises,
          decl.conclusion.values === null ||
            (decl.conclusion.values.length === 1 && decl.conclusion.exhaustive)
            ? PREFIX_PRIO
            : CHOICE_PRIO,
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
