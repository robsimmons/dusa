import { compile } from './compile';
import { parse } from './dusa-parser';
import { Solution, execute, factToString, makeInitialDb } from './engine';
import { check } from './syntax';
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
  const { solutions, deadEnds } = testExecution(`
  #builtin NAT_ZERO z
  #builtin NAT_SUCC s

  a :- 1 == 1, 0 != s z, 1 == s z, 0 == z, 1 == s 0, 2 == s _, s _Y != 0, s (s Q) != 1.
  b :- a, a.
  c :- b.
  d :- c, z == 1.
  d :- c, s z == 0.
  d :- c, z != 0.
  d :- c, s z != 1.
  e :- d.
  `);
  expect(deadEnds).toEqual(0);
  expect(solutionsToStrings(solutions)).toEqual(['a, b, c']);
});

test('Exhaustive choices', () => {
  const { solutions, deadEnds } = testExecution(`
  a is { true, false }.
  b is { true, false }.
  `);
  expect(deadEnds).toEqual(0);
  expect(solutionsToStrings(solutions)).toEqual([
    'a is false, b is false',
    'a is false, b is true',
    'a is true, b is false',
    'a is true, b is true',
  ]);
});

test('Non-exhaustive choice', () => {
  const { solutions, deadEnds } = testExecution(`
  a is { false... }.
  b is { true, false } :- a is false.
  `);

  expect(deadEnds).toEqual(1);
  expect(solutionsToStrings(solutions)).toEqual([
    'a is false, b is false',
    'a is false, b is true',
  ]);
});

test('Overlapping exhaustive choices', () => {
  const { solutions } = testExecution(`
  a.
  b.
  c is { a, b, d, e }.
  c is { a, b, c, e } :- a.
  c is { a, c, d, e} :- b.
  `);
  expect(solutionsToStrings(solutions)).toEqual(['a, b, c is a', 'a, b, c is e']);
});

test('Overlapping non-exhaustive and exhaustive choices', () => {
  const { solutions } = testExecution(`
  a.
  b.
  c is { a, b, d, e } :- a.
  c is { a, b, c... } :- a.
  c is { a, c, d, e } :- b.
  c is { c... }.
  c is { a... }.
  c is { f... }.
  `);
  expect(solutionsToStrings(solutions)).toEqual(['a, b, c is a', 'a, b, c is d', 'a, b, c is e']);
});

test('Overlapping non-exhaustive choices', () => {
  const { solutions } = testExecution(`
  a.
  b.
  c is { a, b, c... } :- a.
  c is { a, c, d... } :- b.
  c is { f... }.
  `);
  expect(solutionsToStrings(solutions)).toEqual([
    'a, b, c is a',
    'a, b, c is b',
    'a, b, c is c',
    'a, b, c is d',
    'a, b, c is f',
  ]);
});

test('Plus is okay if grounded by previous rules', () => {
  const { solutions, deadEnds } = testExecution(`
  #builtin INT_PLUS plus

  a 2.
  a 7.
  a 12.
  d 9.
  d 19.
  d 6.
  e X Y :- a X, a Y, d (plus X Y).`);

  expect(deadEnds).toEqual(0);
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

test('Absent/extant bug', () => {
  const { solutions } = testExecution(`
  vertex 0.
  vertex 1.
  vertex 2.

  edge 0 1 is absent.
  edge 0 2 is absent.
  edge 1 2 is extant.
  edge X Y is Z :- edge Y X is Z.

  reachable N N :- vertex N.
  reachable Start Y :- reachable Start X, edge X Y is extant.`);

  expect(solutionsToStrings(solutions)).toEqual([
    'edge 0 1 is absent, edge 0 2 is absent, edge 1 0 is absent, edge 1 2 is extant, edge 2 0 is absent, edge 2 1 is extant, reachable 0 0, reachable 1 1, reachable 1 2, reachable 2 1, reachable 2 2, vertex 0, vertex 1, vertex 2',
  ]);
});

test('Generating edges', () => {
  const { solutions } = testExecution(`
  #builtin NAT_SUCC s

  vertex 2.
  vertex N :- vertex (s N).

  edge X Y is { extant, absent } :- vertex X, vertex Y, X != Y.
  edge X Y is Z :- edge Y X is Z.

  reachable N N :- vertex N.
  reachable Start Y :- reachable Start X, edge X Y is extant.
  `);

  expect(solutionsToStrings(solutions)).toEqual([
    'edge 0 1 is absent, edge 0 2 is absent, edge 1 0 is absent, edge 1 2 is absent, edge 2 0 is absent, edge 2 1 is absent, reachable 0 0, reachable 1 1, reachable 2 2, vertex 0, vertex 1, vertex 2',
    'edge 0 1 is absent, edge 0 2 is absent, edge 1 0 is absent, edge 1 2 is extant, edge 2 0 is absent, edge 2 1 is extant, reachable 0 0, reachable 1 1, reachable 1 2, reachable 2 1, reachable 2 2, vertex 0, vertex 1, vertex 2',
    'edge 0 1 is absent, edge 0 2 is extant, edge 1 0 is absent, edge 1 2 is absent, edge 2 0 is extant, edge 2 1 is absent, reachable 0 0, reachable 0 2, reachable 1 1, reachable 2 0, reachable 2 2, vertex 0, vertex 1, vertex 2',
    'edge 0 1 is absent, edge 0 2 is extant, edge 1 0 is absent, edge 1 2 is extant, edge 2 0 is extant, edge 2 1 is extant, reachable 0 0, reachable 0 1, reachable 0 2, reachable 1 0, reachable 1 1, reachable 1 2, reachable 2 0, reachable 2 1, reachable 2 2, vertex 0, vertex 1, vertex 2',
    'edge 0 1 is extant, edge 0 2 is absent, edge 1 0 is extant, edge 1 2 is absent, edge 2 0 is absent, edge 2 1 is absent, reachable 0 0, reachable 0 1, reachable 1 0, reachable 1 1, reachable 2 2, vertex 0, vertex 1, vertex 2',
    'edge 0 1 is extant, edge 0 2 is absent, edge 1 0 is extant, edge 1 2 is extant, edge 2 0 is absent, edge 2 1 is extant, reachable 0 0, reachable 0 1, reachable 0 2, reachable 1 0, reachable 1 1, reachable 1 2, reachable 2 0, reachable 2 1, reachable 2 2, vertex 0, vertex 1, vertex 2',
    'edge 0 1 is extant, edge 0 2 is extant, edge 1 0 is extant, edge 1 2 is absent, edge 2 0 is extant, edge 2 1 is absent, reachable 0 0, reachable 0 1, reachable 0 2, reachable 1 0, reachable 1 1, reachable 1 2, reachable 2 0, reachable 2 1, reachable 2 2, vertex 0, vertex 1, vertex 2',
    'edge 0 1 is extant, edge 0 2 is extant, edge 1 0 is extant, edge 1 2 is extant, edge 2 0 is extant, edge 2 1 is extant, reachable 0 0, reachable 0 1, reachable 0 2, reachable 1 0, reachable 1 1, reachable 1 2, reachable 2 0, reachable 2 1, reachable 2 2, vertex 0, vertex 1, vertex 2',
  ]);
});
