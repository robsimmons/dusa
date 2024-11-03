import { test, expect } from 'vitest';
import { srcToBinarized } from './binarize.test.js';
import {
  BinarizedProgram,
  binarizedProgramToString,
  makeIntermediatePredicatesMatchJoinOrder,
} from './binarize.js';
import { generateIndices } from './indexes.js';

function srcToIndexed(source: string) {
  const binarized = srcToBinarized(source);
  return makeIntermediatePredicatesMatchJoinOrder(generateIndices(binarized));
}

test('test reuse of indexes', () => {
  let program: BinarizedProgram;

  program = srcToIndexed(`
q1 :- a, p X Y Z.
q2 :- b X, p X Y Z.
q3 :- c X Y, p X Y Z.
q4 :- d X Y Z, p X Y Z.`);
  expect(binarizedProgramToString(program)).toStrictEqual(`rules:
@q1-1-1 :- a.
q1 :- @q1-1-1, p.
@q2-1-1 X :- b X.
q2 :- @q2-1-1 X, p X.
@q3-1-1 X Y :- c X Y.
q3 :- @q3-1-1 X Y, p X Y.
@q4-1-1 X Y Z :- d X Y Z.
q4 :- @q4-1-1 X Y Z, p X Y Z.`);
});

test('test creation of indexes', () => {
  let program: BinarizedProgram;

  program = srcToIndexed(`
q1 X :- a, p X Y Z.
q2 Y :- b Y, p X Y Z.
q3 X :- c Z, p X Y Z.
q3 Y :- c Z, p X Y Z.`);
  expect(binarizedProgramToString(program)).toStrictEqual(`rules:
$p-1 #1 :- p #0 #1 #2.
$p-2 #2 #0 :- p #0 #1 #2.
$p-3 #2 #1 :- p #0 #1 #2.
@q1-1-1 :- a.
q1 X :- @q1-1-1, p X.
@q2-1-1 Y :- b Y.
q2 Y :- @q2-1-1 Y, $p-1 Y.
@q3-1-1 Z :- c Z.
q3 X :- @q3-1-1 Z, $p-2 Z X.
@q3-2-1 Z :- c Z.
q3 Y :- @q3-2-1 Z, $p-3 Z Y.`);

  program = srcToIndexed(`
q1 :- a X, p X Y Z.
q2 :- b X, p X X Z.
q3 :- c X, p X X X.`);
  expect(binarizedProgramToString(program)).toStrictEqual(`rules:
$p-1 #0 :- p #0 #0 #1.
$p-2 #0 :- p #0 #0 #0.
@q1-1-1 X :- a X.
q1 :- @q1-1-1 X, p X.
@q2-1-1 X :- b X.
q2 :- @q2-1-1 X, $p-1 X.
@q3-1-1 X :- c X.
q3 :- @q3-1-1 X, $p-2 X.`);

  program = srcToIndexed(`
q :- a, b X _, b _ X.`);
  expect(binarizedProgramToString(program)).toStrictEqual(`rules:
$b-1 #1 :- b #0 #1.
@q-1-1 :- a.
@q-1-2 X :- @q-1-1, b X.
q :- @q-1-2 X, $b-1 X.`);

  program = srcToIndexed(`
a :- a, p _ X.
b X :- b X, p _ X.
c X Y :- b X, p Y X. 
`);
  expect(binarizedProgramToString(program)).toStrictEqual(`rules:
$p-1 #1 #0 :- p #0 #1.
@a-1-1 :- a.
a :- @a-1-1, p.
@b-1-1 X :- b X.
b X :- @b-1-1 X, $p-1 X.
@c-1-1 X :- b X.
c X Y :- @c-1-1 X, $p-1 X Y.`);

  /**
   * This is a case where we might like to use a as a secondary index to c,
   * but because the user can add facts to the `c` relation by assertion, we
   * can't actually do that optimization safely.
   */
  program = srcToIndexed(`
a X :- p _ X.
b X :- b X, p _ X.`);
  expect(binarizedProgramToString(program)).toStrictEqual(`rules:
$p-1 #1 :- p #0 #1.
a X :- p _ X.
@b-1-1 X :- b X.
b X :- @b-1-1 X, $p-1 X.`);
});

test("don't rules that might be open as indexes", () => {
  const program = srcToIndexed(`
a 3 2.
b 3 2 is { x, y, z }.
c 3 2 is? { x, y, z }.
q :- p, a _ _.
q :- p, b _ _ is _.
q :- p, c _ _ is _.`);
  expect(binarizedProgramToString(program)).toStrictEqual(`seeds: $seed
rules:
$c-0 :- c #0 #1 #2.
a 3 2 :- $seed.
b 3 2 is { x, y, z } :- $seed.
c 3 2 is? { x, y, z } :- $seed.
@q-1-1 :- p.
q :- @q-1-1, a.
@q-2-1 :- p.
q :- @q-2-1, b.
@q-3-1 :- p.
q :- @q-3-1, $c-0.`);
});

test('example from src/language/README.md', () => {
  let program: BinarizedProgram;

  program = srcToIndexed(`
p4 X Y Z W :- p3 X Y Z, a X Y "hi" (h X W) _.`);
  expect(binarizedProgramToString(program)).toStrictEqual(`rules:
$a-1 #0 #1 #2 :- a #0 #1 "hi" (h #0 #2) #3.
@p4-1-1 X Y Z :- p3 X Y Z.
p4 X Y Z W :- @p4-1-1 X Y Z, $a-1 X Y W.`);

  program = srcToIndexed(`
p4 X Y Z W :- p3 X Y Z, a X Y 17 (h X W) _.
q3 X Y Z W :- q2 Y Z, a X Y 17 (h X W) V.`);
  expect(binarizedProgramToString(program)).toStrictEqual(`rules:
$a-1 #1 #0 #2 :- a #0 #1 17 (h #0 #2) #3.
@p4-1-1 Y X Z :- p3 X Y Z.
p4 X Y Z W :- @p4-1-1 Y X Z, $a-1 Y X W.
@q3-1-1 Y Z :- q2 Y Z.
q3 X Y Z W :- @q3-1-1 Y Z, $a-1 Y X W.`);

  program = srcToIndexed(`
p4 X Y Z W :- p3 X Y Z, a X Y 17 (h X W) _.
q3 X Y Z W :- q2 Y Z, a X Y 17 (h X W) V.
r5 X Y W V :- r4 X Y W, a X Y 17 (h X W) V.`);
  expect(binarizedProgramToString(program)).toStrictEqual(`rules:
$a-1 #1 #0 #2 #3 :- a #0 #1 17 (h #0 #2) #3.
@p4-1-1 Y X Z :- p3 X Y Z.
p4 X Y Z W :- @p4-1-1 Y X Z, $a-1 Y X W.
@q3-1-1 Y Z :- q2 Y Z.
q3 X Y Z W :- @q3-1-1 Y Z, $a-1 Y X W.
@r5-1-1 Y X W :- r4 X Y W.
r5 X Y W V :- @r5-1-1 Y X W, $a-1 Y X W V.`);

  program = srcToIndexed(`
p4 X Y Z W :- p3 X Y Z, a X Y 17 (h X W) _.
q3 X Y Z W :- q2 Y Z, a X Y 17 (h X W) V.
r5 X Y W V :- r4 X Y W, a X Y 17 (h X W) V.
s4 V Q is X :- s3 V Q, a X Y 17 (h X W) V.
t2 X is? Y :- t1 X, a X Y Z W V.`);
  expect(binarizedProgramToString(program)).toStrictEqual(`rules:
$a-1 #1 #0 #2 #3 :- a #0 #1 17 (h #0 #2) #3.
$a-2 #3 #0 :- a #0 #1 17 (h #0 #2) #3.
@p4-1-1 Y X Z :- p3 X Y Z.
p4 X Y Z W :- @p4-1-1 Y X Z, $a-1 Y X W.
@q3-1-1 Y Z :- q2 Y Z.
q3 X Y Z W :- @q3-1-1 Y Z, $a-1 Y X W.
@r5-1-1 Y X W :- r4 X Y W.
r5 X Y W V :- @r5-1-1 Y X W, $a-1 Y X W V.
@s4-1-1 V Q :- s3 V Q.
s4 V Q is X :- @s4-1-1 V Q, $a-2 V X.
@t2-1-1 X :- t1 X.
t2 X is? Y :- @t2-1-1 X, a X Y.`);
});
