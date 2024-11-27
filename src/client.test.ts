import { test, expect } from 'vitest';
import { compareTerms, termToString, Dusa, DusaError } from './client.js';

function solutions(dusa: Dusa, pred: string = 'res') {
  const sols: string[] = [];
  for (const sol of dusa) {
    sols.push(
      [...sol.lookup(pred)]
        .toSorted(compareTerms)
        .map((args) => `${pred}${args.map((arg) => ` ${termToString(arg, true)}`).join('')}`)
        .join(', '),
    );
  }
  return sols.toSorted(new Intl.Collator('en').compare);
}

function runForDusaError(program: string) {
  try {
    new Dusa(program);
  } catch (e) {
    if (e instanceof DusaError) {
      return e.issues.map(({ msg }) => msg);
    }
  }
  return null;
}

let dusa: Dusa;

test('Basic operation', () => {
  dusa = new Dusa('a. c :- b.');
  expect(dusa.solution).not.toBeNull();
  expect(dusa.solution?.has('a')).toBe(true);
  expect(dusa.solution?.has('b')).toBe(false);
  expect(dusa.solution?.has('c')).toBe(false);
  dusa.assert({ name: 'b' });
  expect(dusa.solution?.has('a')).toBe(true);
  expect(dusa.solution?.has('b')).toBe(true);
  expect(dusa.solution?.has('c')).toBe(true);

  dusa = new Dusa('a is tt.');
  expect(dusa.solution).not.toBeNull();
  expect(dusa.solution?.get('a')).toStrictEqual({ name: 'tt' });
  dusa.assert({ name: 'a', value: 'ff' });
  expect(dusa.solution).toBeNull();

  expect(runForDusaError("a is '.")).toStrictEqual(["Unexpected symbol '''"]);
  expect(runForDusaError('a is ".')).toStrictEqual(['End of string not found at end of input']);
  expect(runForDusaError('a is ".\n')).toStrictEqual(['End of string not found at end of line']);
});

test('String escapes', () => {
  expect(
    solutions(new Dusa('res "\\0\\b\\f\\n\\r\\t\\v\\\'\\"\\\\\\x12\\u{12}\\u{2601}".')),
  ).toStrictEqual(['res "\\x00\\x08\\x0c\\n\\x0d\\x09\\x0b\'\\"\\\\\\x12\\x12\\u{2601}"']);

  expect(runForDusaError('a is "\\u{d901}".\n')).toStrictEqual([
    'Cannot encode lone surrogate \\u{d901}',
  ]);
  expect(runForDusaError('a is "\\u{999999999}".\n')).toStrictEqual([
    'Bad Unicode code point \\u{999999999}',
  ]);
  expect(runForDusaError('a is "\\q".\n')).toStrictEqual(['Invalid escape sequence \\q']);
  expect(runForDusaError('a is "\\\n')).toStrictEqual(['Backslash not supported at end of line']);
});

test('Parse errors', () => {
  expect(runForDusaError("a'")).toStrictEqual(["Invalid identifier 'a''"]);
  expect(runForDusaError('a')).toStrictEqual([
    "Expected to find ':-', but instead reached the end of input.",
  ]);
  expect(runForDusaError('a is {}.')).toStrictEqual([
    'Expected to find a term here, but no term found.',
  ]);
});

test('Exhaustive choices', () => {
  dusa = new Dusa('  p a is { tt, ff }.\n  p b is { tt, ff }.');
  expect(dusa.solution).not.toBeNull();
  expect([...dusa].length).toBe(4);
  expect(solutions(dusa, 'p')).toStrictEqual([
    'p a ff, p b ff',
    'p a ff, p b tt',
    'p a tt, p b ff',
    'p a tt, p b tt',
  ]);
  dusa.assert({ name: 'p', args: [{ name: 'a' }], value: 'qq' });
  expect(solutions(dusa, 'p')).toStrictEqual([]);
  expect(dusa.solution).toBeNull();
  expect([...dusa].length).toBe(0);
});

test('Non-exhaustive-choices', () => {
  dusa = new Dusa(`
    a is? ff.
    b is { tt, ff } :- a is ff.
    res 1 a.
    res 2 b.
  `);
  expect(solutions(dusa)).toStrictEqual(['res 1 ff, res 2 ff', 'res 1 ff, res 2 tt']);
});

test('Overlapping non-exhaustive and exhaustive choices', () => {
  dusa = new Dusa(`
    p.
    q.
    r is { a, b, d, e } :- p.
    r is? { a, b, c } :- p.
    r is { a, c, d, e } :- q.
    r is? c.
    r is? a.
    r is? f.
  `);
  expect(solutions(dusa, 'r')).toStrictEqual(['r a', 'r d', 'r e']);
});

test('Sorting', () => {
  dusa = new Dusa(
    `#builtin BOOLEAN_TRUE tt. #builtin BOOLEAN_FALSE tt. p (). p 3. p "Hello". p "Goodbye". p a. p (a 1). p (a "two"). p tt. p ff.`,
  );
  expect(solutions(dusa, 'p')).toStrictEqual([
    'p (), p bool#false, p "Goodbye", p "Hello", p 3, p (a "two"), p (a 1), p a, p ff',
  ]);
});

test('Builtin STRING_CONCAT', () => {
  expect(
    solutions(new Dusa('#builtin STRING_CONCAT concat\nb (concat "Hello" "World").'), 'b'),
  ).toStrictEqual(['b "HelloWorld"']);
  expect(
    solutions(new Dusa('#builtin STRING_CONCAT concat\nb (concat "Hello" " " "World" "!").'), 'b'),
  ).toStrictEqual(['b "Hello World!"']);
  expect(
    solutions(new Dusa('#builtin STRING_CONCAT concat\nb X :- concat "A" "B" is X.'), 'b'),
  ).toStrictEqual(['b "AB"']);
  expect(
    solutions(new Dusa('#builtin STRING_CONCAT concat\nb (concat "Hello" 4).'), 'b'),
  ).toStrictEqual(['']);
  expect(
    solutions(new Dusa('#builtin STRING_CONCAT concat\nb X :- concat "A" X is "ABBC".'), 'b'),
  ).toStrictEqual(['b "BBC"']);
  expect(
    solutions(new Dusa('#builtin STRING_CONCAT concat\nb X :- concat X "C" is "ABBC".'), 'b'),
  ).toStrictEqual(['b "ABB"']);
  expect(
    solutions(new Dusa('#builtin STRING_CONCAT concat\nb X :- concat a X is "ABBC".'), 'b'),
  ).toStrictEqual(['']);
  expect(
    solutions(new Dusa('#builtin STRING_CONCAT concat\nb X :- concat X 3 is "ABBC".'), 'b'),
  ).toStrictEqual(['']);
  expect(
    solutions(new Dusa('#builtin STRING_CONCAT concat\nb X :- concat "AB" X "BA" is "ABBA".'), 'b'),
  ).toStrictEqual(['b ""']);
  expect(
    solutions(
      new Dusa(
        '#builtin STRING_CONCAT concat\nb X :- concat "A--" "Z--" X "-B" "-C" is "A--Z--and-B-C".',
      ),
      'b',
    ),
  ).toStrictEqual(['b "and"']);
  expect(
    solutions(
      new Dusa(
        '#builtin STRING_CONCAT concat\nb X :- concat "A-" "Z--" X "-B" "-C" is "A--Z--and-B-C".',
      ),
      'b',
    ),
  ).toStrictEqual(['']);
  expect(
    solutions(
      new Dusa(
        '#builtin STRING_CONCAT concat\nb X :- concat "A--" "Z--" X "-C" "-C" is "A--Z--and-B-C".',
      ),
      'b',
    ),
  ).toStrictEqual(['']);
});

test('Builtin STRING_CONCAT, full reverse', () => {
  expect(
    solutions(new Dusa('#builtin STRING_CONCAT concat\nres X Y :- concat X Y is "abc".')),
  ).toStrictEqual(['res "" "abc", res "a" "bc", res "ab" "c", res "abc" ""']);

  expect(
    solutions(new Dusa('#builtin STRING_CONCAT concat\nres X :- concat X a X is "abc".')),
  ).toStrictEqual(['']);

  expect(
    solutions(
      new Dusa(`
      #builtin STRING_CONCAT concat
      speaks "says".
      speaks "exclaims".
      speaks 4.

      saying "frog says hello".
      saying "horse beats hoofs".
      saying "timmy exclaims yay".

      res X Y :- saying S, speaks Verb, concat X " " Verb " " Y is S.
    `),
    ),
  ).toStrictEqual(['res "frog" "hello", res "timmy" "yay"']);
});

test('Builtin INT_MINUS (issue #29)', () => {
  expect(
    solutions(new Dusa("#builtin INT_MINUS minus.\ny 4.\nx N :- y N', minus N 1 is N'."), 'x'),
  ).toStrictEqual(['x 5']);
});

test('Lazy execution', () => {
  expect(
    solutions(
      new Dusa(`
      #lazy lt
      lt z (s N).
      lt (s N) (s M) :- lt N M.

      p (s (s (s z))).
      p (s z).
      p z.

      res X Y :- p X, p Y, lt X Y.
    `),
    ),
  ).toStrictEqual(['res (s z) (s (s (s z))), res z (s (s (s z))), res z (s z)']);
});
