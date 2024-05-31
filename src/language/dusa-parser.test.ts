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

  expectRoundTripToParse('#forbid a.');
  expectRoundTripToParse('#demand a.');

  // Deprecated syntax
  expectRoundTripToParse('a is { b? }.', 'a is? b.');
  expectRoundTripToParse('a is { a, b? }.', 'a is? { a, b }.');
});

test('Test full parses', () => {
  expect(parse('')).toStrictEqual({ document: [], errors: null });
  expect(parse('#')).toStrictEqual({ document: [], errors: null });
  expect(parse('# ')).toStrictEqual({ document: [], errors: null });

  expect(parse('##')).toStrictEqual({
    errors: [
      {
        type: 'Issue',
        loc: { start: { column: 1, line: 1 }, end: { column: 3, line: 1 } },
        msg: 'Expect # to be followed by a constant (directive) or space (comment)',
        severity: 'error',
      },
    ],
  });

  expect(parse('#void')).toStrictEqual({
    errors: [
      {
        type: 'Issue',
        severity: 'error',
        msg: "Unexpected directive 'void'. Valid directives are #builtin, #demand, and #forbid.",
        loc: { start: { column: 1, line: 1 }, end: { line: 1, column: 6 } },
      },
    ],
  });

  expect(parse('a is { tt? }.')).toStrictEqual({
    document: [
      {
        type: 'Rule',
        conclusion: {
          name: 'a',
          args: [],
          exhaustive: false,
          loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 13 } },
          values: [
            {
              name: 'tt',
              type: 'const',
              args: [],
              loc: { start: { line: 1, column: 8 }, end: { line: 1, column: 10 } },
            },
          ],
        },
        premises: [],
        deprecatedQuestionMark: { start: { line: 1, column: 10 }, end: { line: 1, column: 11 } },
        loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 14 } },
      },
    ],
    errors: null,
  });

  expect(parse('a.')).toStrictEqual({
    document: [
      {
        type: 'Rule',
        conclusion: {
          name: 'a',
          args: [],
          exhaustive: true,
          loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
          values: null,
        },
        premises: [],
        deprecatedQuestionMark: undefined,
        loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 3 } },
      },
    ],
    errors: null,
  });
});
