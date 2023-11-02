import { compile } from './compile';
import { execute, factToString } from './engine';
import { Conclusion, Declaration, Equality, Inequality, Premise, Proposition } from './syntax';
import { parsePattern, termToString } from './terms';
import { test, expect } from 'vitest';

/* helper functions */
function prop(name: string, args: string[], value: string = '()'): Proposition {
  return { type: 'Proposition', name, args: [...args.map(parsePattern), parsePattern(value)] };
}

function neq(a: string, b: string): Inequality {
  return { type: 'Inequality', a: parsePattern(a), b: parsePattern(b) };
}

function eq(a: string, b: string): Equality {
  return { type: 'Equality', a: parsePattern(a), b: parsePattern(b) };
}

function conc(
  name: string,
  args: string[],
  values: string[] = ['()'],
  isThereMore: null | '...' = null,
): Conclusion {
  return {
    name,
    args: args.map(parsePattern),
    values: values.map(parsePattern),
    exhaustive: isThereMore === null,
  };
}

function rule(conclusion: Conclusion, ...premises: Premise[]): Declaration {
  return { type: 'Rule', premises, conclusion };
}

test('Multi-step deducation', () => {
  const decls: Declaration[] = [
    rule(conc('a', []), eq('1', '1'), neq('0', 's z')),
    rule(conc('b', []), prop('a', []), prop('a', [])),
    rule(conc('c', []), prop('b', [])),
    rule(conc('d', []), prop('c', []), eq('z', '1')),
    rule(conc('e', []), prop('d', [])),
  ];

  const { program, initialDb } = compile(decls);
  const { solutions, deadEnds, splits, highWater } = execute(program, initialDb);
  expect(solutions.length).toEqual(1);
  expect(deadEnds).toEqual(0);
  expect(splits).toEqual(0);
  expect(highWater).toEqual(1);
  expect(solutions[0].unfacts).toEqual([]);

  const facts = solutions[0].facts.map(factToString);
  expect(facts.length).toEqual(3);
  expect(facts).toContainEqual('a');
  expect(facts).toContainEqual('b');
  expect(facts).toContainEqual('c');
});

test('Exhaustive choices', () => {
  const decls: Declaration[] = [
    rule(conc('a', [], ['true', 'false'])),
    rule(conc('b', [], ['true', 'false'])),
  ];

  const { program, initialDb } = compile(decls);
  const { solutions, deadEnds, splits, highWater } = execute(program, initialDb);
  expect(solutions.length).toEqual(4);
  expect(deadEnds).toEqual(0);
  expect(splits).toEqual(3);
  expect(highWater).toEqual(3);
  expect(solutions.map(({ unfacts }) => unfacts)).toEqual([[], [], [], []]);

  const facts = solutions
    .map((solution) => solution.facts.map(factToString).sort().join(', '))
    .sort();
  expect(facts).toEqual([
    'a is false, b is false',
    'a is false, b is true',
    'a is true, b is false',
    'a is true, b is true',
  ]);
});

test('Non-exhaustive choice', () => {
  const decls: Declaration[] = [
    rule(conc('a', [], ['false'], '...')),
    rule(conc('b', [], ['true', 'false']), prop('a', [], 'false')),
  ];

  const { program, initialDb } = compile(decls);
  const { solutions, deadEnds, splits, highWater } = execute(program, initialDb);
  expect(solutions.length).toEqual(3);
  expect(deadEnds).toEqual(0);
  expect(splits).toEqual(2);
  expect(highWater).toEqual(3);
  expect(
    solutions
      .map(({ unfacts }) =>
        unfacts.map(
          ([attribute, data]) => `${attribute} ${data.map((term) => termToString(term)).join(' ')}`,
        ),
      )
      .sort((a, b) => a.length - b.length),
  ).toEqual([[], [], ['a false']]);

  const facts = solutions
    .map((solution) => solution.facts.map(factToString).sort().join(', '))
    .sort();
  expect(facts).toEqual(['', 'a is false, b is false', 'a is false, b is true']);
});

test('Plus is okay if grounded by previous rules', () => {
  const decls: Declaration[] = [
    rule(conc('a', ['12'])),
    rule(conc('a', ['7'])),
    rule(conc('a', ['2'])),
    rule(conc('d', ['9'])),
    rule(conc('d', ['19'])),
    rule(conc('d', ['6'])),
    rule(conc('e', ['X', 'Y']), prop('a', ['X']), prop('a', ['Y']), prop('d', ['plus X Y'])),
  ];
  const { program, initialDb } = compile(decls);
  const { solutions, deadEnds, splits, highWater } = execute(program, initialDb);
  expect(solutions.length).toEqual(1);
  expect(deadEnds).toEqual(0);
  expect(splits).toEqual(0);
  expect(highWater).toEqual(1);
  const facts = solutions
    .map((solution) => solution.facts.map(factToString).sort().join(', '))
    .sort();
  expect(facts).toEqual(['a 12, a 2, a 7, d 19, d 6, d 9, e 12 7, e 2 7, e 7 12, e 7 2']);
});
