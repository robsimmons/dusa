import { test, expect } from 'vitest';
import { Dusa } from './client';

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
    { args: [0n, 1n], value: null },
    { args: [1n, 2n], value: null },
    { args: [2n, 3n], value: null },
  ]);
  expect([...dusa.solution!.lookup('path')]).toEqual([
    { args: [0n, 1n], value: null },
    { args: [0n, 2n], value: null },
    { args: [0n, 3n], value: null },
    { args: [1n, 2n], value: null },
    { args: [1n, 3n], value: null },
    { args: [2n, 3n], value: null },
  ]);
  expect([...dusa.solution!.lookup('path', 0)]).toEqual([
    { args: [1n], value: null },
    { args: [2n], value: null },
    { args: [3n], value: null },
  ]);

  dusa.assert({ name: 'edge', args: [2, 7] });
  dusa.assert({ name: 'edge', args: [7, -5] });
  expect([...dusa.solution!.lookup('path', 0)]).toEqual([
    { args: [-5n], value: null },
    { args: [1n], value: null },
    { args: [2n], value: null },
    { args: [3n], value: null },
    { args: [7n], value: null },
  ]);
});
