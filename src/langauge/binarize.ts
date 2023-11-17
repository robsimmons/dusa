import { Declaration, Premise } from './syntax';
import { Pattern, freeVars, termToString } from './terms';

/**
 * Binarization transformation
 *
 * The binarization transformation is straightforward in implementation and
 * concept. A rule of this form:
 *
 *     a: C :- P0, P2, ... Pn.
 *
 * is turned into a series of rule n+1 rules, each with either one or two premises:
 *
 *     $a1 <vars> :- $a0, P0.
 *     ...
 *     $a(i+1) <vars> :- $ai <vars>, Pi.
 *     ...
 *     C :- $a(n+1).
 */

export type BinarizedPremise =
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

export function freeVarsBinarizedPremise(premise: BinarizedPremise): Set<string> {
  switch (premise.type) {
    case 'Equality':
    case 'Inequality':
      return freeVars(premise.a, premise.b);
    case 'Proposition':
      return freeVars(...premise.args, premise.value);
  }
}

export type BinarizedRule =
  | {
      type: 'Binary';
      premise: BinarizedPremise;
      inName: string;
      inVars: string[];
      outName: string;
      outVars: string[];
      premiseNumber: number;
      totalPremises: number;
    }
  | {
      type: 'Conclusion';
      inName: string;
      inVars: string[];
      name: string;
      args: Pattern[];
      values: Pattern[];
      exhaustive: boolean;
    };

export interface BinarizedProgram {
  seeds: string[];
  rules: BinarizedRule[];
  forbids: string[];
  demands: string[];
}

function binarizedPremiseToString(premise: BinarizedPremise): string {
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

function binarizedRuleToString(rule: BinarizedRule): string {
  switch (rule.type) {
    case 'Binary':
      return `$${rule.outName}${rule.outVars.map((v) => ` ${v}`).join('')} :- $${
        rule.inName
      }${rule.inVars.map((v) => ` ${v}`).join('')}, ${binarizedPremiseToString(rule.premise)}.`;
    case 'Conclusion':
      return `${rule.name}${rule.args
        .map((arg) => ` ${termToString(arg)}`)
        .join('')} is { ${rule.values.map((arg) => termToString(arg)).join(', ')}${
        rule.exhaustive ? '' : '?'
      } } :- $${rule.inName}${rule.inVars.map((v) => ` ${v}`).join('')}.`;
  }
}

export function binarizedProgramToString(program: BinarizedProgram) {
  return `Initial seeds: ${program.seeds.map((name) => `$${name}`).join(', ')}
Demands to derive: ${program.demands.map((name) => `$${name}`).join(', ')}
Forbids to derive: ${program.forbids.map((name) => `$${name}`).join(', ')}
Rules:
${program.rules.map((rule) => binarizedRuleToString(rule)).join('\n')}`;
}

function binarizePremises(
  name: string,
  premises: Premise[],
): {
  seed: string;
  conclusion: string;
  newRules: BinarizedRule[];
  carriedVars: string[];
} {
  const knownFreeVars = new Set<string>();
  const knownCarriedVars: string[] = [];
  const totalPremises = premises.length;
  const newRules = premises.map((premise, premiseNumber): BinarizedRule => {
    const inName = `${name}${premiseNumber}`;
    const outName = `${name}${premiseNumber + 1}`;
    switch (premise.type) {
      case 'Inequality': {
        return {
          type: 'Binary',
          premise,
          inName,
          inVars: [...knownCarriedVars],
          outName,
          outVars: [...knownCarriedVars],
          premiseNumber,
          totalPremises,
        };
      }

      case 'Equality': {
        const inVars = [...knownCarriedVars];
        for (const v of freeVars(premise.b)) {
          if (!knownFreeVars.has(v)) {
            knownCarriedVars.push(v);
            knownFreeVars.add(v);
          }
        }

        return {
          type: 'Binary',
          premise,
          inName,
          inVars,
          outName,
          outVars: [...knownCarriedVars],
          premiseNumber,
          totalPremises,
        };
      }

      case 'Proposition': {
        const newPremise: BinarizedPremise = {
          ...premise,
          value: premise.value ?? { type: 'triv' },
        };
        const inVars = [...knownCarriedVars];
        for (const v of freeVars(...newPremise.args, newPremise.value)) {
          if (!knownFreeVars.has(v)) {
            knownCarriedVars.push(v);
            knownFreeVars.add(v);
          }
        }
        return {
          type: 'Binary',
          premise: newPremise,
          inName,
          inVars,
          outName,
          outVars: [...knownCarriedVars],
          premiseNumber,
          totalPremises,
        };
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
  const rules: BinarizedRule[] = [];
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
        rules.push(...newRules, {
          type: 'Conclusion',
          inName: conclusion,
          inVars: carriedVars,
          name: decl.conclusion.name,
          args: decl.conclusion.args,
          values: decl.conclusion.values ?? [{ type: 'triv' }],
          exhaustive: decl.conclusion.exhaustive,
        });
      }
    }
  }

  return { seeds, rules, forbids, demands };
}
