import { test, expect } from 'vitest';
import { Trie, lookup as lookupTrie, insert as insertTrie, visit } from './trie.js';

const compare = (x: string, y: string) => (x < y ? 1 : x > y ? -1 : 0);
const lookup = <T>(t: Trie<string, T>, x: string[]) => {
  const res = lookupTrie(compare, t, x);
  if (res === null || res.child !== null) return null;
  return res.value;
};
const insert = <T>(t: Trie<string, T>, x: string[], y: T) => insertTrie(compare, t, 0, x, y);

test('simple tries', () => {
  let t: Trie<string, number> = null;
  let r: Trie<string, number>;

  expect(lookup(t, [])).toBeNull();
  expect(lookup(t, ['s', 't', 'a', 'r', 'e'])).toBeNull();

  [t] = insert(t, ['s', 't', 'a', 'r', 'e'], 4);
  expect(lookup(t, ['s', 't', 'a', 'r', 'e'])).toBe(4);
  expect(lookup(t, ['s', 't', 'o', 'r', 'e'])).toBeNull();
  expect(lookup(t, ['s', 't', 'o', 'n', 'e'])).toBeNull();
  expect(lookup(t, ['s', 't', 'o', 'n', 'y'])).toBeNull();
  expect(lookup(t, ['s', 't', 'o', 'v', 'e'])).toBeNull();
  expect(lookup(t, ['a', 't', 'o', 'n', 'e'])).toBeNull();
  expect(lookup(t, ['s', 't', 'o', 'n', 'k'])).toBeNull();

  [t] = insert(t, ['s', 't', 'o', 'r', 'e'], 5);
  [t] = insert(t, ['s', 't', 'o', 'n', 'e'], 6);
  [t] = insert(t, ['s', 't', 'o', 'n', 'y'], 7);
  [t] = insert(t, ['s', 't', 'o', 'v', 'e'], 8);
  [t, r] = insert(t, ['a', 't', 'o', 'n', 'e'], 9);
  expect(lookup(t, ['s', 't', 'a', 'r', 'e'])).toBe(4);
  expect(lookup(t, ['s', 't', 'o', 'r', 'e'])).toBe(5);
  expect(lookup(t, ['s', 't', 'o', 'n', 'e'])).toBe(6);
  expect(lookup(t, ['s', 't', 'o', 'n', 'y'])).toBe(7);
  expect(lookup(t, ['s', 't', 'o', 'v', 'e'])).toBe(8);
  expect(lookup(t, ['a', 't', 'o', 'n', 'e'])).toBe(9);
  expect(lookup(t, ['s', 't', 'o', 'n', 'k'])).toBeNull();
  expect(r).toBeNull();

  [t, r] = insert(t, ['s', 't', 'o', 'n', 'e'], 2);
  [t] = insert(t, ['s', 't', 'a', 'r', 'e'], 1);
  [t] = insert(t, ['s', 't', 'o', 'n', 'k'], 3);
  expect(lookup(t, ['s', 't', 'a', 'r', 'e'])).toBe(1);
  expect(lookup(t, ['s', 't', 'o', 'r', 'e'])).toBe(5);
  expect(lookup(t, ['s', 't', 'o', 'n', 'e'])).toBe(2);
  expect(lookup(t, ['s', 't', 'o', 'n', 'y'])).toBe(7);
  expect(lookup(t, ['s', 't', 'o', 'v', 'e'])).toBe(8);
  expect(lookup(t, ['a', 't', 'o', 'n', 'e'])).toBe(9);
  expect(lookup(t, ['s', 't', 'o', 'n', 'k'])).toBe(3);
  expect(r).toStrictEqual({ child: null, value: 6 });

  expect([...visit(t).map(({ keys, value }) => [keys.join(''), value])]).toStrictEqual([
    ['atone', 9],
    ['stare', 1],
    ['stone', 2],
    ['stonk', 3],
    ['stony', 7],
    ['store', 5],
    ['stove', 8],
  ]);
});
