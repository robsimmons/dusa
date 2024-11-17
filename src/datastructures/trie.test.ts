import { test, expect } from 'vitest';
import {
  Trie,
  TrieNode,
  lookup as lookupTrie,
  insert as insertTrie,
  remove as removeTrie,
  visit,
} from './trie.js';
import { Ref } from './avl.js';

const lookup = <T>(t: Trie<string, T>, x: string[]) => {
  const res = lookupTrie(t, x, x.length);
  if (res === null || res.children !== null) return null;
  return res.value;
};
const insert = <T>(
  t: Trie<string, T>,
  x: string[],
  y: T,
): [TrieNode<string, T>, Trie<string, T>] => {
  const ref: Ref<TrieNode<string, T>> = { current: null };
  return [insertTrie(t, x, 0, x.length, y, ref), ref.current];
};
const remove = <T>(t: Trie<string, T>, x: string[]): null | [Trie<string, T>, T] => {
  const ref: Ref<TrieNode<string, T>> = { current: null };
  const res = removeTrie(t, x, 0, x.length, ref);
  if (ref.current === null) return null;
  if (ref.current.children !== null) return null;
  return [res, ref.current.value];
};

test('tries data structure', () => {
  let t: Trie<string, number> = null;
  let r: Trie<string, number>;

  expect(lookup(t, [])).toBeNull();
  expect(lookup(t, ['s', 't', 'a', 'r', 'e'])).toBeNull();
  expect([...visit(t, 0)]).toStrictEqual([]);
  expect([...visit(t, 5)]).toStrictEqual([]);

  [t] = insert(t, ['s', 't', 'a', 'r', 'e'], 4);
  expect(lookup(t, ['s', 't', 'a', 'r', 'e'])).toBe(4);
  expect(lookup(t, ['s', 't', 'o', 'r', 'e'])).toBeNull();
  expect(lookup(t, ['s', 't', 'o', 'n', 'e'])).toBeNull();
  expect(lookup(t, ['s', 't', 'o', 'n', 'y'])).toBeNull();
  expect(lookup(t, ['s', 't', 'o', 'v', 'e'])).toBeNull();
  expect(lookup(t, ['a', 't', 'o', 'n', 'e'])).toBeNull();
  expect(lookup(t, ['s', 't', 'o', 'n', 'k'])).toBeNull();
  expect([...visit(t, 0).map(({ keys }) => keys.join(''))]).toStrictEqual(['']);
  expect([...visit(t, 3).map(({ keys }) => keys.join(''))]).toStrictEqual(['sta']);
  expect([...visit(t, 5).map(({ keys }) => keys.join(''))]).toStrictEqual(['stare']);

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
  expect(r).toStrictEqual({ children: null, value: 6 });

  expect([...visit(t, 0).map(({ keys }) => keys.join(''))]).toStrictEqual(['']);
  expect([...visit(t, 1).map(({ keys }) => keys.join(''))]).toStrictEqual(['a', 's']);
  expect([...visit(t, 2).map(({ keys }) => keys.join(''))]).toStrictEqual(['at', 'st']);
  expect([...visit(t, 3).map(({ keys }) => keys.join(''))]).toStrictEqual(['ato', 'sta', 'sto']);
  expect([
    ...visit(t, 5).map(({ keys, value }) => [keys.join(''), value.children ?? value.value]),
  ]).toStrictEqual([
    ['atone', 9],
    ['stare', 1],
    ['stone', 2],
    ['stonk', 3],
    ['stony', 7],
    ['store', 5],
    ['stove', 8],
  ]);
  expect(() => [...visit(t, 6)]).toThrowError('Empty trie child');

  expect(remove(null, [])).toBeNull();
  expect(remove(null, ['a'])).toBeNull();
  expect(remove(null, ['a', 't', 'o', 'n', 'e'])).toBeNull();
  expect(remove(t, ['s', 't', 'o', 'm', 'p'])).toBeNull();
  expect(() => remove(t, ['s', 't', 'o', 'n', 'e', 's'])).toThrowError('Empty trie child');

  let n: number;
  [t, n] = remove(t, ['s', 't', 'o', 'n', 'k']) ?? [null, -1];
  expect(n).toBe(3);
  [t, n] = remove(t, ['s', 't', 'a', 'r', 'e']) ?? [null, -1];
  expect(n).toBe(1);
  [t, n] = remove(t, ['s', 't', 'o', 'n', 'e']) ?? [null, -1];
  expect(n).toBe(2);
  [t, n] = remove(t, ['a', 't', 'o', 'n', 'e']) ?? [null, -1];
  expect(n).toBe(9);
  [t, n] = remove(t, ['s', 't', 'o', 'r', 'e']) ?? [null, -1];
  expect(n).toBe(5);
  [t, n] = remove(t, ['s', 't', 'o', 'n', 'y']) ?? [null, -1];
  expect(n).toBe(7);
  [t, n] = remove(t, ['s', 't', 'o', 'v', 'e']) ?? [null, -1];
  expect(n).toBe(8);
  expect(t).toBeNull();
});
