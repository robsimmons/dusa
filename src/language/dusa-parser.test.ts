import { test, expect } from 'vitest';
import { parse } from './dusa-parser.js';
import { declToString } from './syntax.js';

function expectRoundTripToParse(input: string, output?: string) {
  if (output === undefined) output = input;
  const decls = parse(input);
  if (decls.errors !== null) {
    expect(`${decls.errors.length} error(s)`).toEqual(output);
    return;
  }
  expect(decls.document.map(declToString).join('\n')).toEqual(output);
}

test('Parser and pretty pretter idempotence', () => {
  expectRoundTripToParse('a b c d.');
  expectRoundTripToParse('a (b c) d.');
  expectRoundTripToParse('a b (c d).');
  expectRoundTripToParse('a (b c d).');
  expectRoundTripToParse('a ((((b)))).', 'a b.');

  expectRoundTripToParse('a :- b is _.');
  expectRoundTripToParse('a :- b _.');
  expectRoundTripToParse('a :- b _ is _.');
  expectRoundTripToParse('a :- 1 == 1.');
  expectRoundTripToParse('a :- 1 != 1.');
  expectRoundTripToParse('a :- 1 > 1.');
  expectRoundTripToParse('a :- 1 >= 1.');
  expectRoundTripToParse('a :- 1 < 1.');
  expectRoundTripToParse('a :- 1 <= 1.');

  expectRoundTripToParse('a is z.');
  expectRoundTripToParse('a is s z.');
  expectRoundTripToParse('a is s (s (s z)).');
  expectRoundTripToParse('a is { b }.', 'a is b.');
  expectRoundTripToParse('a is? b.');
  expectRoundTripToParse('a is? { b }.', 'a is? b.');
  expectRoundTripToParse('a is { b, c }.');
  expectRoundTripToParse('a is? { b, c }.');
  expectRoundTripToParse('a is { b, c d }.');
  expectRoundTripToParse('a is { b, c ((d e)) }.', 'a is { b, c (d e) }.');
  expectRoundTripToParse('a is 1.', 'a is 1.');
  expectRoundTripToParse('a is -1.', 'a is -1.');
  expectRoundTripToParse('a is "fish".', 'a is "fish".');
  expectRoundTripToParse('a is ().', 'a.');
  expectRoundTripToParse('a is? ().');
  expectRoundTripToParse('a () is 3.', 'a () is 3.');

  expectRoundTripToParse('#forbid a.')
  expectRoundTripToParse('#demand a.')

  // Deprecated syntax
  expectRoundTripToParse('a is { b? }.', 'a is? b.');
  expectRoundTripToParse('a is { a, b? }.', 'a is? { a, b }.');
});
