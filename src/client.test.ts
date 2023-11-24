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
});
