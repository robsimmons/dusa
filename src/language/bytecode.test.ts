import { test, expect } from 'vitest';
import { srcToBinarized } from './binarize.test.js';
import { makeIntermediatePredicatesMatchJoinOrder } from './binarize.js';
import { generateIndices } from './indexes.js';
import { generateBytecode } from './bytecode.js';

function srcToBytecode(source: string) {
  const binarized = srcToBinarized(source);
  return generateBytecode(
    makeIntermediatePredicatesMatchJoinOrder(generateIndices(binarized)),
    new Map(),
    new Set(),
  );
}

const int_ = (value: bigint) => ({ type: 'int', value });
const str_ = (value: string) => ({ type: 'string', value });
const var_ = (ref: number) => ({ type: 'var', ref });

test('builtins and functional predicates', () => {
  expect(srcToBytecode('s 2 is 3. p 3 :- N == 3, 3 == s 2.')).toStrictEqual({
    demands: [],
    forbids: [],
    arities: {},
    lazy: [],
    seeds: ['$seed'],
    rules: [
      {
        type: 'unary',
        premise: { name: 's', args: [int_(2n), var_(0)] },
        conclusion: { type: 'datalog', name: '$s-1', args: [var_(0)] },
      },
      {
        type: 'unary',
        premise: { name: '$seed', args: [] },
        conclusion: { type: 'closed', name: 's', args: [int_(2n)], choices: [int_(3n)] },
      },
      {
        type: 'unary',
        premise: { name: '$seed', args: [] },
        conclusion: { type: 'intermediate', name: 'p-1-0', vars: [] },
      },
      {
        type: 'run',
        inName: 'p-1-0',
        inVars: 0,
        instructions: [{ type: 'const', const: int_(3n) }, { type: 'store' }],
        conclusion: { type: 'intermediate', name: 'p-1-1', vars: [] },
      },
      {
        type: 'join',
        inName: 'p-1-1',
        inVars: 0,
        premise: { name: '$s-1', args: 1 },
        shared: 0,
        conclusion: { type: 'intermediate', name: 'p-1-2', vars: [0] },
      },
      {
        type: 'run',
        inName: 'p-1-2',
        inVars: 1,
        instructions: [
          { type: 'const', const: int_(3n) },
          { type: 'load', ref: 0 },
          { type: 'equal' },
        ],
        conclusion: { type: 'datalog', name: 'p', args: [int_(3n)] },
      },
    ],
  });

  expect(
    srcToBytecode('#builtin STRING_CONCAT concat\nb X :- concat "A" "" X "BA" "" is "ABBA".'),
  ).toStrictEqual({
    demands: [],
    forbids: [],
    arities: {},
    lazy: [],
    seeds: ['$seed'],
    rules: [
      {
        type: 'unary',
        premise: { name: '$seed', args: [] },
        conclusion: { type: 'intermediate', name: 'b-1-0', vars: [] },
      },
      {
        type: 'run',
        inName: 'b-1-0',
        inVars: 0,
        instructions: [
          { type: 'const', const: str_('ABBA') },
          { type: 'const', const: str_('A') },
          { type: 's_starts' },
          { type: 'const', const: str_('') },
          { type: 's_starts' },
          { type: 'const', const: str_('') },
          { type: 's_ends' },
          { type: 'const', const: str_('BA') },
          { type: 's_ends' },
          { type: 'store' },
        ],
        conclusion: { type: 'datalog', name: 'b', args: [{ type: 'var', ref: 0 }] },
      },
    ],
  });
});
