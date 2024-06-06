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
  expectRoundTripToParse('a is s z.', 'a is (s z).');
  expectRoundTripToParse('a is (s (s (s z))).');
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
  expectRoundTripToParse('a.');
  expectRoundTripToParse('a is ().');
  expectRoundTripToParse('a is? ().');
  expectRoundTripToParse('a () is 3.', 'a () is 3.');

  expectRoundTripToParse('#forbid a.');
  expectRoundTripToParse('#demand a.');
  expectRoundTripToParse('#builtin INT_PLUS plus');
  expectRoundTripToParse('#builtin INT_PLUS plus.', '#builtin INT_PLUS plus');

  // Deprecated syntax
  expectRoundTripToParse('a is { b? }.', '1 error(s)');
  expectRoundTripToParse('a is { a, b? }.', '1 error(s)');
});

test('Test full parses', () => {
  expect(parse('')).toStrictEqual({ document: [], errors: null });
  expect(parse('#')).toStrictEqual({ document: [], errors: null });
  expect(parse('# ')).toStrictEqual({ document: [], errors: null });

  expect(parse('##')).toStrictEqual({
    errors: [
      {
        type: 'Issue',
        loc: { start: { column: 1, line: 1, index: 0 }, end: { column: 3, line: 1, index: 2 } },
        msg: "The symbol '#' should be followed by a constant (directive) or space (comment).",
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
        loc: { start: { column: 1, line: 1, index: 0 }, end: { line: 1, column: 6, index: 5 } },
      },
    ],
  });

  expect(parse('#builtin')).toStrictEqual({
    errors: [
      {
        type: 'Issue',
        severity: 'error',
        msg: '#builtin must be followed by the ALL_CAPS name of a built-in operation. Options are BOOLEAN_FALSE, BOOLEAN_TRUE, CHECK_GEQ, CHECK_GT, CHECK_LEQ, CHECK_LT, EQUAL, INT_MINUS, INT_PLUS, INT_TIMES, NAT_SUCC, NAT_ZERO, NOT_EQUAL, STRING_CONCAT.',
        loc: { start: { line: 1, column: 1, index: 0 }, end: { line: 1, column: 9, index: 8 } },
      },
    ],
  });

  expect(parse('#builtin BOB')).toStrictEqual({
    errors: [
      {
        type: 'Issue',
        severity: 'error',
        msg: '#builtin must be followed by the ALL_CAPS name of a built-in operation. Options are BOOLEAN_FALSE, BOOLEAN_TRUE, CHECK_GEQ, CHECK_GT, CHECK_LEQ, CHECK_LT, EQUAL, INT_MINUS, INT_PLUS, INT_TIMES, NAT_SUCC, NAT_ZERO, NOT_EQUAL, STRING_CONCAT.',
        loc: { start: { line: 1, column: 1, index: 0 }, end: { line: 1, column: 13, index: 12 } },
      },
    ],
  });

  expect(parse('#builtin INT_PLUS')).toStrictEqual({
    errors: [
      {
        type: 'Issue',
        severity: 'error',
        msg: '#builtin INT_PLUS must be followed by a constant to use for the built-in operation.',
        loc: { start: { line: 1, column: 1, index: 0 }, end: { line: 1, column: 18, index: 17 } },
      },
    ],
  });

  expect(parse('a is? tt.')).toStrictEqual({
    document: [
      {
        type: 'Rule',
        conclusion: {
          name: 'a',
          args: [],
          type: 'open',
          loc: { start: { line: 1, column: 1, index: 0 }, end: { line: 1, column: 9, index: 8 } },
          values: [
            {
              name: 'tt',
              type: 'const',
              args: [],
              loc: {
                start: { line: 1, column: 7, index: 6 },
                end: { line: 1, column: 9, index: 8 },
              },
            },
          ],
        },
        premises: [],
        loc: { start: { line: 1, column: 1, index: 0 }, end: { line: 1, column: 10, index: 9 } },
      },
    ],
    errors: null,
  });

  expect(parse('a is {tt?}.')).toStrictEqual({
    errors: [
      {
        type: 'Issue',
        severity: 'error',
        msg: "Expected to find ',', but instead found '?'.",
        loc: { start: { line: 1, column: 9, index: 8 }, end: { line: 1, column: 10, index: 9 } },
      },
    ],
  });

  expect(parse('a.')).toStrictEqual({
    document: [
      {
        type: 'Rule',
        conclusion: {
          name: 'a',
          args: [],
          type: 'datalog',
          loc: { start: { line: 1, column: 1, index: 0 }, end: { line: 1, column: 2, index: 1 } },
        },
        premises: [],
        loc: { start: { line: 1, column: 1, index: 0 }, end: { line: 1, column: 3, index: 2 } },
      },
    ],
    errors: null,
  });
});
