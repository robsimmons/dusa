import { execute, solutionsToStrings } from './choiceengine.js';
import { compile } from '../language/compile.js';
import { parse } from '../language/dusa-parser.js';
import { makeInitialDb } from './forwardengine.js';
import { test, expect } from 'vitest';
import { check } from '../language/check.js';

function testExecution(source: string, debug = false) {
  const parsed = parse(source);
  if (parsed.errors !== null) {
    throw parsed.errors;
  }

  const errors = check(parsed.document);
  if (errors.length !== 0) {
    throw errors;
  }

  const program = compile(parsed.document, debug);
  return execute(program, makeInitialDb(program), debug);
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

test('Long chain of inferences', () => {
  const { solutions } = testExecution(
    Array.from({ length: 30 })
      .map((_, i) => `a ${i} :- a ${i + 1}.`)
      .join('\n') + '\na 30.',
  );
  expect(solutionsToStrings(solutions)).toEqual([
    Array.from({ length: 31 })
      .map((_, i) => `a ${i}`)
      .sort()
      .join(', '),
  ]);
});

test('Chained equality', () => {
  const { solutions } = testExecution(`
    #builtin NAT_SUCC s
    
    a 0.
    b E :- a A, s A == B, s B == C, s C == D, D == s (s E), E != D, F == E.
    c A :- a (s A).
    d B :- b (s B).
    `);
  expect(solutionsToStrings(solutions)).toEqual(['a 0, b 1, d 0']);
});

test('Equality on structures', () => {
  const { solutions } = testExecution(`
    a (pair 10 2).
    b Y :- a X, X == pair Y _.
    c Y :- a X, pair _ Y == X.
    d (pair X Y) :- b Y, c X.
    e X :- d A, c Y, A == pair Y X.
    f X :- d A, c Y, A == pair X Y.
    `);
  expect(solutionsToStrings(solutions)).toEqual(['a (pair 10 2), b 10, c 2, d (pair 2 10), e 10']);
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
    a is { false? }.
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
    c is { a, b, c? } :- a.
    c is { a, c, d, e } :- b.
    c is { c? }.
    c is { a? }.
    c is { f? }.
    `);
  expect(solutionsToStrings(solutions)).toEqual(['a, b, c is a', 'a, b, c is d', 'a, b, c is e']);
});

test('Overlapping non-exhaustive choices', () => {
  const { solutions } = testExecution(`
    a.
    b.
    c is { a, b, c? } :- a.
    c is { a, c, d? } :- b.
    c is { f? }.
    `);
  expect(solutionsToStrings(solutions)).toEqual([
    'a, b, c is a',
    'a, b, c is b',
    'a, b, c is c',
    'a, b, c is d',
    'a, b, c is f',
  ]);
});

test('Plus is okay if grounded by previous rules via equality', () => {
  const { solutions, deadEnds } = testExecution(`
      #builtin INT_PLUS plus
    
      a 2.
      a 7.
      a 12.
      d 9.
      d 19.
      d 6.
      e X Y :- a X, a Y, plus X Y == Z, d Z.`);

  expect(deadEnds).toEqual(0);
  expect(solutionsToStrings(solutions)).toEqual([
    'a 12, a 2, a 7, d 19, d 6, d 9, e 12 7, e 2 7, e 7 12, e 7 2',
  ]);
});

test('INT_MINUS via equality', () => {
  const { solutions } = testExecution(`
    #builtin INT_MINUS minus
  
    a 0.
    a 4.
  
    b (minus X Y) :- a X, a Y.
    c X :- b X, minus 0 X == Y, a Y.
    `);
  expect(solutionsToStrings(solutions)).toEqual(['a 0, a 4, b -4, b 0, b 4, c -4, c 0']);
});

/* 
// Broken by move to the forward+choice engines
// Need to fix with a program transformation that turns d (plus X Y)
// into two premises, plus X Y is $a and d $a

test('Plus is okay if grounded by previous rules', () => {
  const { solutions, deadEnds } = testExecution(    `
    #builtin INT_PLUS plus
  
    a 2.
    a 7.
    a 12.
    d 9.
    d 19.
    d 6.
    e X Y :- a X, a Y, d (plus X Y).`,
  );

  expect(deadEnds).toEqual(0);
  expect(solutionsToStrings(solutions)).toEqual([
    'a 12, a 2, a 7, d 19, d 6, d 9, e 12 7, e 2 7, e 7 12, e 7 2',
  ]);
});

test('INT_MINUS', () => {
    const { solutions } = testExecution(`
    #builtin INT_MINUS minus
  
    a 0.
    a 4.
  
    b (minus X Y) :- a X, a Y.
    c X :- b X, a (minus 0 X).
    `);
    expect(solutionsToStrings(solutions)).toEqual(['a 0, a 4, b -4, b 0, b 4, c -4, c 0']);
  });

*/

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

test('Forbid and demand', () => {
  const { solutions } = testExecution(`
  
    a is { true, false }.
    b is { true, false }.
    c is { true, false }.
    d is { true, false }.
  
    #demand a is true, b is true.
    #forbid c is true, d is true.
    `);

  expect(solutionsToStrings(solutions)).toEqual([
    'a is true, b is true, c is false, d is false',
    'a is true, b is true, c is false, d is true',
    'a is true, b is true, c is true, d is false',
  ]);
});

test('Open ended and closed ended possibility', () => {
  const { solutions } = testExecution(`
    #builtin INT_MINUS minus
    n 9.
    n (minus N 1) :- n N, N != 0.
    
    choice is {C?} :- n C.
    a C is {ff?} :- n C.
    a C is {tt} :- choice is C.
    `);

  expect(solutionsToStrings(solutions)).toEqual([
    'a 0 is ff, a 1 is ff, a 2 is ff, a 3 is ff, a 4 is ff, a 5 is ff, a 6 is ff, a 7 is ff, a 8 is ff, a 9 is tt, choice is 9, n 0, n 1, n 2, n 3, n 4, n 5, n 6, n 7, n 8, n 9',
    'a 0 is ff, a 1 is ff, a 2 is ff, a 3 is ff, a 4 is ff, a 5 is ff, a 6 is ff, a 7 is ff, a 8 is tt, a 9 is ff, choice is 8, n 0, n 1, n 2, n 3, n 4, n 5, n 6, n 7, n 8, n 9',
    'a 0 is ff, a 1 is ff, a 2 is ff, a 3 is ff, a 4 is ff, a 5 is ff, a 6 is ff, a 7 is tt, a 8 is ff, a 9 is ff, choice is 7, n 0, n 1, n 2, n 3, n 4, n 5, n 6, n 7, n 8, n 9',
    'a 0 is ff, a 1 is ff, a 2 is ff, a 3 is ff, a 4 is ff, a 5 is ff, a 6 is tt, a 7 is ff, a 8 is ff, a 9 is ff, choice is 6, n 0, n 1, n 2, n 3, n 4, n 5, n 6, n 7, n 8, n 9',
    'a 0 is ff, a 1 is ff, a 2 is ff, a 3 is ff, a 4 is ff, a 5 is tt, a 6 is ff, a 7 is ff, a 8 is ff, a 9 is ff, choice is 5, n 0, n 1, n 2, n 3, n 4, n 5, n 6, n 7, n 8, n 9',
    'a 0 is ff, a 1 is ff, a 2 is ff, a 3 is ff, a 4 is tt, a 5 is ff, a 6 is ff, a 7 is ff, a 8 is ff, a 9 is ff, choice is 4, n 0, n 1, n 2, n 3, n 4, n 5, n 6, n 7, n 8, n 9',
    'a 0 is ff, a 1 is ff, a 2 is ff, a 3 is tt, a 4 is ff, a 5 is ff, a 6 is ff, a 7 is ff, a 8 is ff, a 9 is ff, choice is 3, n 0, n 1, n 2, n 3, n 4, n 5, n 6, n 7, n 8, n 9',
    'a 0 is ff, a 1 is ff, a 2 is tt, a 3 is ff, a 4 is ff, a 5 is ff, a 6 is ff, a 7 is ff, a 8 is ff, a 9 is ff, choice is 2, n 0, n 1, n 2, n 3, n 4, n 5, n 6, n 7, n 8, n 9',
    'a 0 is ff, a 1 is tt, a 2 is ff, a 3 is ff, a 4 is ff, a 5 is ff, a 6 is ff, a 7 is ff, a 8 is ff, a 9 is ff, choice is 1, n 0, n 1, n 2, n 3, n 4, n 5, n 6, n 7, n 8, n 9',
    'a 0 is tt, a 1 is ff, a 2 is ff, a 3 is ff, a 4 is ff, a 5 is ff, a 6 is ff, a 7 is ff, a 8 is ff, a 9 is ff, choice is 0, n 0, n 1, n 2, n 3, n 4, n 5, n 6, n 7, n 8, n 9',
  ]);
});
