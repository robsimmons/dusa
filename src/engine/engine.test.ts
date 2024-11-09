import { test, expect } from 'vitest';
import { Database } from '../datastructures/database.js';
import { check } from '../language/check.js';
import { compile } from '../language/compile.js';
import { builtinModes } from '../language/dusa-builtins.js';
import { parse } from '../language/dusa-parser.js';
import { execute } from './choiceengine.js';
import { ingestBytecodeProgram, Program } from './program.js';

function build(source: string) {
  const parsed = parse(source);
  if (parsed.errors !== null) throw parsed.errors;
  const { errors, arities, builtins } = check(builtinModes, parsed.document);
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
