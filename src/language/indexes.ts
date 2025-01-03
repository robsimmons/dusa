import {
  BinarizedProgram,
  BinarizedRule,
  JoinRule,
  UnaryRule,
  freeVarsConclusion,
  joinVars,
  usedPremiseVars,
} from './binarize.js';
import { Pattern } from './terms.js';
import { Pattern as Shape } from '../bytecode.js';
import { patternsToShapes, shapesEqual, shapesToPatterns } from './shape.js';
import { setDifference, setUnion, subsetEq } from '../util/polyfill.js';

/**
 * An IndexMap contains partial information about the indices needed for each
 * predicate that appears in a premise.
 *
 * A binary rule like this:
 *
 *     ... :- $p X Y Z, a X Y 17 X Z W
 *
 * means that we need an index with the *shape*
 *
 *     a #0 #1 17 #0 #2 #3
 *
 * processing
 *
 *     @p-4 X Y Z W :- @p-3 X Y Z, a X Y 17 (h X W) V
 *
 * leads to the index constraints that X and Y must come first, and W must
 * come later before anything else. That looks like this:
 *
 *     { args: ..., order: [ {X Y}, {X, Y, W} ] }
 *
 * Then processing
 *
 *     @q-3 X Y Z W :- @q-2 Y Z, a X Y 17 (h X W) V.
 *
 * will modify this constraint with the extra information that X needs to come
 * before Y:
 *
 *     { args: ..., order: [ {Y}, {X, Y}, {X, Y, W} ] }
 *
 * then processing
 *
 *     @r-5 X Y W V :- @r-4 X Y W, a X Y 17 (h X W) V.
 *
 * will modify this constraint with the fact that after X, Y, and W, V should
 * be added before anything else:
 *
 *     { args: ..., order: [ {Y}, {X, Y}, {X, Y, W}, {X, Y, W, V} ] }
 *
 * This rule has an incompatible ordering, despite having the same shape:
 *
 *     @s-4 V Q X W :- @s-3 V Q, a X Y 17 (h X W) V.
 *
 * so will lead to a second indexspec being added for the same shape.
 *
 *     { args: ..., order: [ {Y}, {X, Y}, {X, Y, W}, {X, Y, W, V} ] }
 *     { args: ..., order: [ {V}, {X, W, V} ]}
 */
type IndexMap = Map<string, IndexSpec[]>;
type Constraint = Set<number>[];
type IndexSpec = {
  args: Shape[];
  order: Constraint;
  identity: { pred: string; vars: number[] } | { pred: null; varsKnown: string[] };
};

function defaultIndices(pred: string, args: number): IndexSpec {
  const arr = [];
  const vars = [];
  const result = [];
  for (let i = 0; i < args; i++) {
    arr.push(i);
    vars.push(i);
    result.push(new Set(arr));
  }
  return {
    args: result.map((_, i) => ({ type: 'var', ref: i })),
    order: result,
    identity: { pred, vars },
  };
}

function partitionIfPossible(ordering: Constraint, first: Set<number>, extensible: boolean) {
  if (first.size === 0) return ordering;
  for (let i = 0; i < ordering.length; i++) {
    if (subsetEq(ordering[i], first)) {
      if (subsetEq(first, ordering[i])) return ordering;
      continue;
    }
    // We've reached the smallest set in the order that's _not_ smaller than
    // first. if it's a superset of first, we can succeed by further
    // constraining the order. example: ordering is [[a], [a,b,c,d]] and first
    // is [a,d], we'll hit this condition on i = 1 and need to return [[a], [a,d], [a,b,c,d]]
    if (subsetEq(first, ordering[i])) {
      return [...ordering.slice(0, i), first, ...ordering.slice(i)];
    }

    // Otherwise, this partially-constrained ordering is inconsistent with an
    // order that puts all the elements in `first` first. For example,
    // ordering is [[a], [a,d], [a,b,c,d]] and first is [a,c,b]: we'll hit
    // this condition on i = 1 and there's no way to satisfy the ordering.
    return null;
  }

  // This case can't be encountered unless there's an index we're only using
  // partially, like if we know `c X X Y :- p _ X Y`, we can use c/1 but not
  // c/2 or c/3 as an index for p. Because all user-defined predicates can be
  // extended, we never do this optimization so never take this if-statement.

  /* istanbul ignore next */
  if (!extensible) throw new Error('I should probably return null here');
  return [...ordering, first];
}

/**
 * Takes an index spec and checks if that spec (or a more refined version of
 * that spec) is suitable for a given rule. Returns null if the spec is not
 * suitable, returns the (possibly refined) index spec otherwise.
 *
 * Precondition: the index spec is actually an index spec for the main premise
 * of this rule. (This means index.args.length === rule.premise.args.length)
 */
function refineIfPossible(index: IndexSpec, rule: JoinRule): IndexSpec | null {
  const { shapes, varsKnown } = patternsToShapes(rule.premise.args);

  // shared vars: all the variables used in both premises
  const shared: Set<number> = new Set([...joinVars(rule)].map((x) => varsKnown.indexOf(x)!));

  // needed vars: all the variables in the second premise that appear in the
  // conclusion
  const needed = [...freeVarsConclusion(rule.conclusion)]
    .map((x) => varsKnown.indexOf(x))
    .filter((x): x is number => x !== -1);

  // used = shared or needed
  const used = setUnion(shared, new Set(needed));

  if (!index.args.every((arg, i) => shapesEqual(arg, shapes[i]))) return null;

  const order1 = partitionIfPossible(index.order, shared, index.identity.pred === null);
  if (order1 === null) return null;
  const order2 = partitionIfPossible(order1, used, index.identity.pred === null);
  if (order2 === null) return null;

  return { ...index, order: order2 };
}

function isAlwaysClosed(program: BinarizedProgram, pred: string) {
  for (const rule of program.rules) {
    if (rule.conclusion.name === pred && rule.conclusion.type === 'open') return false;
  }
  return true;
}

function learnNeededIndices(program: BinarizedProgram): IndexMap {
  // Find every regular predicate used in a premise
  const maxArgs = new Map<string, number>();
  for (const rule of program.rules) {
    if (rule.type === 'Join') {
      const name = rule.premise.name;
      const numArgs = rule.premise.args.length;
      maxArgs.set(name, Math.max(numArgs, maxArgs.get(name) ?? 0));
    }
  }

  // Add the default index-you-get-for-free for every predicate that can't
  // include negative information (we don't use predicates with negative
  // information as indices, because if `a 4 2 |-> noneOf { 1,2,3 }` we don't
  // want that to indicate support for `a 4`.
  const learnedSpecs = new Map<string, IndexSpec[]>();
  for (const [pred, arity] of maxArgs) {
    if (isAlwaysClosed(program, pred)) {
      learnedSpecs.set(pred, [defaultIndices(pred, arity)]);
    } else {
      learnedSpecs.set(pred, []);
    }
  }

  // Ensure that there's a spec for every rule
  for (const rule of program.rules) {
    if (rule.type === 'Join') {
      const indices = learnedSpecs.get(rule.premise.name)!;
      const { shapes, varsKnown } = patternsToShapes(rule.premise.args);

      let success = false;
      for (const [i, index] of indices.entries()) {
        if (success) continue;
        const refinedIndex = refineIfPossible(index, rule);
        if (refinedIndex !== null) {
          indices[i] = refinedIndex;
          success = true;
        }
      }

      if (!success) {
        // No indexes are compatible, a new index is needed
        const shared = new Set([...joinVars(rule)].map((x) => varsKnown.indexOf(x)!));
        const used = new Set([...usedPremiseVars(rule)].map((x) => varsKnown.indexOf(x)!));

        indices.push({
          args: shapes,
          order: shared.size === 0 ? [used] : shared.size === used.size ? [shared] : [shared, used],
          identity: { pred: null, varsKnown },
        });
      }
    }
  }

  return learnedSpecs;
}

function finalizeIndices(pred: string, specs: IndexSpec[]) {
  const newPreds: string[] = [];
  const newSpecs: IndexSpec[] = [];
  const newRules: UnaryRule[] = [];

  for (const [i, indexSpec] of specs.entries()) {
    if (indexSpec.identity.pred !== null) {
      newSpecs.push(indexSpec);
      continue;
    }
    const argVars: number[] = [];
    const order: Constraint = [];
    for (const varSet of indexSpec.order) {
      for (const x of setDifference(varSet, new Set(argVars))) {
        argVars.push(x);
        order.push(new Set(argVars));
      }
    }
    const newPred = `$${pred}-${i}`;
    newPreds.push(newPred);
    newSpecs.push({ args: indexSpec.args, order, identity: { pred: newPred, vars: argVars } });
    newRules.push({
      type: 'Unary',
      premise: { name: pred, args: shapesToPatterns(indexSpec.args) },
      conclusion: {
        type: 'datalog',
        name: newPred,
        args: argVars.map((argVar) => ({ type: 'var', name: `#${argVar}` })),
      },
    });
  }

  return { newPreds, finalizedSpecs: newSpecs, newRules };
}

export function generateIndices(program: BinarizedProgram): BinarizedProgram {
  const feasibleIndexMap = learnNeededIndices(program);
  const finalizedIndexMap: IndexMap = new Map();
  const rules: BinarizedRule[] = [];
  for (const [pred, specs] of feasibleIndexMap.entries()) {
    const { finalizedSpecs, newRules } = finalizeIndices(pred, specs);
    rules.push(...newRules);
    finalizedIndexMap.set(pred, finalizedSpecs);
  }
  for (const rule of program.rules) {
    if (rule.type === 'Unary' || rule.type === 'Builtin') {
      rules.push(rule);
    } else {
      const indices = finalizedIndexMap.get(rule.premise.name)!;
      for (const index of indices) {
        if (refineIfPossible(index, rule) && index.identity.pred !== null) {
          const { varsKnown } = patternsToShapes(rule.premise.args);
          const args: Pattern[] = index.identity.vars
            .slice(0, usedPremiseVars(rule).size)
            .map((x) => ({ type: 'var', name: varsKnown[x] }));

          rules.push({
            type: 'Join',
            inName: rule.inName,
            inVars: rule.inVars,
            conclusion: rule.conclusion,
            premise: { name: index.identity.pred, args },
          });
          break;
        }
        // Danger! If we exit this loop without ever breaking then the program
        // is definitely wrong. (But we shouldn't be able to ever exit the
        // loop without breaking, because we've ensured that there's a pattern
        // that can match every premise.)
      }
    }
  }

  return { ...program, rules };
}
