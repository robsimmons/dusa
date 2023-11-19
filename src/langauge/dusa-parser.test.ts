import { test, expect } from 'vitest';
import { parse } from './dusa-parser';
import { declToString } from './syntax';

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

  expectRoundTripToParse('a is z.');
  expectRoundTripToParse('a is s z.');
  expectRoundTripToParse('a is s (s (s z)).');
  expectRoundTripToParse('a is { b }.', 'a is b.');
  expectRoundTripToParse('a is { ? }.');
  expectRoundTripToParse('a is { b? }.');
  expectRoundTripToParse('a is { b, c }.');
  expectRoundTripToParse('a is { b, c? }.');
  expectRoundTripToParse('a is { b, c d }.');
  expectRoundTripToParse('a is { b, c ((d e)) }.', 'a is { b, c (d e) }.');
});
