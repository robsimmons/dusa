import { BUILT_IN_PRED } from './dusa-builtins.js';
import { FlatDeclaration, FlatPremise } from './flatten.js';
import { headToString, Conclusion as RawConclusion } from './syntax.js';
import { Pattern, freeVars, termToString } from './terms.js';

export type Conclusion =
  | { type: 'intermediate'; name: string; vars: string[] }
  | { type: 'datalog'; name: string; args: Pattern[] }
  | { type: 'open'; name: string; args: Pattern[]; choices: Pattern[] }
  | { type: 'closed'; name: string; args: Pattern[]; choices: Pattern[] };

export function freeVarsConclusion(conc: Conclusion) {
  if (conc.type === 'intermediate') return new Set(conc.vars);
  if (conc.type === 'datalog') return freeVars(...conc.args);
  return freeVars(...conc.args, ...conc.choices);
}

function concToString(conc: Conclusion): string {
  if (conc.type === 'intermediate') {
    return `@${conc.name}${conc.vars.map((x) => ` ${x}`).join('')}`;
  }
  return headToString(conc);
}

export interface UnaryRule {
  type: 'Unary';
  premise: { name: string; args: Pattern[] };
  conclusion: Conclusion;
}

/**
 * The joinVars array contains the variables shared between
 * the premise and conclusion.
 */
export interface JoinRule {
  type: 'Join';
  inName: string;
  inVars: string[];
  premise: { name: string; args: Pattern[] };
  conclusion: Conclusion;
}

export interface BuiltinRule {
  type: 'Builtin';
  inName: string;
  inVars: string[];
  premise:
    | { name: BUILT_IN_PRED; args: Pattern[]; value: Pattern }
    | { name: 'Equality' | 'Inequality' | 'Geq' | 'Gt' | 'Leq' | 'Lt'; args: [Pattern, Pattern] };
  conclusion: Conclusion;
}

export type BinarizedRule = UnaryRule | JoinRule | BuiltinRule;

/** Variables used in both premises of a join rule.
 * Enumeration ordering is the order that variables appear in the _premise_.
 */
export function joinVars(rule: JoinRule) {
  const inVars = new Set(rule.inVars);
  const premiseVars = freeVars(...rule.premise.args);

  // We have to do the intersection operation by hand to get the enumeration order correct
  const result: Set<string> = new Set();
  for (const x of premiseVars) {
    if (inVars.has(x)) {
      result.add(x);
    }
  }

  return result;
}

/** Variables in a premise that are used elsewhere: either as a join var or in the conclusion */
export function usedPremiseVars(rule: JoinRule) {
  const premiseVars = freeVars(...rule.premise.args);
  const conclusionVars = freeVarsConclusion(rule.conclusion);
  return joinVars(rule).union(premiseVars.intersection(conclusionVars));
}

function binopToString(binOp: 'Equality' | 'Inequality' | 'Gt' | 'Geq' | 'Lt' | 'Leq') {
  switch (binOp) {
    case 'Equality':
      return '==';
    case 'Inequality':
      return '!=';
    case 'Geq':
      return '>=';
    case 'Gt':
      return '>';
    case 'Leq':
      return '<=';
    case 'Lt':
      return '<';
  }
}

function binarizedRuleToString(rule: BinarizedRule) {
  switch (rule.type) {
    case 'Unary': {
      const args = rule.premise.args.map((arg) => ` ${termToString(arg)}`).join('');
      return `${concToString(rule.conclusion)} :- ${rule.premise.name}${args}.`;
    }
    case 'Join': {
      return `${concToString(rule.conclusion)} :- @${rule.inName}${rule.inVars
        .map((x) => ` ${x}`)
        .join('')}, ${rule.premise.name}${rule.premise.args
        .map((arg) => ` ${termToString(arg)}`)
        .join('')}.`;
    }
    case 'Builtin': {
      const main = `${concToString(rule.conclusion)} :- @${rule.inName}${rule.inVars
        .map((x) => ` ${x}`)
        .join('')}, `;
      switch (rule.premise.name) {
        case 'Equality':
        case 'Inequality':
        case 'Geq':
        case 'Gt':
        case 'Leq':
        case 'Lt':
          return `${main}${termToString(rule.premise.args[0])} ${binopToString(rule.premise.name)} ${termToString(rule.premise.args[1])}.`;
        default:
          return `${main}.${rule.premise.name}${rule.premise.args
            .map((arg) => ` ${termToString(arg)}`)
            .join('')} is ${termToString(rule.premise.value)}.`;
      }
    }
  }
}

export interface BinarizedProgram {
  seeds: string[];
  forbids: string[];
  demands: string[];
  rules: BinarizedRule[];
}

export function binarizedProgramToString({ seeds, forbids, demands, rules }: BinarizedProgram) {
  return (
    (seeds.length === 0 ? '' : `seeds: ${seeds.join(', ')}\n`) +
    (demands.length === 0 ? '' : `#demand: ${demands.map((name) => `@${name}`).join(', ')}\n`) +
    (forbids.length === 0 ? '' : `#forbid: ${forbids.map((name) => `@${name}`).join(', ')}\n`) +
    `rules:\n` +
    rules.map((rule) => binarizedRuleToString(rule)).join('\n')
  );
}

/** Simplifies FlatPremise further:
 *
 *  - Once we're expressing things in terms of joins, we don't care about the arg/value distinction
 *  - Location information is no longer needed
 */
type Premise =
  | {
      type: 'builtin';
      name: 'Equality' | 'Inequality' | 'Geq' | 'Gt' | 'Leq' | 'Lt';
      args: [Pattern, Pattern];
    }
  | { type: 'builtin'; name: BUILT_IN_PRED; args: Pattern[]; value: Pattern }
  | { type: 'fact'; name: string; args: Pattern[] };

function freeVarsPremise(premise: Premise) {
  if (premise.type === 'builtin') {
    switch (premise.name) {
      case 'Equality':
      case 'Inequality':
      case 'Geq':
      case 'Gt':
      case 'Leq':
      case 'Lt':
        return freeVars(...premise.args);
      default:
        return freeVars(...premise.args, premise.value);
    }
  }
  return freeVars(...premise.args);
}

/**
 * We need to do a basic dataflow analysis to capture the variables carried by the
 * intermediate prefix predicates.
 *
 *  - freeVar N X holds for every var in the Nth premise
 *  - ground N X holds for every var in the Nth premise that was previously defined
 *  - introduced N X holds for every var that appears for the first time in the Nth premise
 *  - live N X holds for every variable "live in" to the Nth premise: just as
 *    in regular liveness analysis, a variable is "live in" at N if it's used at N,
 *    or if it's live afterwards and not defined at N.
 *
 * The live-in variables are precisely the inVars carried by the intermediate prefix predicates.
 */
function premisesAnnotated(
  flatPremises: FlatPremise[],
  liveOut: Set<string>,
): {
  premise: Premise;
  inVars: string[];
  joinVars: string[];
}[] {
  const premises = flatPremises.map<Premise>((premise: FlatPremise): Premise => {
    if (premise.type === 'builtin') {
      switch (premise.name) {
        case 'Equality':
        case 'Inequality':
        case 'Geq':
        case 'Gt':
        case 'Leq':
        case 'Lt':
          return { type: 'builtin', name: premise.name, args: premise.args };
        default:
          return { type: 'builtin', name: premise.name, args: premise.args, value: premise.value };
      }
    }
    return {
      type: 'fact',
      name: premise.name,
      args: premise.value === null ? premise.args : [...premise.args, premise.value],
    };
  });

  // ground (N + 1) X :- freeVar N X
  // ground (N + 1) X :- ground N X
  // introduced N X :- freeVar N X, !ground N X
  let ground: Set<string> = new Set();
  const premisesGround: {
    premise: Premise;
    freeVars: Set<string>;
    introduced: Set<string>;
  }[] = [];
  for (const premise of premises) {
    const used = freeVarsPremise(premise);
    premisesGround.push({ premise, freeVars: used, introduced: used.difference(ground) });
    ground = ground.union(used);
  }

  // live N X :- freeVar N X
  // live N X :- live (N + 1) X, !introduced N X
  let live: Set<string> = new Set(liveOut);
  const premisesAnnotated: {
    premise: Premise;
    inVars: string[];
    joinVars: string[];
  }[] = [];
  for (const { premise, freeVars, introduced } of premisesGround.toReversed()) {
    live = live.union(freeVars).difference(introduced);
    premisesAnnotated.push({
      premise,
      inVars: [...live],
      joinVars: [...freeVars.intersection(live)],
    });
  }

  return premisesAnnotated.toReversed();
}

/**
 * Perform the binarization transformation, straightforward in implementation and
 * concept. A uniquely-named rule of this form:
 *
 *     a: C :- P0, P2, ... Pn.
 *
 * is turned into a series of rule n rules, each with either one or two premises:
 *
 *     $a-1 <vars1> :- P0.
 *     $a-2 <vars2> :- $a-1 <vars1>
 *     ...
 *     $a-n <varsn> :- $a-(n-1) <vars(n-1)>, P(n-1).
 *     C :- $a-n <varsn>, Pn.
 *
 * The first premise of every introduced rule is an introduced predicate, and each introduced
 * predicate only appears as a *premise* of a single rule and only appears as the *conclusion*
 * of a single (different) rule.
 */
export function binarize(decls: { name: string; decl: FlatDeclaration }[]): BinarizedProgram {
  let hasSeed: boolean = false;
  const rules: BinarizedRule[] = [];
  const forbids: string[] = [];
  const demands: string[] = [];

  for (const { name, decl } of decls) {
    // Calculate the rule conclusion and the 'live out' vars used in the conclusion
    let conclusion: Conclusion;
    let conclusionUsedVars: Set<string>;
    switch (decl.type) {
      case 'Forbid':
        conclusion = { type: 'intermediate', name, vars: [] };
        conclusionUsedVars = new Set();
        forbids.push(name);
        break;
      case 'Demand':
        conclusion = { type: 'intermediate', name, vars: [] };
        conclusionUsedVars = new Set();
        demands.push(name);
        break;
      case 'Rule':
        conclusion = simplifyConclusion(decl.conclusion);
        conclusionUsedVars = freeVars(
          ...decl.conclusion.args,
          ...(decl.conclusion.type === 'datalog' ? [] : decl.conclusion.choices),
        );
        break;
    }

    if (decl.premises.length === 0) {
      // Edge case: in order to make this a binary rule, add a seed.
      hasSeed = true;
      rules.push({
        type: 'Unary',
        premise: { name: `$seed`, args: [] },
        conclusion,
      });
      continue;
    }

    const premises = premisesAnnotated(decl.premises, conclusionUsedVars);

    // All the rules except the _first_ one are uniform binary rules
    const newRules: BinarizedRule[] = [];
    for (let i = premises.length - 1; i >= 1; i--) {
      const { premise, inVars } = premises[i];
      const inName = `${name}-${i}`;
      if (premise.type === 'builtin') {
        switch (premise.name) {
          case 'Equality':
          case 'Inequality':
          case 'Geq':
          case 'Gt':
          case 'Leq':
          case 'Lt':
            newRules.push({
              type: 'Builtin',
              inName,
              inVars,
              premise: { name: premise.name, args: premise.args },
              conclusion,
            });
            break;

          default:
            newRules.push({
              type: 'Builtin',
              inName,
              inVars,
              premise: { name: premise.name, args: premise.args, value: premise.value },
              conclusion,
            });
            break;
        }
      } else {
        newRules.push({
          type: 'Join',
          inName,
          inVars,
          premise: { name: premise.name, args: premise.args },
          conclusion,
        });
      }
      conclusion = { type: 'intermediate', name: inName, vars: inVars };
    }

    // Handle the first premise
    const { premise } = premises[0];
    if (premise.type === 'fact') {
      // Happy path: rule dealing with the first premise is unary
      rules.push({
        type: 'Unary',
        premise: { name: premise.name, args: premise.args },
        conclusion,
      });
    } else {
      // Edge case: first premise is computed, requiring a binary rule
      hasSeed = true;
      const inName = `${name}-0`;
      rules.push({
        type: 'Unary',
        premise: { name: `$seed`, args: [] },
        conclusion: { type: 'intermediate', name: inName, vars: [] },
      });
      switch (premise.name) {
        case 'Equality':
        case 'Inequality':
        case 'Geq':
        case 'Gt':
        case 'Leq':
        case 'Lt':
          rules.push({
            type: 'Builtin',
            inName,
            inVars: [],
            premise: { name: premise.name, args: premise.args },
            conclusion,
          });
          break;
        default:
          rules.push({
            type: 'Builtin',
            inName,
            inVars: [],
            premise: { name: premise.name, args: premise.args, value: premise.value },
            conclusion,
          });
          break;
      }
    }

    // Cosmetic: puts the rules in the program in a clearer order
    rules.push(...newRules.toReversed());
  }

  return { seeds: hasSeed ? ['$seed'] : [], rules, forbids, demands };
}

/** Helper to remove unnecessary fields from RawConclusion */
function simplifyConclusion(conc: RawConclusion): Conclusion {
  switch (conc.type) {
    case 'datalog':
      return { type: 'datalog', name: conc.name, args: conc.args };
    case 'open':
      return { type: 'open', name: conc.name, args: conc.args, choices: conc.choices };
    case 'closed':
      return { type: 'closed', name: conc.name, args: conc.args, choices: conc.choices };
  }
}

/**
 * Permutes the arguments to intermediate predicates so that rules like this:
 *
 *    @path-1 X Y :- edge X Y.
 *    @path-2 X Z :- @path-1 X Y, path Y Z.
 *
 * become rules like this, where shared variables appear in the order specified by the join order:
 *
 *    @path-1 Y X :- edge X Y.
 *    @path-2 X Z :- @path-1 Y X, path Y Z.
 *
 * This is not possible for all binarized programs: consider
 *
 *    @path-1 X Y :- edge X Y.
 *    @path-2 X Z :- @path-1 X Y, path Y Z.
 *    @path-3 Y Z :- @path-1 X Y, path X Z.
 *
 * so this relies on every intermediate predicate with a non-trivial join
 * appearing only once as a premise.
 */
export function makeIntermediatePredicatesMatchJoinOrder(program: BinarizedProgram) {
  const permutationMap: Map<string, number[]> = new Map();
  function getPermutation(intermediatePredicate: string) {
    const mapping = permutationMap.get(intermediatePredicate);
    if (mapping === undefined)
      throw new Error(
        `In BinarizedProgram, @${intermediatePredicate} is not the premise of some rule`,
      );
    return mapping;
  }

  // Insert necessary permutations into the permutationMap
  for (const name of program.seeds) permutationMap.set(name, []);
  for (const name of program.forbids) permutationMap.set(name, []);
  for (const name of program.demands) permutationMap.set(name, []);
  for (const rule of program.rules) {
    if (rule.type === 'Join' || rule.type === 'Builtin') {
      let newOrdering;

      // Leaves the ordering alone if it's a builtin intermediate
      if (rule.type === 'Join') {
        const joinVars_ = joinVars(rule);
        const inVars = new Set(rule.inVars);
        newOrdering = [...joinVars_, ...inVars.difference(joinVars_)];
      } else {
        newOrdering = rule.inVars;
      }
      const permutation = newOrdering.map((x) => rule.inVars.indexOf(x));

      const existingMapping = permutationMap.get(rule.inName);
      if (existingMapping !== undefined && existingMapping.length > 0) {
        throw new Error(
          `Precondition violation for permuteIntroduced: @${rule.inName} has arguments but appears more than once`,
        );
      }
      permutationMap.set(rule.inName, permutation);
    }
  }

  // Apply permutations across program
  const rules = program.rules.map((oldRule) => {
    const rule = { ...oldRule }; // shallow copy

    if (rule.conclusion.type === 'intermediate') {
      const permutation = getPermutation(rule.conclusion.name);
      const oldVars = rule.conclusion.vars;
      rule.conclusion.vars = rule.conclusion.vars.map((_, i) => oldVars[permutation[i]]);
    }

    if (rule.type === 'Join' || rule.type === 'Builtin') {
      const permutation = getPermutation(rule.inName);
      const oldVars = rule.inVars;
      rule.inVars = rule.inVars.map((_, i) => oldVars[permutation[i]]);
    }
    return rule;
  });

  return { ...program, rules };
}

/** Testing function: checks the expected postcondition of makeIntermediatePredicatesMatchJoinOrder() */
export function hasWellOrderedIntermediatePredicateArguments(program: BinarizedProgram) {
  for (const rule of program.rules) {
    if (rule.type === 'Join') {
      for (const [i, x] of [...joinVars(rule)].entries()) {
        if (x !== rule.inVars[i]) return false;
      }
    }
  }
  return true;
}
