import { test, expect } from 'vitest';
import { parse } from './dusa-parser.js';
import { check } from './check.js';

function runCheck(source: string) {
  const parsed = parse(source);
  if (parsed.errors !== null) return { errors: parsed.errors };
  return check(parsed.document);
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

test('Wildcards and grounding', () => {
  expect(runForErrors('a :- _ == b _.')).toStrictEqual([
    '1:6-1:14: Only one side of an equality may contain variables not bound by previous premises.',
  ]);
  expect(runForErrors('a :- X == b X.')).toStrictEqual([
    '1:6-1:14: Only one side of an equality may contain variables not bound by previous premises.',
  ]);

  expect(runForErrors('a :- _ != b _.')).toStrictEqual([
    '1:6-1:14: Only one side of an inequality may contain wildcards. Here, both sides do.',
  ]);

  expect(runForErrors('a :- X != b Y.')).toStrictEqual([
    "1:6-1:7: An inequality cannot include a variable like X that is not bound by a previous premise. (Suggestion: would it work to replace 'X' with '_' or '_X'?)",
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
    '1:6-1:12: Only one side of an equality may contain variables not bound by previous premises.',
  ]);
  expect(runForErrors('a :- 4 != _.')).toStrictEqual([]);
  expect(runForErrors('a :- 4 != X.')).toStrictEqual([
    "1:11-1:12: An inequality cannot include a variable like X that is not bound by a previous premise. (Suggestion: would it work to replace 'X' with '_' or '_X'?)",
  ]);
  expect(runForErrors('a :- 4 < _.')).toStrictEqual([
    '1:6-1:11: Both sides of a comparison must be bound by previous premises.',
  ]);
  expect(runForErrors('a :- 4 <= X.')).toStrictEqual([
    '1:6-1:12: Both sides of a comparison must be bound by previous premises.',
  ]);
  expect(runForErrors('a :- X > _.')).toStrictEqual([
    '1:6-1:11: Both sides of a comparison must be bound by previous premises.',
  ]);
  expect(runForErrors('a :- X >= X.')).toStrictEqual([
    '1:6-1:12: Both sides of a comparison must be bound by previous premises.',
  ]);
  expect(runForErrors('#builtin INT_PLUS plus\na X :- plus 1 2 is X.')).toStrictEqual([]);
  expect(runForErrors('#builtin INT_PLUS plus\na X :- plus 1 X is 2.')).toStrictEqual([]);
  expect(runForErrors('#builtin INT_PLUS plus\na X :- plus X X is 2.')).toStrictEqual([
    "2:8-2:21: At most one argument to 'plus' (builtin INT_PLUS) can contain variables not bound by previous premises.",
  ]);
  expect(runForErrors('#builtin INT_PLUS plus\na X :- plus X X is X.')).toStrictEqual([
    "2:8-2:21: When arguments to 'plus' (builtin INT_PLUS) are not all bound by previous premises, the conclusion must be bound by previous premises. That isn't the case here.",
  ]);
  expect(runForErrors('#builtin INT_PLUS plus\nplus X Y Z :- a X, a Y, a Z.')).toStrictEqual([
    "2:1-2:11: You can't use a rule to extend the built-in relation INT_PLUS.",
  ]);

  expect(runForErrors('#builtin INT_PLUS plus\na :- plus X Y.')).toStrictEqual([
    "2:6-2:14: The built-in relation INT_PLUS needs to be given a value. If you don't care what the value is, you can just say 'plus X Y is _'.",
  ]);
});

test('Modes', () => {
  expect(runForErrors('#builtin NAT_ZERO z. a :- z is X, z is X.')).toStrictEqual([]);
  expect(runForErrors('#builtin INT_PLUS plus. a :- plus _ _ is _.')).toStrictEqual([
    "1:30-1:43: When arguments to 'plus' (builtin INT_PLUS) are not all bound by previous premises, the conclusion must be bound by previous premises. That isn't the case here.",
  ]);
  expect(runForErrors('#builtin INT_MINUS minus. a :- minus _ _ is _.')).toStrictEqual([
    "1:32-1:46: This mode of operation for 'minus' (builtin INT_MINUS), with arguments #1, #2 and the value not bound by previous premises, is not supported.",
  ]);
  expect(runForErrors('#builtin INT_MINUS minus. a :- minus _ _ is 4.')).toStrictEqual([
    "1:32-1:46: This mode of operation for 'minus' (builtin INT_MINUS), with arguments #1, #2 not bound by previous premises, is not supported.",
  ]);
  expect(runForErrors('#builtin INT_TIMES times. a :- times _ _ is 4.')).toStrictEqual([
    "1:32-1:46: All arguments to 'times' (builtin INT_TIMES) must be bound by previous premises.",
  ]);
});

test('Transformation-involved errors', () => {
  expect(runForErrors('a. b a.')).toStrictEqual([
    "1:6-1:7: The relation 'a' can't be used in a term position like this, as it does not have a value.",
  ]);

  expect(runForErrors('a is 4. b (a 1 2 3).')).toStrictEqual([
    "1:12-1:19: The relation 'a' takes 0 arguments, but only 3 arguments were given here.",
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
