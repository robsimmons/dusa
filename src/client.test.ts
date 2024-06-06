import { test, expect } from 'vitest';
import { Dusa } from './client.js';

test('Client fundamentals', () => {
  const dusa = new Dusa(`
    path X Y :- edge X Y.
    path X Z :- edge X Y, path Y Z.`);

  expect(dusa.solution).not.toBeNull();
  expect([...dusa.solution!.facts]).toEqual([]);
  dusa.assert(
    { name: 'edge', args: [0, 1] },
    { name: 'edge', args: [1, 2] },
    { name: 'edge', args: [2, 3] },
  );

  expect(dusa.solution).not.toBeNull();
  expect([...dusa.solution!.lookup('edge')]).toEqual([
    [0n, 1n, null],
    [1n, 2n, null],
    [2n, 3n, null],
  ]);
  expect([...dusa.solution!.lookup('path')]).toEqual([
    [0n, 1n, null],
    [0n, 2n, null],
    [0n, 3n, null],
    [1n, 2n, null],
    [1n, 3n, null],
    [2n, 3n, null],
  ]);
  expect([...dusa.solution!.lookup('path', 0)]).toEqual([
    [1n, null],
    [2n, null],
    [3n, null],
  ]);

  dusa.assert({ name: 'edge', args: [2, 7] });
  dusa.assert({ name: 'edge', args: [7, -5] });
  expect([...dusa.solution!.lookup('path', 0)]).toEqual([
    [-5n, null],
    [1n, null],
    [2n, null],
    [3n, null],
    [7n, null],
  ]);

  expect(dusa.solution!.get('path', 0, -5)).toEqual(null);
  expect(dusa.solution!.get('path', 0, 99)).toEqual(undefined);
  expect(dusa.solution!.has('path', 0, 1)).toEqual(true);
  expect(dusa.solution!.has('path', 0, 4)).toEqual(false);
});

test('Fact enumeration', () => {
  const singleton = new Dusa(`fact 1 2 3 is "yo".`);
  expect(singleton.solution).not.toBeNull();
  expect([...singleton.solution!.facts]).toEqual([
    { name: 'fact', args: [1n, 2n, 3n], value: 'yo' },
  ]);

  const digits = new Dusa(`
    #builtin INT_MINUS minus
    digit 9.
    digit (minus N 1) :- digit N, N != 0.`);

  expect(digits.solution).not.toBeNull();
  expect([...digits.solution!.facts]).toEqual([
    { name: 'digit', args: [0n], value: null },
    { name: 'digit', args: [1n], value: null },
    { name: 'digit', args: [2n], value: null },
    { name: 'digit', args: [3n], value: null },
    { name: 'digit', args: [4n], value: null },
    { name: 'digit', args: [5n], value: null },
    { name: 'digit', args: [6n], value: null },
    { name: 'digit', args: [7n], value: null },
    { name: 'digit', args: [8n], value: null },
    { name: 'digit', args: [9n], value: null },
  ]);
});

test('Has and get', () => {
  const dusa = new Dusa(`
    edge 1 2.
    node 1.
    node 2.
    node 3.
    color 1 is "blue".
    color 2 is "red".`);

  expect(dusa.solution!.has('node', 1)).toBeTruthy();
  expect(dusa.solution!.has('node', 7)).toBeFalsy();
  expect(dusa.solution!.has('node', null)).toBeFalsy();
  expect(dusa.solution!.get('node', 3)).toBeNull();
  expect(dusa.solution!.get('node', 'hello')).toBeUndefined();

  expect(dusa.solution!.has('edge', 1, 2)).toBeTruthy();
  expect(dusa.solution!.has('edge', 2, 1)).toBeFalsy();
  expect(dusa.solution!.get('edge', 1, 2)).toBeNull();
  expect(dusa.solution!.get('edge', 2, 1)).toBeUndefined();

  expect(dusa.solution!.has('color', 1)).toBeTruthy();
  expect(dusa.solution!.has('color', 4)).toBeFalsy();
  expect(dusa.solution!.get('color', 2)).toEqual('red');
  expect(dusa.solution!.get('color', 5)).toBeUndefined();
});

test('Getting different kinds of arguments', () => {
  const dusa = new Dusa(`
    a is 12.
    b 1 is ().
    c () is true.
    d "a" is f q.
    e m is 9.
    e (f q) is p.`);
  expect(dusa.solution!.get('a')).toEqual(12n);
  expect(dusa.solution!.get('b', 1)).toEqual(null);
  expect(dusa.solution!.get('b', 0)).toBeUndefined();
  expect(dusa.solution!.get('b', { name: 'q' })).toBeUndefined();
  expect(dusa.solution!.get('c', null)).toEqual({ name: 'true' });
  expect(dusa.solution!.get('c', 1)).toBeUndefined();
  expect(dusa.solution!.get('c', { name: 'q' })).toBeUndefined();
});
