import { test, expect } from 'vitest';
import {
  AVL,
  lookup as lookupAVL,
  insert as insertAVL,
  choose as chooseAVL,
  visit,
} from './avl.js';

// Adapted from https://www.cs.cmu.edu/~rjsimmon/15122-m15/lec/16-avl/bst-test.c0

const compare = (x: string, y: string) => (x < y ? 1 : x > y ? -1 : 0);
const lookup = <T>(t: AVL<string, T>, x: string) => lookupAVL(compare, t, x);
const insert = <T>(t: AVL<string, T>, x: string, y: T) => insertAVL(compare, t, x, y);

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
  expect(lookup(t, 'a')).toBe('2');
  expect(lookup(t, 'b')).toBeNull();
  expect(lookup(t, 'c')).toBe('4');

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

  let marks = Array.from({ length: LIMIT }).map(() => -1);
  for (let i = 0; i < LIMIT * LIMIT; i++) {
    const chosen = -chooseAVL(t)![1];
    marks[chosen] = chosen;
  }
  expect(marks).toStrictEqual(id);
});
