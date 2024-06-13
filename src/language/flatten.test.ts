import { test, expect } from 'vitest';
import { parse } from './dusa-parser.js';
import { flatDeclToString, flattenDecls } from './flatten.js';
import { BUILT_IN_PRED } from './dusa-builtins.js';

function flatten(preds: ([string] | [string, BUILT_IN_PRED])[], source: string) {
  const parsed = parse(source);
  if (parsed.errors !== null) return [`${parsed.errors.length} error(s) at parsing`];
  const flattened = flattenDecls(
    new Map(preds as [string, BUILT_IN_PRED | undefined][]),
    parsed.document,
  );
  return flattened.map(flatDeclToString);
}

test('Program flattening', () => {
  expect(flatten([], 'a X :- b (s X).')).toStrictEqual(['a X :- b (s X).']);
  expect(flatten([['s']], 'a X :- c X, b (s X).')).toStrictEqual(['a X :- c X, s X is #1, b #1.']);
  expect(flatten([], '#demand f X Y, h (plus X Y).')).toStrictEqual([
    '#demand f X Y, h (plus X Y).',
  ]);
  expect(flatten([['plus']], '#demand f X Y, h (plus X Y).')).toStrictEqual([
    '#demand f X Y, plus X Y is #1, h #1.',
  ]);
  expect(flatten([['plus']], '#demand f X, g Y, h (plus X Y).')).toStrictEqual([
    '#demand f X, g Y, plus X Y is #1, h #1.',
  ]);
  expect(
    flatten([['plus']], '#demand f X Y, g (plus X X) (plus X Y), h (plus Y Y).'),
  ).toStrictEqual([
    '#demand f X Y, plus X X is #1, plus X Y is #2, g #1 #2, plus Y Y is #3, h #3.',
  ]);
  expect(flatten([['plus']], '#forbid f X Y, g (plus (plus X X) (plus X Y)).')).toStrictEqual([
    '#forbid f X Y, plus X X is #1, plus X Y is #2, plus #1 #2 is #3, g #3.',
  ]);
  expect(flatten([['s']], 'a (s X) :- b X.')).toStrictEqual(['a #1 :- b X, s X is #1.']);
  expect(flatten([], 'a :- 0 != s z, 1 == s z.')).toStrictEqual([
    'a :- .NOT_EQUAL 0 (s z) is (), .EQUAL 1 (s z) is ().',
  ]);
  expect(flatten([['s']], 'a :- 0 != s z, 1 == s z.')).toStrictEqual([
    'a :- s z is #1, .NOT_EQUAL 0 #1 is (), s z is #2, .EQUAL 1 #2 is ().',
  ]);
  expect(
    flatten(
      [
        ['s', 'NAT_SUCC'],
        ['z', 'NAT_ZERO'],
      ],
      'a :- 0 != s z, 1 == s z.',
    ),
  ).toStrictEqual([
    'a :- .NAT_ZERO is #1, .NAT_SUCC #1 is #2, .NOT_EQUAL 0 #2 is (), .NAT_ZERO is #3, .NAT_SUCC #3 is #4, .EQUAL 1 #4 is ().',
  ]);
  expect(flatten([['s', 'NAT_SUCC']], 'a X :- b Y, s Y is X.')).toStrictEqual([
    'a X :- b Y, .NAT_SUCC Y is X.',
  ]);
  expect(flatten([['b']], 'a (b X Y Z) :- c Y.')).toStrictEqual(['a #1 :- c Y, b X Y Z is #1.']);
  expect(flatten([['b']], 'a (b X Y Z) :- c X Y Z.')).toStrictEqual([
    'a #1 :- c X Y Z, b X Y Z is #1.',
  ]);
});
