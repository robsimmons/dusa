import { Conclusion, Declaration, Equality, Inequality, Proposition } from './datalog/syntax';
import { parsePattern } from './datalog/terms';

/* helper functions */
export function prop(name: string, args: string[], value: string = '()'): Proposition {
  return { type: 'Proposition', name, args: [...args.map(parsePattern), parsePattern(value)] };
}

export function neq(a: string, b: string): Inequality {
  return { type: 'Inequality', a: parsePattern(a), b: parsePattern(b) };
}

export function eq(a: string, b: string): Equality {
  return { type: 'Equality', a: parsePattern(a), b: parsePattern(b) };
}

export function fact(name: string, args: string[], value: string = '()'): Declaration {
  return { type: 'Rule', premises: [], conclusion: conc(name, args, [value], null) };
}

export function conc(
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

export const edges: Declaration[] = [
  fact('edge', ['a', 'b']),
  fact('edge', ['b', 'c']),
  fact('edge', ['c', 'd']),
  fact('edge', ['d', 'e']),
  fact('edge', ['e', 'f']),
  fact('edge', ['f', 'c']),
  fact('edge', ['g', 'f']),
  fact('edge', ['j', 'g']),
  { type: 'Rule', premises: [prop('edge', ['X', 'Y'])], conclusion: conc('path', ['X', 'Y']) },
  {
    type: 'Rule',
    premises: [prop('edge', ['X', 'Y']), prop('path', ['Y', 'Z'])],
    conclusion: conc('path', ['X', 'Z']),
  },
];

export const aspLike: Declaration[] = [
  // { a, b, c } :- !p.
  { type: 'Rule', premises: [], conclusion: conc('p', [], ['false'], '...') },
  {
    type: 'Rule',
    premises: [prop('p', [], 'false')],
    conclusion: conc('a', [], ['true', 'false']),
  },
  {
    type: 'Rule',
    premises: [prop('p', [], 'false')],
    conclusion: conc('b', [], ['true', 'false']),
  },
  {
    type: 'Rule',
    premises: [prop('p', [], 'false')],
    conclusion: conc('c', [], ['true', 'false']),
  },

  // q :- !p.
  { type: 'Rule', premises: [], conclusion: conc('p', [], ['false'], '...') },
  { type: 'Rule', premises: [prop('p', [], 'false')], conclusion: conc('q', [], ['true']) },

  // a :- q.
  { type: 'Rule', premises: [prop('q', [], 'true')], conclusion: conc('a', [], ['true']) },
];

export const nats: Declaration[] = [
  fact('even', ['10']),
  { type: 'Rule', premises: [prop('even', ['s(X)'])], conclusion: conc('odd', ['X']) },
  { type: 'Rule', premises: [prop('odd', ['s(X)'])], conclusion: conc('even', ['X']) },
];

export const ints: Declaration[] = [
  { type: 'Rule', premises: [], conclusion: conc('a', [], ['1', '2', '3', '4', '5', '6', '7']) },
  {
    type: 'Rule',
    premises: [],
    conclusion: conc('b', [], ['-1', '2', '-3', '4', '-5', '6', '-6']),
  },
  { type: 'Rule', premises: [], conclusion: conc('c', [], ['1', '2', '3', '4', '5', '6', '7']) },
  {
    type: 'Rule',
    premises: [prop('a', [], 'A'), prop('b', [], 'B')],
    conclusion: conc('c', [], ['plus A B']),
  },
];

export const characters: Declaration[] = [
  // Four characters
  fact('character', ['celeste']),
  fact('character', ['nimbus']),
  fact('character', ['luna']),
  fact('character', ['terra']),

  // left is { celeste, nimbus, terra, luna } :-.
  // right is { celeste, nimbus, terra, luna } :-.
  // :- left is C, right is C.
  // :- left is C1, race C1 is R, right is C2, race C2 is R.

  {
    type: 'Rule',
    premises: [],
    conclusion: conc('blueteam', [], ['celeste', 'nimbus', 'terra', 'luna']),
  },
  {
    type: 'Rule',
    premises: [],
    conclusion: conc('redteam', [], ['celeste', 'nimbus', 'terra', 'luna']),
  },
  {
    type: 'Constraint',
    premises: [prop('blueteam', [], 'C'), prop('redteam', [], 'C')],
  },
  {
    type: 'Constraint',
    premises: [
      prop('blueteam', [], 'C1'),
      prop('race', ['C1'], 'R'),
      prop('redteam', [], 'C2'),
      prop('race', ['C2'], 'R'),
    ],
  },

  // Every character has a home in one of four places
  {
    type: 'Rule',
    premises: [prop('character', ['C'])],
    conclusion: conc('home', ['C'], ['uplands', 'lowlands', 'catlands', 'doghouse']),
  },

  // Every character is one of four races
  {
    type: 'Rule',
    premises: [prop('character', ['C'])],
    conclusion: conc('race', ['C'], ['cat', 'dog', 'horse', 'bird']),
  },

  // Birds live in the uplands
  {
    type: 'Rule',
    premises: [prop('race', ['C'], 'bird')],
    conclusion: conc('home', ['C'], ['uplands']),
  },

  // Only dogs live in the doghouse
  {
    type: 'Rule',
    premises: [prop('home', ['C'], 'doghouse')],
    conclusion: conc('race', ['C'], ['dog']),
  },

  // Celeste and nimbus live in the same place and have the same race (this demonstrates
  // two different ways of doing the same thing)
  {
    type: 'Constraint',
    premises: [prop('home', ['nimbus'], 'H1'), prop('home', ['celeste'], 'H2'), neq('H1', 'H2')],
  },
  {
    type: 'Rule',
    premises: [prop('race', ['nimbus'], 'R')],
    conclusion: conc('race', ['celeste'], ['R']),
  },

  // Luna and terra live in different places
  {
    type: 'Constraint',
    premises: [prop('home', ['luna'], 'H'), prop('home', ['terra'], 'H')],
  },

  // At most one person in the doghouse
  {
    type: 'Constraint',
    premises: [prop('home', ['C1'], 'doghouse'), prop('home', ['C2'], 'doghouse'), neq('C1', 'C2')],
  },

  // Birds avoid the catlands
  {
    type: 'Constraint',
    premises: [prop('race', ['C'], 'bird'), prop('home', ['C'], 'catlands')],
  },
];

export function mapgen(width: number, minPathLength: number): Declaration[] {
  return [
    fact('size', [], `${width}`),
    fact('minPathLength', [], `${minPathLength}`),
    {
      type: 'Rule',
      premises: [prop('minPathLength', [], 'T')],
      conclusion: conc('subPathLength', ['plus T -1']),
    },
    {
      type: 'Rule',
      premises: [prop('subPathLength', ['T']), neq('T', '0')],
      conclusion: conc('subPathLength', ['plus T -1']),
    },

    { type: 'Rule', premises: [prop('size', [], 'X')], conclusion: conc('dim', ['X']) },
    {
      type: 'Rule',
      premises: [prop('dim', ['plus 1 X']), neq('X', '0')],
      conclusion: conc('dim', ['X']),
    },
    {
      type: 'Rule',
      premises: [prop('dim', ['X']), prop('dim', ['Y'])],
      conclusion: conc('position', ['X', 'Y'], ['liquid', 'solid']),
    },
    fact('step', ['0', '-1']),
    fact('step', ['0', '1']),
    fact('step', ['-1', '0']),
    fact('step', ['1', '0']),
    fact('start', ['1', '1']),
    {
      type: 'Rule',
      premises: [prop('size', [], 'X')],
      conclusion: conc('finish', ['X', 'X']),
    },
    {
      type: 'Rule',
      premises: [prop('start', ['X', 'Y']), prop('position', ['X', 'Y'], 'solid')],
      conclusion: conc('reachable', ['X', 'Y']),
    },
    {
      type: 'Rule',
      premises: [
        prop('reachable', ['X', 'Y']),
        prop('step', ['DX', 'DY']),
        eq('plus X DX', 'NX'),
        eq('plus Y DY', 'NY'),
        prop('position', ['NX', 'NY'], 'solid'),
      ],
      conclusion: conc('reachable', ['NX', 'NY']),
    },
    {
      type: 'Rule',
      premises: [prop('finish', ['X', 'Y']), prop('reachable', ['X', 'Y'])],
      conclusion: conc('complete', []),
    },
    {
      type: 'Rule',
      premises: [prop('start', ['X', 'Y']), prop('position', ['X', 'Y'], 'solid')],
      conclusion: conc('at', ['X', 'Y', '0']),
    },
    {
      type: 'Rule',
      premises: [
        prop('at', ['X', 'Y', 'T']),
        prop('subPathLength', ['T']),
        prop('position', ['X', 'Y'], 'solid'),
        prop('step', ['DX', 'DY']),
        eq('plus X DX', 'NX'),
        eq('plus Y DY', 'NY'),
        prop('position', ['NX', 'NY'], 'solid'),
      ],
      conclusion: conc('at', ['NX', 'NY', 'plus T 1']),
    },
    {
      type: 'Rule',
      premises: [prop('finish', ['X', 'Y']), prop('at', ['X', 'Y', 'T'])],
      conclusion: conc('speedrun', []),
    },
    { type: 'Constraint', premises: [prop('speedrun', [])] },
  ];
}
