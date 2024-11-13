import { test, expect } from 'vitest';
import { Database } from '../datastructures/database.js';
import { check } from '../language/check.js';
import { compile } from '../language/compile.js';
import { parse } from '../language/dusa-parser.js';
import { execute } from './choiceengine.js';
import { ingestBytecodeProgram, Program } from './program.js';

function build(source: string) {
  const parsed = parse(source);
  if (parsed.errors !== null) throw parsed.errors;
  const { errors, arities, builtins } = check(parsed.document);
  if (errors.length !== 0) throw errors;
  const bytecode = compile(builtins, arities, parsed.document);
  return ingestBytecodeProgram(bytecode);
}

function simplify(prog: Program, db: Database, keys: [string, number][]) {
  const facts: string[] = [];
  for (const [key, depth] of keys) {
    for (const args of db.visit(key, [], depth)) {
      facts.push(`${key}${args.map((arg) => ` ${prog.data.toString(arg)}`).join('')}`);
    }
  }
  return facts.toSorted().join(', ');
}

function testExecution(source: string, preds: [string, number][]) {
  const prog = build(source);
  return [
    ...execute(prog)
      .filter((db) => db.size.neg === 0)
      .map((db) => simplify(prog, db, preds)),
  ].toSorted();
}

test('Exhaustive choices', () => {
  expect(
    testExecution(
      `
        a is { tt, ff }.
        b is { tt, ff }.
      `,
      [
        ['a', 1],
        ['b', 1],
      ],
    ),
  ).toStrictEqual(['a ff, b ff', 'a ff, b tt', 'a tt, b ff', 'a tt, b tt']);
});

test('Non-exhaustive choice', () => {
  expect(
    testExecution(
      `
        a is? ff.
        b is { tt, ff } :- a is ff.
      `,
      [
        ['a', 1],
        ['b', 1],
      ],
    ),
  ).toStrictEqual(['a ff, b ff', 'a ff, b tt']);
});

test('Overlapping non-exhaustive and exhaustive choices', () => {
  expect(
    testExecution(
      `
        p.
        q.
        r is { a, b, d, e } :- p.
        r is? { a, b, c } :- p.
        r is { a, c, d, e } :- q.
        r is? c.
        r is? a.
        r is? f.
      `,
      [['r', 1]],
    ),
  ).toStrictEqual(['r a', 'r d', 'r e']);
});

test('Overlapping non-exhaustive choices', () => {
  expect(
    testExecution(
      `
        p.
        q.
        r is? { a, b, c } :- p.
        r is? { a, c, d } :- p.
        r is? e :- q.
        r is? f.
    `,
      [['r', 1]],
    ),
  ).toStrictEqual(['r a', 'r b', 'r c', 'r d', 'r e', 'r f']);
});

test('Absent/extant regression simplified', () => {
  expect(
    testExecution(
      `
        reachable 1 1.
        edge 1 2 is extant.
        reachable Start Y :- reachable Start X, edge X Y is extant.
      `,
      [['reachable', 2]],
    ),
  ).toStrictEqual(['reachable 1 1, reachable 1 2']);
});

test('Absent/extant regression full', () => {
  expect(
    testExecution(
      `
        vertex 0.
        vertex 1.
        vertex 2.
    
        edge 0 1 is absent.
        edge 0 2 is absent.
        edge 1 2 is extant.
        edge X Y is Z :- edge Y X is Z.
    
        reachable N N :- vertex N.
        reachable Start Y :- reachable Start X, edge X Y is extant.
      `,
      [['reachable', 2]],
    ),
  ).toStrictEqual(['reachable 0 0, reachable 1 1, reachable 1 2, reachable 2 1, reachable 2 2']);
});

test('Forbid and demand: one solution', () => {
  expect(
    testExecution(
      `
        p a is { tt, ff }.
        p b is { tt, ff }.
        #demand p a is tt.
        #forbid p b is ff.
      `,
      [['p', 2]],
    ),
  ).toStrictEqual(['p a tt, p b tt']);
});

test('Forbid and demand: several solutions', () => {
  expect(
    testExecution(
      `
        q a. q b. q c. q d.
        p X is { tt, ff } :- q X.
        #demand p a is tt, p b is tt.
        #forbid p c is ff, p d is ff.
      `,
      [['p', 2]],
    ),
  ).toStrictEqual([
    'p a tt, p b tt, p c ff, p d tt',
    'p a tt, p b tt, p c tt, p d ff',
    'p a tt, p b tt, p c tt, p d tt',
  ]);
});

test('Three sets of choices', () => {
  expect(
    testExecution(
      `
        p a is { tt, ff }.
        p b is { tt, ff }.
        p c is { tt, ff }.
      `,
      [['p', 2]],
    ),
  ).toStrictEqual([
    'p a ff, p b ff, p c ff',
    'p a ff, p b ff, p c tt',
    'p a ff, p b tt, p c ff',
    'p a ff, p b tt, p c tt',
    'p a tt, p b ff, p c ff',
    'p a tt, p b ff, p c tt',
    'p a tt, p b tt, p c ff',
    'p a tt, p b tt, p c tt',
  ]);
});

test('Generating edges', () => {
  expect(
    testExecution(
      `
        vertex a. vertex b.

        edge X X is absent :- vertex X.
        edge X Y is { extant, absent } :- vertex X, vertex Y.
      `,
      [['edge', 3]],
    ),
  ).toStrictEqual([
    'edge a a absent, edge a b absent, edge b a absent, edge b b absent',
    'edge a a absent, edge a b absent, edge b a extant, edge b b absent',
    'edge a a absent, edge a b extant, edge b a absent, edge b b absent',
    'edge a a absent, edge a b extant, edge b a extant, edge b b absent',
  ]);
});

test('Generating edges', () => {
  expect(
    testExecution(
      `
        vertex a. vertex b. vertex c.

        edge X X is absent :- vertex X.
        edge X Y is { extant, absent } :- vertex X, vertex Y.
        edge X Y is Z :- edge Y X is Z.

        reach N N :- vertex N.
        reach Start Y :- reach Start X, edge X Y is extant.
      `,
      [['reach', 2]],
    ),
  ).toStrictEqual([
    'reach a a, reach a b, reach a c, reach b a, reach b b, reach b c, reach c a, reach c b, reach c c',
    'reach a a, reach a b, reach a c, reach b a, reach b b, reach b c, reach c a, reach c b, reach c c',
    'reach a a, reach a b, reach a c, reach b a, reach b b, reach b c, reach c a, reach c b, reach c c',
    'reach a a, reach a b, reach a c, reach b a, reach b b, reach b c, reach c a, reach c b, reach c c',
    'reach a a, reach a b, reach b a, reach b b, reach c c',
    'reach a a, reach a c, reach b b, reach c a, reach c c',
    'reach a a, reach b b, reach b c, reach c b, reach c c',
    'reach a a, reach b b, reach c c',
  ]);
});

test('Open ended and closed ended possibility', () => {
  expect(
    testExecution(
      `
        opt a. opt b. opt c. opt d. opt e. opt f. opt g. opt h. 

        choice is? X :- opt X.
        p X is? ff :- opt X.
        p choice is tt.
      `,
      [
        ['p', 2],
        ['choice', 1],
      ],
    ),
  ).toStrictEqual([
    'choice a, p a tt, p b ff, p c ff, p d ff, p e ff, p f ff, p g ff, p h ff',
    'choice b, p a ff, p b tt, p c ff, p d ff, p e ff, p f ff, p g ff, p h ff',
    'choice c, p a ff, p b ff, p c tt, p d ff, p e ff, p f ff, p g ff, p h ff',
    'choice d, p a ff, p b ff, p c ff, p d tt, p e ff, p f ff, p g ff, p h ff',
    'choice e, p a ff, p b ff, p c ff, p d ff, p e tt, p f ff, p g ff, p h ff',
    'choice f, p a ff, p b ff, p c ff, p d ff, p e ff, p f tt, p g ff, p h ff',
    'choice g, p a ff, p b ff, p c ff, p d ff, p e ff, p f ff, p g tt, p h ff',
    'choice h, p a ff, p b ff, p c ff, p d ff, p e ff, p f ff, p g ff, p h tt',
  ]);
});

test('Value conflict', () => {
  expect(
    testExecution(
      `
        p is a.
        p is b.
      `,
      [['p', 1]],
    ),
  ).toStrictEqual([]);
});

test('Forcing a value conflict in a noneOf branch', () => {
  expect(
    testExecution(
      `
        q is? a.
        p is? a.
        q is X :- p is X.
        p is X :- q is X.
      `,
      [
        ['p', 1],
        ['q', 1],
      ],
    ),
  ).toStrictEqual(['p a, q a']);
});

test('Binary operation builtins', () => {
  expect(
    testExecution(
      `
        q X :- 4 == X.
        r a :- q X, X != 4.
        r b :- q X, 4 == X.
        r c :- q X, X < 5. 
        r d :- q X, X < 4. 
        r e :- q X, X < 3. 
        r f :- q X, X <= 5. 
        r g :- q X, X <= 4. 
        r h :- q X, X <= 3.
        r i :- q X, X >= 5. 
        r j :- q X, X >= 4. 
        r k :- q X, X >= 3. 
        r l :- q X, X > 5. 
        r m :- q X, X > 4. 
        r n :- q X, X > 3. 
      `,
      [['r', 1]],
    ),
  ).toStrictEqual(['r b, r c, r f, r g, r j, r k, r n']);
});
