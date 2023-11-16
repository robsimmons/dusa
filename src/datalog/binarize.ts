import { InternalPremise } from './engine';
import { Declaration, Premise } from './syntax';
import { Pattern, freeVars, termToString } from './terms';

export type BinarizedRule =
  | {
      type: 'Binary';
      premise: InternalPremise;
      next: string;
      carriedVars: string[];
      sharedVars: string[];
      introducedVars: string[];
      premiseNumber: number;
      totalPremises: number;
    }
  | {
      type: 'Conclusion';
      carriedVars: string[];
      name: string;
      args: Pattern[];
      values: Pattern[];
      exhaustive: boolean;
    };

export interface BinarizedProgram {
  seeds: string[];
  rules: [string, BinarizedRule][];
  forbids: string[];
  demands: string[];
}

function binarizedPremiseToString(premise: InternalPremise): string {
  switch (premise.type) {
    case 'Equality':
      return `${termToString(premise.a)} == ${termToString(premise.b)}`;
    case 'Inequality':
      return `${termToString(premise.a)} != ${termToString(premise.b)}`;
    case 'Proposition':
      return `${premise.name}${premise.args
        .map((arg) => ` ${termToString(arg)}`)
        .join('')} is ${termToString(premise.value)}`;
  }
}

function binarizedRuleToString(name: string, rule: BinarizedRule): string {
  switch (rule.type) {
    case 'Binary':
      return `$${rule.next}${rule.carriedVars
        .concat(rule.introducedVars)
        .map((v) => ` ${v}`)
        .join('')} :- $${name}${rule.carriedVars
        .map((v) => ` ${v}`)
        .join('')}, ${binarizedPremiseToString(rule.premise)}.`;
    case 'Conclusion':
      return `${rule.name}${rule.args
        .map((arg) => ` ${termToString(arg)}`)
        .join('')} is { ${rule.values.map((arg) => termToString(arg)).join(', ')}${
        rule.exhaustive ? '' : '?'
      } } :- $${name}${rule.carriedVars.map((v) => ` ${v}`).join('')}.`;
  }
}

export function binarizedProgramToString(program: BinarizedProgram) {
  return `Initial seeds: ${program.seeds.map((name) => `$${name}`).join(', ')}
Demands to derive: ${program.demands.map((name) => `$${name}`).join(', ')}
Forbids to derive: ${program.forbids.map((name) => `$${name}`).join(', ')}
Rules:
${program.rules.map(([name, rule]) => binarizedRuleToString(name, rule)).join('\n')}`;
}

function binarizePremises(
  name: string,
  premises: Premise[],
): {
  seed: string;
  conclusion: string;
  newRules: [string, BinarizedRule][];
  carriedVars: string[];
} {
  const knownFreeVars = new Set<string>();
  const knownCarriedVars: string[] = [];
  const totalPremises = premises.length;
  const newRules = premises.map((premise, premiseNumber): [string, BinarizedRule] => {
    const thisPartial = `${name}${premiseNumber}`;
    const next = `${name}${premiseNumber + 1}`;
    switch (premise.type) {
      case 'Inequality': {
        const fv = freeVars(premise.a, premise.b);
        return [
          thisPartial,
          {
            type: 'Binary',
            premise,
            next,
            carriedVars: [...knownCarriedVars],
            sharedVars: [...fv],
            introducedVars: [],
            premiseNumber,
            totalPremises,
          },
        ];
      }

      case 'Equality': {
        const fvA = freeVars(premise.a); // Definitely a subset of known FV;
        const fvB = freeVars(premise.b); // May introduce new vars
        const carriedVars = [...knownCarriedVars];
        const sharedVars: string[] = [];
        const introducedVars: string[] = [];
        for (const v of fvA) {
          sharedVars.push(v);
        }
        for (const v of fvB) {
          if (fvA.has(v)) {
            // Do nothing, already pushed this in the last loop
          } else if (knownFreeVars.has(v)) {
            sharedVars.push(v);
          } else {
            introducedVars.push(v);
            knownCarriedVars.push(v);
            knownFreeVars.add(v);
          }
        }

        return [
          thisPartial,
          {
            type: 'Binary',
            premise,
            next,
            carriedVars,
            sharedVars,
            introducedVars,
            premiseNumber,
            totalPremises,
          },
        ];
      }

      case 'Proposition': {
        const newPremise: InternalPremise = {
          ...premise,
          value: premise.value ?? { type: 'triv' },
        };
        const fv = freeVars(...newPremise.args, newPremise.value);
        const carriedVars = [...knownCarriedVars];
        const sharedVars: string[] = [];
        const introducedVars: string[] = [];
        for (const v of fv) {
          if (knownFreeVars.has(v)) {
            sharedVars.push(v);
          } else {
            introducedVars.push(v);
            knownCarriedVars.push(v);
            knownFreeVars.add(v);
          }
        }

        return [
          thisPartial,
          {
            type: 'Binary',
            premise: newPremise,
            next,
            carriedVars,
            sharedVars,
            introducedVars,
            premiseNumber,
            totalPremises,
          },
        ];
      }
    }
  });

  return {
    seed: `${name}0`,
    conclusion: `${name}${premises.length}`,
    newRules,
    carriedVars: knownCarriedVars,
  };
}

export function binarize(decls: [string, Declaration][]): BinarizedProgram {
  const seeds: string[] = [];
  const rules: [string, BinarizedRule][] = [];
  const forbids: string[] = [];
  const demands: string[] = [];

  for (const [name, decl] of decls) {
    switch (decl.type) {
      case 'Forbid': {
        const { seed, newRules, conclusion } = binarizePremises(name, decl.premises);
        seeds.push(seed);
        rules.push(...newRules);
        forbids.push(conclusion);
        break;
      }

      case 'Demand': {
        const { seed, newRules, conclusion } = binarizePremises(name, decl.premises);
        seeds.push(seed);
        rules.push(...newRules);
        demands.push(conclusion);
        break;
      }

      case 'Rule': {
        const { seed, newRules, conclusion, carriedVars } = binarizePremises(name, decl.premises);
        seeds.push(seed);
        rules.push(...newRules, [
          conclusion,
          {
            type: 'Conclusion',
            name: decl.conclusion.name,
            args: decl.conclusion.args,
            values: decl.conclusion.values ?? [{ type: 'triv' }],
            exhaustive: decl.conclusion.exhaustive,
            carriedVars,
          },
        ]);
      }
    }
  }

  return { seeds, rules, forbids, demands };
}
