import { test, expect } from 'vitest';
import {
  binarize,
  binarizedProgramToString,
  BinarizedProgram,
  makeIntermediatePredicatesMatchJoinOrder,
  hasWellOrderedIntermediatePredicateArguments,
} from './binarize.js';
import { flattenDecls } from './flatten.js';
import { parse } from './dusa-parser.js';
import { BUILT_IN_PRED } from './dusa-builtins.js';
import { check } from './check.js';
import { ParsedDeclaration } from './syntax.js';
import { Pattern } from './terms.js';

export function srcToBinarized(source: string) {
  const parsed = parse(source);
  if (parsed.errors !== null) throw parsed.errors;
  const { errors, arities, builtins } = check(parsed.document);
  if (errors.length !== 0) throw errors;
  const decls = parsed.document.filter((x): x is ParsedDeclaration => x.type !== 'Builtin');
  const flattened = flattenDecls(
    new Map([
      ...[...builtins.entries()].map<[string, BUILT_IN_PRED]>(([name, builtin]) => [name, builtin]),
      ...[...arities.keys()].map<[string, undefined]>((name) => [name, undefined]),
    ]),
    decls,
  );
  const nameMap = new Map();
  function nextName(str: string) {
    const count = nameMap.get(str);
    if (count === undefined) {
      nameMap.set(str, 2);
      return `${str}-1`;
    } else {
      nameMap.set(str, count + 1);
      return `${str}-${count}`;
    }
  }
  const named = flattened.map((decl) => ({
    decl,
    name: decl.type === 'Rule' ? nextName(decl.conclusion.name) : nextName(decl.type),
  }));
  return binarize(named);
}

test(`simple binarization test`, () => {
  const program = srcToBinarized(`
b 4 is "hello".
d 4 is? "goodbye".
a X Y :- b X is Y.
c X Y :- a X Y, b Y is Z, X == Z.
        `);
  expect(binarizedProgramToString(program)).toStrictEqual(`seeds: $seed
rules:
b 4 is "hello" :- $seed.
d 4 is? "goodbye" :- $seed.
a X Y :- b X Y.
@c-1-1 X Y :- a X Y.
@c-1-2 X Y Z :- @c-1-1 X Y, b Y Z.
c X Y :- @c-1-2 X Y Z, X == Z.`);

  expect(
    hasWellOrderedIntermediatePredicateArguments(makeIntermediatePredicatesMatchJoinOrder(program)),
  ).toStrictEqual(true);
});

test(`forbid and demand test`, () => {
  const program = srcToBinarized(`
#forbid a X Y, b Y Z, c X.
#demand a X Y, b Y Z, c Z.`);

  expect(binarizedProgramToString(program)).toStrictEqual(`#demand: @Demand-1
#forbid: @Forbid-1
rules:
@Forbid-1-1 X Y :- a X Y.
@Forbid-1-2 X :- @Forbid-1-1 X Y, b Y Z.
@Forbid-1 :- @Forbid-1-2 X, c X.
@Demand-1-1 Y :- a X Y.
@Demand-1-2 Z :- @Demand-1-1 Y, b Y Z.
@Demand-1 :- @Demand-1-2 Z, c Z.`);

  expect(
    hasWellOrderedIntermediatePredicateArguments(makeIntermediatePredicatesMatchJoinOrder(program)),
  ).toStrictEqual(true);
});

test(`some binarization edge cases`, () => {
  const program = srcToBinarized(`
#builtin NAT_SUCC s
a :- 4 == 3.
b :- c (s 3).`);

  expect(binarizedProgramToString(program)).toStrictEqual(`seeds: $seed
rules:
@a-1-0 :- $seed.
a :- @a-1-0, 4 == 3.
@b-1-0 :- $seed.
@b-1-1 #1 :- @b-1-0, .NAT_SUCC 3 is #1.
b :- @b-1-1 #1, c #1.`);

  expect(
    hasWellOrderedIntermediatePredicateArguments(makeIntermediatePredicatesMatchJoinOrder(program)),
  ).toStrictEqual(true);
});

test(`binarizing edgepath`, () => {
  const program = srcToBinarized(`
path Y X :- edge X Y.
path Z X :- edge X Y, path X Z, prop Y.`);

  expect(binarizedProgramToString(program)).toStrictEqual(`rules:
path Y X :- edge X Y.
@path-2-1 X Y :- edge X Y.
@path-2-2 Z X Y :- @path-2-1 X Y, path X Z.
path Z X :- @path-2-2 Z X Y, prop Y.`);

  expect(
    hasWellOrderedIntermediatePredicateArguments(makeIntermediatePredicatesMatchJoinOrder(program)),
  ).toStrictEqual(true);
});

test(`join vars in the right order`, () => {
  const program = srcToBinarized(`
b :- a X Y Z, c Z A A Z X, d A B C X, e Z Z Z A B.`);

  expect(binarizedProgramToString(program)).toStrictEqual(`rules:
@b-1-1 Z X :- a X Y Z.
@b-1-2 Z A X :- @b-1-1 Z X, c Z A A Z X.
@b-1-3 Z A B :- @b-1-2 Z A X, d A B C X.
b :- @b-1-3 Z A B, e Z Z Z A B.`);
  expect(hasWellOrderedIntermediatePredicateArguments(program)).toStrictEqual(false);

  expect(binarizedProgramToString(makeIntermediatePredicatesMatchJoinOrder(program)))
    .toStrictEqual(`rules:
@b-1-1 Z X :- a X Y Z.
@b-1-2 A X Z :- @b-1-1 Z X, c Z A A Z X.
@b-1-3 Z A B :- @b-1-2 A X Z, d A B C X.
b :- @b-1-3 Z A B, e Z Z Z A B.`);

  expect(
    hasWellOrderedIntermediatePredicateArguments(makeIntermediatePredicatesMatchJoinOrder(program)),
  ).toStrictEqual(true);
});

const x: Pattern = { type: 'var', name: 'X' };
const y: Pattern = { type: 'var', name: 'Y' };
const z: Pattern = { type: 'var', name: 'Z' };
const w: Pattern = { type: 'var', name: 'W' };
const v: Pattern = { type: 'var', name: 'V' };
const q: Pattern = { type: 'var', name: 'Q' };
const p: Pattern = { type: 'var', name: 'P' };

test(`Bespoke input test`, () => {
  const program: BinarizedProgram = {
    seeds: [],
    forbids: [],
    demands: [],
    rules: [
      {
        type: 'Unary',
        premise: { name: 'b', args: [w, x, z] },
        conclusion: { type: 'intermediate', name: 'r-1', vars: ['W', 'X', 'Z'] },
      },
      {
        type: 'Join',
        inName: 'r-1',
        inVars: ['W', 'X', 'Z'],
        premise: { name: 'c', args: [z, x, y, v, q] },
        conclusion: { type: 'intermediate', name: 'r-2', vars: ['W', 'X', 'Z', 'Y', 'V'] },
      },
      {
        type: 'Join',
        inName: 'r-2',
        inVars: ['W', 'X', 'Z', 'Y', 'V'],
        premise: { name: 'd', args: [w, z, p, v, v] },
        conclusion: { name: 'a', args: [x, y, z, w, v], type: 'datalog' },
      },
    ],
  };

  expect(binarizedProgramToString(program)).toStrictEqual(
    `rules:
@r-1 W X Z :- b W X Z.
@r-2 W X Z Y V :- @r-1 W X Z, c Z X Y V Q.
a X Y Z W V :- @r-2 W X Z Y V, d W Z P V V.`,
  );
  expect(hasWellOrderedIntermediatePredicateArguments(program)).toStrictEqual(false);

  expect(binarizedProgramToString(makeIntermediatePredicatesMatchJoinOrder(program))).toStrictEqual(
    `rules:
@r-1 Z X W :- b W X Z.
@r-2 W Z V X Y :- @r-1 Z X W, c Z X Y V Q.
a X Y Z W V :- @r-2 W Z V X Y, d W Z P V V.`,
  );

  expect(
    hasWellOrderedIntermediatePredicateArguments(makeIntermediatePredicatesMatchJoinOrder(program)),
  ).toStrictEqual(true);
});

test(`makeIntermediatePredicatesMatchJoinOrder precondition violations`, () => {
  let program: BinarizedProgram;

  program = {
    seeds: [],
    demands: [],
    forbids: [],
    rules: [
      {
        type: 'Join',
        inName: 'p',
        inVars: [],
        premise: { name: 'q', args: [] },
        conclusion: { type: 'intermediate', name: 'r', vars: [] },
      },
    ],
  };
  expect(binarizedProgramToString(program)).toStrictEqual(`rules:
@r :- @p, q.`);
  expect(() => makeIntermediatePredicatesMatchJoinOrder(program)).toThrowError(
    'In BinarizedProgram, @r is not the premise of some rule',
  );

  program = {
    seeds: [],
    demands: ['de'],
    forbids: ['fo'],
    rules: [
      {
        type: 'Unary',
        premise: { name: 'p', args: [x] },
        conclusion: { type: 'intermediate', name: 'r0', vars: ['X'] },
      },
      {
        type: 'Join',
        inName: 'p',
        inVars: ['X'],
        premise: { name: 'good', args: [x] },
        conclusion: { type: 'intermediate', name: 'de', vars: [] },
      },
      {
        type: 'Join',
        inName: 'p',
        inVars: ['X'],
        premise: { name: 'bad', args: [x] },
        conclusion: { type: 'intermediate', name: 'fo', vars: [] },
      },
    ],
  };
  expect(binarizedProgramToString(program)).toStrictEqual(`#demand: @de
#forbid: @fo
rules:
@r0 X :- p X.
@de :- @p X, good X.
@fo :- @p X, bad X.`);
  expect(() => makeIntermediatePredicatesMatchJoinOrder(program)).toThrowError(
    'Precondition violation for permuteIntroduced: @p has arguments but appears more than once',
  );
});
