import { test, expect } from 'vitest';
import {
  createSearchState,
  InternalProgram,
  learnImmediateConsequences,
  SearchState,
} from './forwardengine.js';
import { HashCons } from '../datastructures/data.js';

function step(prog: InternalProgram, state: SearchState) {
  if (state.agenda === null) throw new Error();
  const { data, next } = state.agenda;
  state.agenda = next;
  return learnImmediateConsequences(prog, state, data);
}

test('datalog, unary consequences', () => {
  // c :- a.  d :- c. e :- c. g :- f.
  const prog: InternalProgram = {
    seeds: ['a'],
    predUnary: {
      a: [{ args: [], conclusion: { type: 'datalog', name: 'c', args: [] } }],
      c: [
        { args: [], conclusion: { type: 'datalog', name: 'd', args: [] } },
        { args: [], conclusion: { type: 'datalog', name: 'e', args: [] } },
      ],
      f: [{ args: [], conclusion: { type: 'datalog', name: 'g', args: [] } }],
    },
    predBinary: {},
    intermediates: {},
    demands: [],
    forbids: {},
    data: new HashCons(),
  };

  let state: SearchState;
  let result: any;

  state = createSearchState(prog);
  expect(step(prog, state)).toBeNull();
  expect(state.explored.get('a', [])).toStrictEqual({ type: 'just', just: HashCons.TRIVIAL });
  expect(step(prog, state)).toBeNull();
  expect(state.explored.get('c', [])).toStrictEqual({ type: 'just', just: HashCons.TRIVIAL });
  expect(step(prog, state)).toBeNull();
  expect(step(prog, state)).toBeNull();
  expect(state.explored.get('d', [])).toStrictEqual({ type: 'just', just: HashCons.TRIVIAL });
  expect(state.explored.get('e', [])).toStrictEqual({ type: 'just', just: HashCons.TRIVIAL });
  expect(state.agenda).toBeNull();

  prog.predUnary['a'].push({
    args: [],
    conclusion: { type: 'intermediate', name: '@x', vars: [] },
  });
  prog.forbids = { '@x': true };
  state = createSearchState(prog);
  expect(step(prog, state)).toBeNull();
  expect(step(prog, state)).toStrictEqual({ type: 'forbid', name: '@x' });

  prog.predUnary['a'].pop();
  prog.forbids = {};
  prog.demands = ['@x'];
  prog.predUnary.e = [
    {
      args: [],
      conclusion: { type: 'intermediate', name: '@x', vars: [] },
    },
  ];
  state = createSearchState(prog);
  expect(state.demands.get('@x', [])).not.toBeNull();
  expect(step(prog, state)).toBeNull(); // pop a
  expect(state.agenda!.next).toBeNull();
  expect(step(prog, state)).toBeNull(); // pop c
  expect(state.agenda!.next!.next).toBeNull();
  expect(step(prog, state)).toBeNull(); // pop d or e
  expect(step(prog, state)).toBeNull(); // pop d or e or @x
  expect(step(prog, state)).toBeNull(); // pop d or e or @x
  expect(state.agenda).toBeNull();
  expect(state.demands.get('@x', [])).toBeNull();

  prog.predUnary.d = [
    {
      args: [],
      conclusion: {
        type: 'closed',
        name: 'h',
        args: [],
        values: [{ type: 'bool', value: true }],
      },
    },
  ];
  prog.predUnary.e = [
    {
      args: [],
      conclusion: {
        type: 'closed',
        name: 'h',
        args: [],
        values: [{ type: 'bool', value: false }],
      },
    },
  ];
  state = createSearchState(prog);
  expect(step(prog, state)).toBeNull(); // pop a
  expect(step(prog, state)).toBeNull(); // pop b
  expect(step(prog, state)).toBeNull(); // pop c
  expect(step(prog, state)).toBeNull(); // pop d or e
  result = step(prog, state) ?? step(prog, state); // if h is popped first, need 2 steps
  expect(result).not.toBeNull();
  result.new.push(result.old);
  delete result.old;
  result.new.sort();
  expect(result).toStrictEqual({ type: 'incompatible', name: 'h', args: [], new: [1, 2] });

  prog.predUnary.d = [
    {
      args: [],
      conclusion: {
        type: 'closed',
        name: 'h',
        args: [],
        values: [
          { type: 'int', value: 5n },
          { type: 'int', value: 6n },
        ],
      },
    },
  ];
  prog.predUnary.e = [
    {
      args: [],
      conclusion: {
        type: 'closed',
        name: 'h',
        args: [],
        values: [
          { type: 'int', value: 6n },
          { type: 'int', value: 7n },
        ],
      },
    },
  ];
  state = createSearchState(prog);
  expect(step(prog, state)).toBeNull(); // pop a
  expect(step(prog, state)).toBeNull(); // pop c
  expect(step(prog, state)).toBeNull(); // pop d or e
  expect(state.deferred.get('h', [])).toBe(true);
  expect(step(prog, state)).toBeNull(); // pop d or e (h is deferred)
  expect(state.deferred.get('h', [])).toBe(null);
  expect(state.agenda!.data.name).toBe('h');
  expect(state.frontier.get('h', [])).not.toBeNull();
  expect(step(prog, state)).toBeNull(); // pop h
  expect(state.explored.get('h', [])).toStrictEqual({ type: 'just', just: 6n });
  expect(state.frontier.get('h', [])).toBeNull();

  prog.predUnary.e = [
    {
      args: [],
      conclusion: {
        type: 'closed',
        name: 'h',
        args: [],
        values: [
          { type: 'int', value: 16n },
          { type: 'int', value: 17n },
        ],
      },
    },
  ];
  state = createSearchState(prog);
  expect(step(prog, state)).toBeNull(); // pop a
  expect(step(prog, state)).toBeNull(); // pop c
  expect(step(prog, state)).toBeNull(); // pop d or e
  expect(state.deferred.get('h', [])).toBe(true);
  result = step(prog, state); // pop d or e (h is deferred)
  expect(result).not.toBeNull();
  delete result.new;
  delete result.old;
  expect(result).toStrictEqual({ type: 'incompatible', name: 'h', args: [] });

  prog.predUnary.d[0].conclusion.type = 'open';
  prog.predUnary.e[0].conclusion.type = 'open';
  state = createSearchState(prog);
  expect(step(prog, state)).toBeNull();
  expect(step(prog, state)).toBeNull(); // pop c
  expect(step(prog, state)).toBeNull(); // pop d or e
  expect(state.deferred.get('h', [])).toBe(true);
  expect(step(prog, state)).toBeNull(); // pop d or e (h is deferred)
  expect(state.deferred.get('h', [])).toBe(true);
  expect(state.agenda).toBeNull();
  expect(state.frontier.get('h', [])!.open).toBe(true);
  expect(state.frontier.get('h', [])!.values.has(4n)).toBe(false);
  expect(state.frontier.get('h', [])!.values.has(5n)).toBe(true);
  expect(state.frontier.get('h', [])!.values.has(6n)).toBe(true);
  expect(state.frontier.get('h', [])!.values.has(16n)).toBe(true);
  expect(state.frontier.get('h', [])!.values.has(17n)).toBe(true);
  expect(state.frontier.get('h', [])!.values.has(18n)).toBe(false);
});
