import { test, expect } from 'vitest';
import { AVL, lookup as lookupAVL, insert as insertAVL } from './avl.js';

// Adapted from https://www.cs.cmu.edu/~rjsimmon/15122-m15/lec/16-avl/bst-test.c0

const compare = (x: string, y: string) => (x < y ? 1 : x > y ? -1 : 0);
const lookup = lookupAVL(compare);
const insert = insertAVL<string, string>(compare);

test('black-box 1', () => {
  let t: AVL<string, string> = null;
  expect(lookup(t, 'a')).toBeNull();

  t = insert(t, 'a', '1');
  expect(lookup(t, 'a')).toStrictEqual('1');
  expect(lookup(t, 'b')).toBeNull();
  expect(lookup(t, 'c')).toBeNull();
  const copy = t;

  t = insert(t, 'c', '3');
  expect(lookup(t, 'a')).toStrictEqual('1');
  expect(lookup(t, 'b')).toBeNull();
  expect(lookup(t, 'c')).toStrictEqual('3');

  t = insert(t, 'a', '2');
  expect(lookup(t, 'a')).toStrictEqual('2');
  expect(lookup(t, 'b')).toBeNull();
  expect(lookup(t, 'c')).toStrictEqual('3');

  t = insert(t, 'c', '4');
  expect(lookup(t, 'a')).toStrictEqual('2');
  expect(lookup(t, 'b')).toBeNull();
  expect(lookup(t, 'c')).toStrictEqual('4');

  expect(lookup(copy, 'a')).toStrictEqual('1');
  expect(lookup(copy, 'b')).toBeNull();
  expect(lookup(copy, 'c')).toBeNull();
});

test('black-box 2', () => {
  let t: AVL<string, string> = null;
  expect(lookup(t, '')).toBeNull();
  expect(lookup(t, 'pancakes')).toBeNull();

  t = insert(t, 'waffles', '1');
  expect(lookup(t, 'waffles')).toStrictEqual('1');
  expect(lookup(t, '')).toBeNull();
  expect(lookup(t, 'pancakes')).toBeNull();

  t = insert(t, 'waffles', '2');
  expect(lookup(t, 'waffles')).toStrictEqual('2');

  t = insert(t, 'fruit', '3');
  expect(lookup(t, 'waffles')).toStrictEqual('2');
  expect(lookup(t, 'fruit')).toStrictEqual('3');
  expect(lookup(t, '')).toBeNull();
  expect(lookup(t, 'pancakes')).toBeNull();

  t = insert(t, '', '4');
  expect(lookup(t, 'waffles')).toStrictEqual('2');
  expect(lookup(t, 'fruit')).toStrictEqual('3');
  expect(lookup(t, '')).toStrictEqual('4');
  expect(lookup(t, 'pancakes')).toBeNull();
});

test('insert random', () => {
  const LIMIT = 25;

  let next = 0;
  const A = Array.from({ length: LIMIT }).map(() => {
    next = (next * 1664525 + 1013904223) % 0x100000000;
    return `${next}`;
  });

  let t: AVL<string, string> = null;
  for (const [i, key] of A.entries()) {
    for (let j = 0; j < i; j++) {
      expect(lookup(t, A[j])).toStrictEqual(`${j}`);
    }
    for (let j = i; j < LIMIT; j++) {
      expect(lookup(t, A[j])).toBeNull();
    }
    t = insert(t, key, `${i}`);
  }

  for (const [i, key] of A.entries()) {
    for (let j = 0; j < i; j++) {
      expect(lookup(t, A[j])).toStrictEqual(`${-j}`);
    }
    for (let j = i; j < LIMIT; j++) {
      expect(lookup(t, A[j])).toStrictEqual(`${j}`);
    }
    t = insert(t, key, `${-i}`);
  }
});
