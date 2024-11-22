import { test, expect } from 'vitest';
import { runDusaCli } from './cli.js';

function testCli(args: string[]) {
  const outs: string[] = [];
  const errs: string[] = [];

  return {
    code: runDusaCli(
      args,
      (msg) => outs.push(`${msg}`),
      (msg) => errs.push(`${msg}`),
    ),
    outs,
    errs,
  };
}

let result: ReturnType<typeof testCli>;
test('Readme examples: mutual exclusion', () => {
  result = testCli(['examples/mutual-exclusion.dusa']);
  expect(result.code).toBe(0);
  expect(result.errs).toStrictEqual([]);
  expect(result.outs.length).toBe(4);
  expect(result.outs[0]).toBe('Solving...');
  expect(result.outs[1]).toBe('Answer: 1');
  expect(result.outs[3]).toBe('SATISFIABLE (1+ model)');
  2;
  result = testCli(['examples/mutual-exclusion.dusa', '-n0']);
  expect(result.code).toBe(0);
  expect(result.errs).toStrictEqual([]);
  expect(result.outs.toSorted()).toStrictEqual([
    'Answer: 1',
    'Answer: 2',
    'SATISFIABLE (2 models)',
    'Solving...',
    '{"p":[[{"name":"ff"}]],"q":[[{"name":"tt"}]]}',
    '{"p":[[{"name":"tt"}]],"q":[[{"name":"ff"}]]}',
  ]);
});

test('Readme examples: character creation', () => {
  result = testCli(['examples/character-creation.dusa', '-n3', '-q', 'a_story']);
  expect(result.code).toBe(0);
  expect(result.errs).toStrictEqual([]);
  expect(result.outs.length).toBe(8);
  expect(result.outs[0]).toBe('Solving...');
  expect(result.outs[1]).toBe('Answer: 1');
  expect(result.outs[3]).toBe('Answer: 2');
  expect(result.outs[5]).toBe('Answer: 3');
  expect(result.outs[7]).toBe('SATISFIABLE (3+ models)');
});

test('Readme examples: canonical reps', () => {
  result = testCli([
    'examples/canonical-reps.dusa',
    '-f',
    'examples/graph-data-32.json',
    '-q',
    'isRep',
  ]);
  expect(result.code).toBe(0);
  expect(result.errs).toStrictEqual([]);
  expect(result.outs.length).toBe(4);
  expect(result.outs[0]).toBe('Solving...');
  expect(result.outs[1]).toBe('Answer: 1');
  expect(JSON.parse(result.outs[2])?.isRep?.length).toBe(6);
  expect(JSON.parse(result.outs[2])?.isRep?.[5]).toStrictEqual([30]);
  expect(result.outs[3]).toBe('SATISFIABLE (1+ model)');
});
