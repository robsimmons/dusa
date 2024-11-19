import { test, expect } from 'vitest';
import { parse } from './dusa-parser.js';
import { check } from './check.js';
import { builtinModes } from './dusa-builtins.js';

function runCheck(source: string) {
  const parsed = parse(source);
  if (parsed.errors !== null) return { errors: parsed.errors };
  return check(builtinModes, parsed.document);
}

function runForErrors(source: string) {
  const { errors } = runCheck(source);
  return errors.map(
    ({ msg, loc }) =>
      `${!loc ? 'Err' : `${loc.start.line}:${loc.start.column}-${loc.end.line}:${loc.end.column}`}: ${msg}`,
  );
}

test('Static checks', () => {
  expect(runCheck('#builtin NAT_SUCC s\na 4.\nb X X is (s X) :- a X, c is X.')).toStrictEqual({
    builtins: new Map([['s', 'NAT_SUCC']]),
    arities: new Map([
      ['a', { args: 1, value: false }],
      ['b', { args: 2, value: true }],
      ['c', { args: 0, value: true }],
    ]),
    errors: [],
  });

  expect(runCheck('a.\na 4.')).toStrictEqual({
    builtins: new Map(),
    arities: new Map([['a', { args: 0, value: false }]]),
    errors: [
      {
        type: 'Issue',
        severity: 'error',
        loc: { start: { line: 2, column: 1, index: 3 }, end: { line: 2, column: 4, index: 6 } },
        msg: "First occurrence of 'a' (on line 1) has 0 arguments, but this occurrence has 1.",
      },
    ],
  });

  expect(runCheck('a is 4.\na 4.')).toStrictEqual({
    builtins: new Map(),
    arities: new Map([['a', { args: 0, value: true }]]),
    errors: [
      {
        type: 'Issue',
        severity: 'error',
        loc: { start: { line: 2, column: 1, index: 8 }, end: { line: 2, column: 4, index: 11 } },
        msg: "First occurrence of 'a' (on line 1) does have an associated value, but this occurrence does not.",
      },
    ],
  });

  expect(runCheck('a :- b _X _X.')).toStrictEqual({
    builtins: new Map(),
    arities: new Map([
      ['a', { args: 0, value: false }],
      ['b', { args: 2, value: false }],
    ]),
    errors: [
      {
        type: 'Issue',
        severity: 'error',
        msg: "The wildcard '_X' was already used in this rule (line 1, column 8). Named wildcards can't be repeated within a rule.",
        loc: { start: { line: 1, column: 11, index: 10 }, end: { line: 1, column: 13, index: 12 } },
      },
    ],
  });

  expect(runForErrors('#forbid a X.')).toStrictEqual([]);
  expect(runForErrors('#demand a X.')).toStrictEqual([]);
  expect(runForErrors('a X.')).toStrictEqual([
    "1:3-1:4: The variable 'X' can't be used in the conclusion of a rule without being used somewhere in a premise.",
  ]);
  expect(runForErrors('a _ X.')).toStrictEqual([
    "1:5-1:6: The variable 'X' can't be used in the conclusion of a rule without being used somewhere in a premise.",
    "1:3-1:4: Wildcards can't be used in the conclusion of a rule.",
  ]);
});

test('Error messages for named wildcards', () => {
  expect(runForErrors('a :- b _ 4 _.')).toStrictEqual([]);
  expect(runForErrors('a :- b _ 4 _X.')).toStrictEqual([]);
  expect(runForErrors('a :- b _X 4 _.')).toStrictEqual([]);
  expect(runForErrors('a :- b _X 4 _X.')).toStrictEqual([
    "1:13-1:15: The wildcard '_X' was already used in this rule (line 1, column 8). Named wildcards can't be repeated within a rule.",
  ]);
});

test('Built-in connected error messages', () => {
  expect(runForErrors('a :- 4 == X.')).toStrictEqual([]);
  expect(runForErrors('a :- X == 4.')).toStrictEqual([]);
  expect(runForErrors('a :- X == X.')).toStrictEqual([
    '1:6-1:12: The built-in relation EQUAL was given 2 arguments, and the arguments in positions 1 and 2 contain variables not bound by previous premises. This builtin does not support that mode of operation.',
  ]);
  expect(runForErrors('a :- 4 != _.')).toStrictEqual([]);
  expect(runForErrors('a :- 4 != X.')).toStrictEqual([
    '1:6-1:12: The built-in relation NOT_EQUAL was given 2 arguments, and the argument in position 2 contains variables not bound by previous premises. This builtin does not support that mode of operation.',
  ]);
  expect(runForErrors('a :- 4 < _.')).toStrictEqual([
    '1:6-1:11: The built-in relation CHECK_LT was given 2 arguments, and the argument in position 2 contains variables not bound by previous premises. This builtin does not support that mode of operation.',
  ]);
  expect(runForErrors('a :- 4 <= _.')).toStrictEqual([
    '1:6-1:12: The built-in relation CHECK_LEQ was given 2 arguments, and the argument in position 2 contains variables not bound by previous premises. This builtin does not support that mode of operation.',
  ]);
  expect(runForErrors('a :- 4 > _.')).toStrictEqual([
    '1:6-1:11: The built-in relation CHECK_GT was given 2 arguments, and the argument in position 2 contains variables not bound by previous premises. This builtin does not support that mode of operation.',
  ]);
  expect(runForErrors('a :- 4 >= _.')).toStrictEqual([
    '1:6-1:12: The built-in relation CHECK_GEQ was given 2 arguments, and the argument in position 2 contains variables not bound by previous premises. This builtin does not support that mode of operation.',
  ]);
  expect(runForErrors('#builtin INT_PLUS plus\na X :- plus 1 2 is X.')).toStrictEqual([]);
  expect(runForErrors('#builtin INT_PLUS plus\na X :- plus 1 X is 2.')).toStrictEqual([]);
  expect(runForErrors('#builtin INT_PLUS plus\na X :- plus X X is 2.')).toStrictEqual([
    '2:8-2:21: The built-in relation INT_PLUS was given 2 arguments, and the arguments in positions 1 and 2 contain variables not bound by previous premises. This builtin does not support that mode of operation.',
  ]);
  expect(runForErrors('#builtin INT_PLUS plus\na X :- plus X X is X.')).toStrictEqual([
    '2:8-2:21: The built-in relation INT_PLUS was given 2 arguments, and the arguments in positions 1 and 2, as well as the output, contain variables not bound by previous premises. This builtin does not support that mode of operation.',
  ]);
  expect(runForErrors('#builtin INT_PLUS plus\nplus X Y Z :- a X, a Y, a Z.')).toStrictEqual([
    "2:1-2:11: You can't use a rule to extend the built-in relation INT_PLUS.",
  ]);
  expect(runForErrors('#builtin EQUAL eq.\n#demand eq 1 2 is _.')).toStrictEqual([
    '2:9-2:20: The built-in relation EQUAL was given 2 arguments, and the output contains variables not bound by previous premises. This builtin does not support that mode of operation.',
  ]);
  expect(runForErrors('#builtin EQUAL eq\n#demand eq 1 2 is _.')).toStrictEqual([
    '2:9-2:20: The built-in relation EQUAL was given 2 arguments, and the output contains variables not bound by previous premises. This builtin does not support that mode of operation.',
  ]);

  expect(runForErrors('#builtin INT_PLUS plus\na :- plus X Y.')).toStrictEqual([
    "2:6-2:14: The built-in relation INT_PLUS needs to be given a value. If you don't care what the value is, you can just say 'plus X Y is _'.",
  ]);
});

test('Error messages for patterns', () => {
  expect(runCheck('#builtin INT_PLUS plus\na :- c X, b (plus 1 X).')).toStrictEqual({
    arities: new Map([
      ['a', { args: 0, value: false }],
      ['b', { args: 1, value: false }],
      ['c', { args: 1, value: false }],
    ]),
    builtins: new Map([['plus', 'INT_PLUS']]),
    errors: [],
  });
  expect(runCheck('#builtin INT_PLUS plus\na :- c _, b (plus 1 X).')).toStrictEqual({
    arities: new Map([
      ['a', { args: 0, value: false }],
      ['b', { args: 1, value: false }],
      ['c', { args: 1, value: false }],
    ]),
    builtins: new Map([['plus', 'INT_PLUS']]),
    errors: [
      {
        type: 'Issue',
        severity: 'error',
        msg: "Because plus is the built-in relation INT_PLUS, for it to be used like a function symbol, all the arguments must be grounded by a previous premise. If you want to use plus with a different mode, write it out as a separate premise, like 'plus * * is *'.",
        loc: { start: { line: 2, column: 14, index: 36 }, end: { line: 2, column: 22, index: 44 } },
      },
    ],
  });
  expect(runForErrors('a 3.\nb (a X).'));
});
