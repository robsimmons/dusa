import { test, expect } from 'vitest';
import { DataView, dataToString, expose, hide } from './data.js';

test('Internalizing basic types', () => {
  const testData: DataView[] = [
    { type: 'triv' },
    { type: 'int', value: 123n },
    { type: 'int', value: 0n },
    { type: 'string', value: 'abc' },
    { type: 'const', name: 'a', args: [] },
    { type: 'const', name: 'b', args: [] },
    { type: 'const', name: 'c', args: [] },
    { type: 'const', name: 'abc', args: [] },
  ];

  for (const d1 of testData) {
    for (const d2 of testData) {
      if (d1 === d2) {
        expect(hide(d1)).toEqual(hide(d2));
      } else {
        expect(hide(d1)).not.toEqual(hide(d2));
      }
    }
  }

  expect(hide({ type: 'triv' })).toEqual(hide({ type: 'triv' }));
});

test('Internalizing fibonacci-shaped structured types', () => {
  const seq = [
    hide({ type: 'const', name: 'leaf', args: [] }),
    hide({ type: 'const', name: 'leaf', args: [] }),
  ];
  for (let i = 2; i < 1000; i++) {
    seq[i] = hide({ type: 'const', name: 'node', args: [seq[i - 2], seq[i - 1]] });
  }

  expect(seq[0]).toEqual(seq[1]);
  expect(dataToString(seq[1], false)).toEqual('leaf');
  expect(dataToString(seq[2], false)).toEqual('node leaf leaf');
  expect(dataToString(seq[3], false)).toEqual('node leaf (node leaf leaf)');
  expect(dataToString(seq[4], false)).toEqual('node (node leaf leaf) (node leaf (node leaf leaf))');

  for (let i = 3; i < 1000; i++) {
    const fib = expose(seq[i]);
    if (fib.type !== 'const') throw new Error();
    expect(fib.args[0]).toEqual(seq[i - 2]);
    expect(fib.args[1]).toEqual(seq[i - 1]);
    expect(fib.args[0]).not.toEqual(fib.args[1]);
  }

  let term = seq[999];
  for (let i = 999; i >= 0; i -= 2) {
    expect(term).toEqual(seq[i]);
    const fib = expose(seq[i]);
    if (fib.type !== 'const') throw new Error();
    term = fib.args[0];
  }
});
