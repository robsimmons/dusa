import { compile } from './compile';
import { dataToString } from './data';
import { parse } from './dusa-parser';
import { Solution, execute, factToString, makeInitialDb } from './engine';
import { check } from './syntax';
import { termToString } from './terms';
import { test, expect } from 'vitest';

function testExecution(prog: string) {
  const parsed = parse(prog);
  if (parsed.errors !== null) {
    throw parsed.errors;
  }

  const checked = check(parsed.document);
  if (checked.errors !== null) {
    throw checked.errors;
  }

  const compiled = compile(checked.decls);
  return execute(compiled.program, makeInitialDb(compiled));
}

function solutionsToStrings(solutions: Solution[]) {
  return solutions.map((solution) => solution.facts.map(factToString).sort().join(', ')).sort();
}

test('Multi-step declaration, basic nat (in)equality', () => {
  const { solutions, deadEnds, splits, highWater } = testExecution(`
  #builtin NAT_ZERO z
  #builtin NAT_SUCC s

  a :- 1 == 1, 0 != s z, 1 == s z, 0 == z, 1 == s 0, 2 == s _, s _Y != 0.
  b :- a, a.
  c :- b.
  d :- c, z == 1.
  d :- c, s z == 0.
  d :- c, z != 0.
  d :- c, s z != 1.
  e :- d.
  `);
  expect(solutions.length).toEqual(1);
  expect(deadEnds).toEqual(0);
  expect(splits).toEqual(0);
  expect(highWater).toEqual(1);
  expect(solutions[0].unfacts).toEqual([]);

  const facts = solutions[0].facts.map(factToString);
  expect(facts.length).toEqual(3);
  expect(facts).toContainEqual('a');
  expect(facts).toContainEqual('b');
  expect(facts).toContainEqual('c');
});

test('Exhaustive choices', () => {
  const { solutions, deadEnds, splits, highWater } = testExecution(`
  a is { true, false }.
  b is { true, false }.
  `);
  expect(solutions.length).toEqual(4);
  expect(deadEnds).toEqual(0);
  expect(splits).toEqual(3);
  expect(highWater).toEqual(3);
  expect(solutions.map(({ unfacts }) => unfacts)).toEqual([[], [], [], []]);

  const facts = solutions
    .map((solution) => solution.facts.map(factToString).sort().join(', '))
    .sort();
  expect(facts).toEqual([
    'a is false, b is false',
    'a is false, b is true',
    'a is true, b is false',
    'a is true, b is true',
  ]);
});

test('Non-exhaustive choice', () => {
  const { solutions, deadEnds, splits, highWater } = testExecution(`
  a is { false... }.
  b is { true, false } :- a is false.
  `);
  expect(solutions.length).toEqual(3);
  expect(deadEnds).toEqual(0);
  expect(splits).toEqual(2);
  expect(highWater).toEqual(3);
  expect(
    solutions
      .map(({ unfacts }) =>
        unfacts.map(
          ([attribute, data]) => `${attribute} ${data.map((term) => dataToString(term)).join(' ')}`,
        ),
      )
      .sort((a, b) => a.length - b.length),
  ).toEqual([[], [], ['a false']]);

  const facts = solutions
    .map((solution) => solution.facts.map(factToString).sort().join(', '))
    .sort();
  expect(facts).toEqual(['', 'a is false, b is false', 'a is false, b is true']);
});

test('Plus is okay if grounded by previous rules', () => {
  const { solutions, deadEnds, splits, highWater } = testExecution(`
  #builtin INT_PLUS plus

  a 2.
  a 7.
  a 12.
  d 9.
  d 19.
  d 6.
  e X Y :- a X, a Y, d (plus X Y).`);

  expect(solutions.length).toEqual(1);
  expect(deadEnds).toEqual(0);
  expect(splits).toEqual(0);
  expect(highWater).toEqual(1);
  expect(solutionsToStrings(solutions)).toEqual([
    'a 12, a 2, a 7, d 19, d 6, d 9, e 12 7, e 2 7, e 7 12, e 7 2',
  ]);
});

test('Matching nats', () => {
  const { solutions } = testExecution(`
  #builtin NAT_SUCC s

  a 2.
  a 4.
  b X :- a Y, Y == s X.
  c X :- a Y, X == s Y.
  d X :- b X, X != s (s Y).
  e (s (s X)) :- a X, s (s (s _)) != X.
  e (s X) :- a X, X != s (s (s _Y)).`);

  expect(solutionsToStrings(solutions)).toEqual(['a 2, a 4, b 1, b 3, c 3, c 5, d 1, e 3, e 4']);
});

test('Terms that are zero', () => {
  const { solutions } = testExecution(`  
  #builtin INT_PLUS plus

  lt4 0.
  lt4 (plus 1 N) :- lt4 N, N != 3.`);

  expect(solutionsToStrings(solutions)).toEqual(['lt4 0, lt4 1, lt4 2, lt4 3']);
});
