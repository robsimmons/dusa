import { test, expect } from 'vitest';
import { runDusaCli } from './cli.js';
import { InputFact } from './termoutput.js';

function testCli(args: (string | InputFact)[]) {
  const outs: string[] = [];
  const errs: string[] = [];

  return {
    code: runDusaCli(
      args.map((arg) => {
        if (typeof arg === 'string') return arg;
        return JSON.stringify(arg);
      }),
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

  result = testCli(['examples/mutual-exclusion.dusa', '-n0']);
  expect(result.code).toBe(0);
  expect(result.errs).toStrictEqual([]);
  expect(result.outs.sort()).toStrictEqual([
    'Answer: 1',
    'Answer: 2',
    'SATISFIABLE (2 models)',
    'Solving...',
    '{"p":[[{"name":"ff"}]],"q":[[{"name":"tt"}]]}',
    '{"p":[[{"name":"tt"}]],"q":[[{"name":"ff"}]]}',
  ]);

  result = testCli(['examples/mutual-exclusion.dusa', '-n0', '-cp', '-qq']);
  expect(result.code).toBe(0);
  expect(result.errs).toStrictEqual([]);
  expect(result.outs.sort()).toStrictEqual([
    'Answer: 1',
    'Answer: 2',
    'SATISFIABLE (2 models)',
    'Solving...',
    '{"p":1,"q":[[{"name":"ff"}]]}',
    '{"p":1,"q":[[{"name":"tt"}]]}',
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

test('CLI argument validation', () => {
  result = testCli(['-z']);
  expect(result.code).toBe(1);
  expect(result.errs[0].slice(0, 20)).toStrictEqual("\nUnknown option '-z'");
  expect(result.outs).toStrictEqual([]);

  result = testCli(['--help']);
  expect(result.code).toBe(0);
  expect(result.errs[0].split('\n')[1]).toStrictEqual('usage: dusa <filename.dusa> [options]');
  expect(result.outs).toStrictEqual([]);

  result = testCli(['/dev/null', '-vX']);
  expect(result.code).toBe(1);
  expect(result.errs[0]).toStrictEqual('--verbose must be an integer');
  expect(result.outs).toStrictEqual([]);

  result = testCli(['/dev/null', '-nX']);
  expect(result.code).toBe(1);
  expect(result.errs[0]).toStrictEqual("Number of models 'X' not an natural number");
  expect(result.outs).toStrictEqual([]);

  result = testCli(['__invalid__']);
  expect(result.code).toBe(1);
  expect(result.errs[0].slice(0, 27)).toStrictEqual('Could not read Dusa program');
  expect(result.outs).toStrictEqual([]);

  result = testCli([]);
  expect(result.code).toBe(1);
  expect(result.errs[0]).toStrictEqual(
    '\nA single positional argument, a filename containing a Dusa program, is required.\n',
  );
  expect(result.outs).toStrictEqual([]);
});

test('Inputs and term validation', () => {
  expect(testCli(['/dev/null', '-a', { name: 'p' }])).toStrictEqual({
    code: 0,
    errs: [],
    outs: ['Solving...', 'Answer: 1', '{"p":[[]]}', 'SATISFIABLE (1+ model)'],
  });

  expect(
    testCli(['/dev/null', '-a', { name: 'p', value: 1 }, '-a', { name: 'p', value: 2 }]),
  ).toStrictEqual({
    code: 1,
    errs: [],
    outs: ['Solving...', 'UNSATISFIABLE'],
  });

  expect(
    testCli(['/dev/null', '-a', { name: 'p', value: 0 }, '-a', { name: 'p', value: 1 }]),
  ).toStrictEqual({
    code: 1,
    errs: [],
    outs: ['Solving...', 'UNSATISFIABLE'],
  });

  expect(
    testCli(['/dev/null', '-a', { name: 'p', value: 1 }, '-a', { name: 'p', value: 1 }]),
  ).toStrictEqual({
    code: 0,
    errs: [],
    outs: ['Solving...', 'Answer: 1', '{"p":[[1]]}', 'SATISFIABLE (1+ model)'],
  });

  expect(
    testCli(['/dev/null', '-a', { name: 'p', value: 0 }, '-a', { name: 'p', value: 0 }]),
  ).toStrictEqual({
    code: 0,
    errs: [],
    outs: ['Solving...', 'Answer: 1', '{"p":[[0]]}', 'SATISFIABLE (1+ model)'],
  });

  expect(
    testCli(['/dev/null', '-a', { name: 'p', value: 1 }, '-a', { name: 'p', value: 0 }]),
  ).toStrictEqual({
    code: 1,
    errs: [],
    outs: ['Solving...', 'UNSATISFIABLE'],
  });

  expect(testCli(['/dev/null', '-f', '/dev/null'])).toStrictEqual({
    code: 1,
    errs: ['Invalid JSON in /dev/null: Unexpected end of JSON input'],
    outs: [],
  });

  expect(testCli(['/dev/null', '-a', '/'])).toStrictEqual({
    code: 1,
    errs: [`Invalid JSON in command-line fact #1: Unexpected token '/', "/" is not valid JSON`],
    outs: [],
  });

  expect(testCli(['/dev/null', '-a', { name: 'p' }, '-a', { name: 'p', args: [1] }])).toStrictEqual(
    {
      code: 1,
      errs: ['Predicate p should have 0 arguments, but the asserted fact has 1'],
      outs: [],
    },
  );

  expect(testCli(['/dev/null', '-a', '4'])).toStrictEqual({
    code: 1,
    errs: ['Error in command-line fact #1: not an object'],
    outs: [],
  });

  expect(testCli(['/dev/null', '-a', '{"name":4}'])).toStrictEqual({
    code: 1,
    errs: ["Error in command-line fact #1: 'name' field in fact object not a string"],
    outs: [],
  });

  expect(testCli(['/dev/null', '-a', '{"name":"p","args":null}'])).toStrictEqual({
    code: 1,
    errs: ["Error in command-line fact #1: 'args' field in fact object not an array"],
    outs: [],
  });

  expect(testCli(['/dev/null', '-a', '{"name":"p","args":[{}]}'])).toStrictEqual({
    code: 1,
    errs: ["Error in command-line fact #1: no 'name' field in term object"],
    outs: [],
  });

  expect(testCli(['/dev/null', '-a', '{"name":"p","args":[{"name":4}]}'])).toStrictEqual({
    code: 1,
    errs: ["Error in command-line fact #1: 'name' field in term object not a string"],
    outs: [],
  });

  expect(testCli(['/dev/null', '-a', '{"name":"p","args":[{"name":"s","args":0}]}'])).toStrictEqual(
    {
      code: 1,
      errs: ["Error in command-line fact #1: 'args' field in term object not an array"],
      outs: [],
    },
  );

  expect(
    testCli(['/dev/null', '-a', '{"name":"p","args":[{"name":"s","args":null}]}']),
  ).toStrictEqual({
    code: 1,
    errs: ["Error in command-line fact #1: 'args' field in term object not an array"],
    outs: [],
  });

  expect(testCli(['/dev/null', '-a', { name: 'p' }, '-a', '{}'])).toStrictEqual({
    code: 1,
    errs: ["Error in command-line fact #2: no 'name' field in fact object"],
    outs: [],
  });

  expect(
    testCli(
      [
        '/dev/null',
        '-v1',
        ['-a', { name: 'p', args: [4] }],
        ['-a', { name: 'p', args: ['Hello'] }],
        ['-a', { name: 'p', args: [{ name: 'c' }] }],
        ['-a', { name: 'p', args: [{ name: 's', args: [{ name: 'z' }] }] }],
        ['-a', { name: 'p', args: [true] }],
        ['-a', { name: 'p', args: [false] }],
      ].flat(),
    ),
  ).toStrictEqual({
    code: 0,
    errs: [],
    outs: [
      JSON.stringify({
        p: [
          [false],
          [true],
          ['Hello'],
          [4],
          [{ name: 'c' }],
          [{ name: 's', args: [{ name: 'z' }] }],
        ],
      }),
    ],
  });
});
