import { test, expect } from 'vitest';
import {
  createSearchState,
  InternalProgram,
  learnImmediateConsequences,
  SearchState,
} from './forwardengine.js';
import { HashCons } from '../datastructures/data.js';
import { parse } from '../language/dusa-parser.js';
import { check } from '../language/check.js';
import { compile } from '../language/compile.js';
import { builtinModes } from '../language/dusa-builtins.js';
import { ingestBytecodeProgram, Program } from './program.js';

function build(source: string) {
  const parsed = parse(source);
  if (parsed.errors !== null) throw parsed.errors;
  const { errors, arities, builtins } = check(builtinModes, parsed.document);
  if (errors.length !== 0) throw errors;
  const bytecode = compile(builtins, arities, parsed.document);
  return ingestBytecodeProgram(bytecode);
}

function step(prog: InternalProgram, state: SearchState) {
  if (state.agenda === null) throw new Error();
  const { data, next } = state.agenda;
  state.agenda = next;
  return learnImmediateConsequences(prog, state, data);
}

test('datalog, unary consequences', () => {
  let program: Program;
  let state: SearchState;
  let result: any;

  program = build(`c. d :- c. e :- c. g :- f.`);
  state = createSearchState(program);
  expect(step(program, state)).toBeNull(); // pop $seed
  expect(step(program, state)).toBeNull(); // pop c
  expect(state.explored.get('c', [])).toStrictEqual({ type: 'just', just: HashCons.TRIVIAL });
  expect(step(program, state)).toBeNull(); // pop d or e
  expect(step(program, state)).toBeNull(); // pop e or d
  expect(state.explored.get('d', [])).toStrictEqual({ type: 'just', just: HashCons.TRIVIAL });
  expect(state.explored.get('e', [])).toStrictEqual({ type: 'just', just: HashCons.TRIVIAL });
  expect(state.agenda).toBeNull();

  program = build('f. c :- a. d :- c. e :- c. g :- f. #forbid g.');
  state = createSearchState(program);
  expect(step(program, state)).toBeNull(); // pop $seed
  expect(step(program, state)).toBeNull(); // pop f
  expect(step(program, state)).toBeNull(); // pop g
  expect(step(program, state)?.type).toBe('forbid');

  program = build('c. d :- c. e :- c. #demand d. #demand e.');
  state = createSearchState(program);
  expect(state.demands.size).toBe(2);
  expect(step(program, state)).toBeNull(); // pop $seed
  expect(state.agenda!.next).toBeNull();
  expect(step(program, state)).toBeNull(); // pop c
  expect(state.agenda!.next!.next).toBeNull();
  expect(step(program, state)).toBeNull(); // pop d or e
  expect(step(program, state)).toBeNull(); // pop d or e or @demand-d or @demand-e
  expect(step(program, state)).toBeNull(); // pop d or e or @demand-d or @demand-e
  expect(step(program, state)).toBeNull(); // pop d or e or @demand-d or @demand-e
  expect(state.agenda).toBeNull();
  expect(state.demands.size).toBe(0);

  program = build('c. d :- c. e :- c. h is 1 :- d. h is 2 :- e.');
  state = createSearchState(program);
  expect(step(program, state)).toBeNull(); // pop $seed
  expect(step(program, state)).toBeNull(); // pop c
  expect(step(program, state)).toBeNull(); // pop d or e
  expect(step(program, state)).toBeNull(); // pop the other one, or h
  result = step(program, state) ?? step(program, state); // if h was popped first, need 2 steps
  expect(result).not.toBeNull();
  result.new.push(result.old);
  delete result.old;
  result.new.sort();
  expect(result).toStrictEqual({ type: 'incompatible', name: 'h', args: [], new: [1n, 2n] });

  program = build(
    'c. d :- c. e :- c. h is { 5, 6, a } :- d. h is { 6, "what", garbage "in" } :- e.',
  );
  state = createSearchState(program);
  expect(step(program, state)).toBeNull(); // pop $seed
  expect(step(program, state)).toBeNull(); // pop c
  expect(step(program, state)).toBeNull(); // pop d or e
  expect(state.deferred.get('h', [])).toBe(true);
  expect(step(program, state)).toBeNull(); // pop the other one (h is deferred)
  expect(state.deferred.get('h', [])).toBe(null);
  expect(state.agenda!.data.name).toBe('h');
  expect(state.frontier.get('h', [])).not.toBeNull();
  expect(step(program, state)).toBeNull(); // pop h
  expect(state.explored.get('h', [])).toStrictEqual({ type: 'just', just: 6n });
  expect(state.frontier.get('h', [])).toBeNull();

  program = build('c. d :- c. e :- c. h is { 1, 2, 3, 4, 5 } :- d. h is { 11, 12, 13, 14 } :- e.');
  state = createSearchState(program);
  expect(step(program, state)).toBeNull(); // pop $seed
  expect(step(program, state)).toBeNull(); // pop c
  expect(step(program, state)).toBeNull(); // pop d or e
  expect(state.deferred.get('h', [])).toBe(true);
  result = step(program, state); // pop the other one (h is deferred)
  expect(result).not.toBeNull();
  delete result.new;
  delete result.old;
  expect(result).toStrictEqual({ type: 'incompatible', name: 'h', args: [] });

  program = build(
    'c. d :- c. e :- c. h is? { 1, 2, 5, 16, 17, 19 } :- d. h is? { 5, 6, 99 } :- e.',
  );
  state = createSearchState(program);
  expect(step(program, state)).toBeNull(); // pop $seed
  expect(step(program, state)).toBeNull(); // pop c
  expect(step(program, state)).toBeNull(); // pop d or e
  expect(state.deferred.get('h', [])).toBe(true);
  expect(step(program, state)).toBeNull(); // pop d or e (h is deferred)
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
