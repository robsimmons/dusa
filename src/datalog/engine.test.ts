import { compile } from './compile';
import { execute, factToString } from './engine';
import { Conclusion, Declaration, Equality, Inequality, Premise, Proposition } from './syntax';
import { parsePattern, termToString } from './terms';

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
        unfacts.map(([attribute, data]) => `${attribute} ${data.map(termToString).join(' ')}`),
      )
      .sort((a, b) => a.length - b.length),
  ).toEqual([[], [], ['a false']]);

  const facts = solutions
    .map((solution) => solution.facts.map(factToString).sort().join(', '))
    .sort();
  expect(facts).toEqual(['', 'a is false, b is false', 'a is false, b is true']);
});
