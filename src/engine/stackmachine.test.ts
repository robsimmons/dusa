import { test, expect } from 'vitest';
import { Data, HashCons } from '../datastructures/data.js';
import { nondeterministicStringMatcher } from './stackmachine.js';

const data = new HashCons();
function testMatcher(mem: Data[], segments: (number | string)[], str: string) {
  const result: (null | string)[][] = [];
  for (const match of nondeterministicStringMatcher(data, mem, segments, str)) {
    result.push(
      match.map((x) => {
        const d = data.expose(x);
        if (d.type === 'string') return d.value;
        else return null;
      }),
    );
  }
  return result;
}

test('nondeterministicStringMatcher', () => {
  expect(testMatcher([], [0, 1, 2], 'abc')).toStrictEqual([
    ['', '', 'abc'],
    ['', 'a', 'bc'],
    ['', 'ab', 'c'],
    ['', 'abc', ''],
    ['a', '', 'bc'],
    ['a', 'b', 'c'],
    ['a', 'bc', ''],
    ['ab', '', 'c'],
    ['ab', 'c', ''],
    ['abc', '', ''],
  ]);

  expect(testMatcher([], [0, 1, 1, 1], 'aaaa')).toStrictEqual([
    ['a', 'a'],
    ['aaaa', ''],
  ]);

  expect(testMatcher([], [0, 0, 0], 'aaaa')).toStrictEqual([]);

  expect(testMatcher([], [0, 'a', 1], 'aaba')).toStrictEqual([
    ['', 'aba'],
    ['a', 'ba'],
    ['aab', ''],
  ]);

  expect(testMatcher([HashCons.BOOL_FALSE], [0, ' ', 1], 'my dog has')).toStrictEqual([
    [null, 'my', 'dog has'],
    [null, 'my dog', 'has'],
  ]);
});
