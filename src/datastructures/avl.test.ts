import { test, expect } from 'vitest';
import {
  AVL,
  lookup as lookupAVL,
  insert as insertAVL,
  choose as chooseAVL,
  remove as removeAVL,
  visit,
  iterator,
} from './avl.js';

// Adapted from https://www.cs.cmu.edu/~rjsimmon/15122-m15/lec/16-avl/bst-test.c0

const compare = (x: string, y: string) => (x < y ? 1 : x > y ? -1 : 0);
const lookup = <T>(t: AVL<string, T>, x: string) => lookupAVL(compare, t, x);
const insert = <T>(t: AVL<string, T>, x: string, y: T) => insertAVL(compare, t, x, y);
const remove = <T>(t: AVL<string, T>, x: string) => removeAVL(compare, t, x);

test('black-box 1', () => {
  let t: AVL<string, string> = null;
  expect(lookup(t, 'a')).toBeNull();

  [t] = insert(t, 'a', '1');
  expect(lookup(t, 'a')).toBe('1');
  expect(lookup(t, 'b')).toBeNull();
  expect(lookup(t, 'c')).toBeNull();
  const copy = t;

  [t] = insert(t, 'c', '3');
  expect(lookup(t, 'a')).toBe('1');
  expect(lookup(t, 'b')).toBeNull();
  expect(lookup(t, 'c')).toBe('3');

  [t] = insert(t, 'a', '2');
  expect(lookup(t, 'a')).toBe('2');
  expect(lookup(t, 'b')).toBeNull();
  expect(lookup(t, 'c')).toBe('3');

  [t] = insert(t, 'c', '4');
  [t] = insert(t, 'b', '9');
  expect(lookup(t, 'a')).toBe('2');
  expect(lookup(t, 'b')).toBe('9');
  expect(lookup(t, 'c')).toBe('4');
  expect(remove(t, 'a')).not.toBeNull();
  expect(remove(t, 'b')).not.toBeNull();
  expect(remove(t, 'c')).not.toBeNull();
  expect(remove(t, 'd')).toBeNull();

  const removeResult = remove(t, 'b');
  expect(removeResult).not.toBeNull();
  expect(removeResult![1]).toBe('9');
  [t] = removeResult!;

  expect([...visit(t)]).toStrictEqual([
    { key: 'a', value: '2' },
    { key: 'c', value: '4' },
  ]);

  expect(lookup(copy, 'a')).toBe('1');
  expect(lookup(copy, 'b')).toBeNull();
  expect(lookup(copy, 'c')).toBeNull();
});

test('black-box 2', () => {
  let t: AVL<string, string> = null;
  let r: string | null;
  expect(lookup(t, '')).toBeNull();
  expect(lookup(t, 'pancakes')).toBeNull();

  [t, r] = insert(t, 'waffles', '1');
  expect(r).toBeNull();
  expect(lookup(t, 'waffles')).toBe('1');
  expect(lookup(t, '')).toBeNull();
  expect(lookup(t, 'pancakes')).toBeNull();

  [t, r] = insert(t, 'waffles', '2');
  expect(r).toBe('1');
  expect(lookup(t, 'waffles')).toBe('2');

  [t] = insert(t, 'fruit', '3');
  expect(lookup(t, 'waffles')).toBe('2');
  expect(lookup(t, 'fruit')).toBe('3');
  expect(lookup(t, '')).toBeNull();
  expect(lookup(t, 'pancakes')).toBeNull();

  [t] = insert(t, '', '4');
  expect(lookup(t, 'waffles')).toBe('2');
  expect(lookup(t, 'fruit')).toBe('3');
  expect(lookup(t, '')).toBe('4');
  expect(lookup(t, 'pancakes')).toBeNull();
});

test('insert and remove in different orders', () => {
  let t: AVL<string, number>;
  let r: number | null;
  const tb = { height: 1, key: 'b', left: null, right: null, value: 1 };
  const td = { height: 1, key: 'd', left: null, right: null, value: 2 };

  [t, r] = insert(null, 'b', 1);
  expect(t).toStrictEqual(tb);
  expect(r).toBeNull();

  [t, r] = insert(t, 'd', 2);
  expect(t).toStrictEqual({ height: 2, key: 'b', value: 1, left: null, right: td });
  expect(r).toBeNull();

  expect(remove(t, 'a')).toBeNull();
  expect(remove(t, 'b')).toStrictEqual([td, 1]);
  expect(remove(t, 'c')).toBeNull();
  expect(remove(t, 'd')).toStrictEqual([tb, 2]);
  expect(remove(t, 'e')).toBeNull();

  [t, r] = insert(null, 'd', 2);
  expect(t).toStrictEqual(td);
  expect(r).toBeNull();

  [t, r] = insert(t, 'b', 1);
  expect(t).toStrictEqual({ height: 2, key: 'd', value: 2, left: tb, right: null });
  expect(r).toBeNull();

  expect(remove(t, 'a')).toBeNull();
  expect(remove(t, 'b')).toStrictEqual([td, 1]);
  expect(remove(t, 'c')).toBeNull();
  expect(remove(t, 'd')).toStrictEqual([tb, 2]);
  expect(remove(t, 'e')).toBeNull();
  expect([...iterator(t)]).toStrictEqual([
    ['b', 1],
    ['d', 2],
  ]);
});

test('insert random', () => {
  const LIMIT = 25;
  const id = Array.from({ length: LIMIT }).map((_, i) => i);

  let next = 0;
  const A = Array.from({ length: LIMIT }).map(() => {
    next = (next * 1664525 + 1013904223) % 0x100000000;
    return `${next}`;
  });

  let t: AVL<string, number> = null;
  for (const [i, key] of A.entries()) {
    for (let j = 0; j < i; j++) {
      expect(lookup(t, A[j])).toBe(j);
    }
    for (let j = i; j < LIMIT; j++) {
      expect(lookup(t, A[j])).toBeNull();
    }
    expect([...iterator(t)].toSorted(([_kA, a], [_kB, b]) => a - b).map(([_, x]) => x)).toStrictEqual(
      Array.from({ length: i }).map((_, n) => n),
    );
    [t] = insert(t, key, i);
  }

  expect([...visit(t)].map(({ value }) => value).toSorted((a, b) => a - b)).toStrictEqual(id);
  for (const [i, key] of A.entries()) {
    for (let j = 0; j < i; j++) {
      expect(lookup(t, A[j])).toBe(-j);
    }
    for (let j = i; j < LIMIT; j++) {
      expect(lookup(t, A[j])).toBe(j);
    }
    [t] = insert(t, key, -i);
  }
  expect([...visit(t)].map(({ value }) => -value).toSorted((a, b) => a - b)).toStrictEqual(id);

  for (let i = 0; i < LIMIT; i++) {
    const [key, value] = chooseAVL(t) ?? ['', 0];
    expect(key).not.toBe('');

    const removeResult = remove(t, key);
    expect(removeResult).not.toBeNull();

    let r: number;
    [t, r] = removeResult!;
    expect(r).toBe(value);
  }
  expect(t).toBeNull();
  expect(chooseAVL(t)).toBeNull();
});
