import { test, expect } from 'vitest';
import { binarize, binarizedProgramToString } from './binarize.js';
import { FlatDeclaration } from './flatten.js';
import { Pattern } from './terms.js';

const loc = { start: { line: 1, column: 1, index: 1 }, end: { line: 1, column: 2, index: 2 } };
const x: Pattern = { type: 'var', name: 'X' };
const y: Pattern = { type: 'var', name: 'Y' };

test(`binarizing a regular rule`, () => {
  const decl: FlatDeclaration = {
    type: 'Rule',
    premises: [
      { name: 'b', args: [], type: 'fact', value: null, loc },
      { name: 'c', args: [], type: 'fact', value: null, loc },
      { name: 'd', args: [x], type: 'fact', value: null, loc },
      { name: 'e', args: [], type: 'fact', value: null, loc },
    ],
    conclusion: { name: 'a', args: [x], type: 'datalog', loc },
    loc,
  };

  expect(binarizedProgramToString(binarize([{ name: 'r', decl }]))).toStrictEqual(
    `
Initial seeds: $r-0
Demands to derive: 
Forbids to derive: 
Rules:
$r-1 :- $r-0, b.
$r-2 :- $r-1, c.
$r-3 X :- $r-2, d X.
$r-4 X :- $r-3 X, e.
a X :- $r-4 X.
  `.trim(),
  );
});

test(`binarizing a #demand`, () => {
  const decl: FlatDeclaration = {
    type: 'Demand',
    premises: [
      { name: 'b', args: [x], type: 'fact', value: null, loc },
      { name: 'c', args: [x, y], type: 'fact', value: null, loc },
      { name: 'd', args: [y], type: 'fact', value: null, loc },
    ],
    loc,
  };

  expect(binarizedProgramToString(binarize([{ name: 'r', decl }]))).toStrictEqual(
    `
Initial seeds: $r-0
Demands to derive: $r-3
Forbids to derive: 
Rules:
$r-1 X :- $r-0, b X.
$r-2 Y :- $r-1 X, c X Y.
$r-3 :- $r-2 Y, d Y.
  `.trim(),
  );
});

test(`binarizing a #forbid`, () => {
  const decl: FlatDeclaration = {
    type: 'Forbid',
    premises: [{ name: 'b', args: [], type: 'fact', value: null, loc }],
    loc,
  };

  expect(binarizedProgramToString(binarize([{ name: 'r', decl }]))).toStrictEqual(
    `
Initial seeds: $r-0
Demands to derive: 
Forbids to derive: $r-1
Rules:
$r-1 :- $r-0, b.
  `.trim(),
  );
});
