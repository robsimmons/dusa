import { test, expect } from 'vitest';
import { DataView, HashCons } from './data.js';

test('Internalizing basic types', () => {
  const data = new HashCons();
  const testData: DataView[] = [
    { type: 'trivial' },
    { type: 'int', value: 123n },
    { type: 'int', value: 123456789012345678901234567890123456762354n },
    { type: 'int', value: 0n },
    { type: 'int', value: 1n },
    { type: 'int', value: -1n },
    { type: 'string', value: 'abc' },
    { type: 'string', value: '"🦊"' },
    { type: 'string', value: "'\n\t\x9DĦ\0\\" },
    { type: 'const', name: 'a', args: [] },
    { type: 'const', name: 'b', args: [] },
    { type: 'const', name: 'c', args: [] },
    { type: 'const', name: 'abc', args: [] },
    { type: 'bool', value: true },
    { type: 'bool', value: false },
    ...Array.from({ length: 22 }).map(() => data.expose(data.genRef())),
  ];

  for (const d1 of testData) {
    for (const d2 of testData) {
      if (d1 === d2) {
        expect(data.hide(d1)).toEqual(data.hide(d2));
      } else {
        expect(data.hide(d1)).not.toEqual(data.hide(d2));
      }
    }
  }

  expect(data.hide({ type: 'trivial' })).toEqual(data.hide({ type: 'trivial' }));
  expect(testData.slice(0, 17).map((d) => data.toString(data.hide(d)))).toStrictEqual([
    '()',
    '123',
    '123456789012345678901234567890123456762354',
    '0',
    '1',
    '-1',
    '"abc"',
    '"\\"🦊\\""',
    '"\'\\n\\x09\\x9dĦ\\x00\\\\"',
    'a',
    'b',
    'c',
    'abc',
    '#tt',
    '#ff',
    '#1',
    '#2',
  ]);
});

test('Internalizing fibonacci-shaped structured types', () => {
  const data = new HashCons();
  const seq = [
    data.hide({ type: 'const', name: 'leaf', args: [] }),
    data.hide({ type: 'const', name: 'leaf', args: [] }),
  ];
  for (let i = 2; i < 1000; i++) {
    seq[i] = data.hide({ type: 'const', name: 'node', args: [seq[i - 2], seq[i - 1]] });
  }

  expect(seq[0]).toEqual(seq[1]);
  expect(data.toString(seq[1], false)).toEqual('leaf');
  expect(data.toString(seq[2], false)).toEqual('node leaf leaf');
  expect(data.toString(seq[3], false)).toEqual('node leaf (node leaf leaf)');
  expect(data.toString(seq[4], false)).toEqual(
    'node (node leaf leaf) (node leaf (node leaf leaf))',
  );

  for (let i = 3; i < 1000; i++) {
    const fib = data.expose(seq[i]);
    if (fib.type !== 'const') throw new Error();
    expect(fib.args[0]).toEqual(seq[i - 2]);
    expect(fib.args[1]).toEqual(seq[i - 1]);
    expect(fib.args[0]).not.toEqual(fib.args[1]);
  }

  let term = seq[999];
  for (let i = 999; i >= 0; i -= 2) {
    expect(term).toEqual(seq[i]);
    const fib = data.expose(seq[i]);
    if (fib.type !== 'const') throw new Error();
    term = fib.args[0];
  }
});
