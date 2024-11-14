import { test, expect } from 'vitest';
import { createSearchState, learnImmediateConsequences, SearchState } from './forwardengine.js';
import { HashCons } from '../datastructures/data.js';
import { parse } from '../language/dusa-parser.js';
import { check } from '../language/check.js';
import { compile } from '../language/compile.js';
import { ingestBytecodeProgram, Program } from './program.js';

function build(source: string) {
  const parsed = parse(source);
  if (parsed.errors !== null) throw parsed.errors;
  const { errors, arities, builtins } = check(parsed.document);
  if (errors.length !== 0) throw errors;
  const bytecode = compile(builtins, arities, parsed.document);
  return ingestBytecodeProgram(bytecode);
}

function step(prog: Program, state: SearchState) {
  if (state.agenda === null) throw new Error();
  const { data, next } = state.agenda;
  state.agenda = next;
  return learnImmediateConsequences(prog, state, data);
}

test('forward engine with unary rules and argument-free premises', () => {
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
  expect(result.type).toStrictEqual('incompatible');

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
  expect(program.data.expose((state.explored.get('h', []) as any).just)).toStrictEqual({
    type: 'int',
    value: 6n,
  });
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
  expect(
    state.frontier.get('h', [])!.values.has(program.data.hide({ type: 'int', value: 4n })),
  ).toBe(false);
  expect(
    state.frontier.get('h', [])!.values.has(program.data.hide({ type: 'int', value: 5n })),
  ).toBe(true);
  expect(
    state.frontier.get('h', [])!.values.has(program.data.hide({ type: 'int', value: 6n })),
  ).toBe(true);
  expect(
    state.frontier.get('h', [])!.values.has(program.data.hide({ type: 'int', value: 16n })),
  ).toBe(true);
  expect(
    state.frontier.get('h', [])!.values.has(program.data.hide({ type: 'int', value: 17n })),
  ).toBe(true);
  expect(
    state.frontier.get('h', [])!.values.has(program.data.hide({ type: 'int', value: 18n })),
  ).toBe(false);
});

test('consequences, unary rules', () => {
  let program: Program;
  let state: SearchState;

  program = build('p is ff. q is tt :- p is ff.');
  const tt = program.data.hide({ type: 'const', name: 'tt', args: [] });
  const ff = program.data.hide({ type: 'const', name: 'ff', args: [] });
  state = createSearchState(program);
  expect(step(program, state)).toBeNull(); // pop $seed
  expect(state.explored.get('p', [])).toStrictEqual(null);
  expect(state.explored.get('q', [])).toStrictEqual(null);
  expect(state.frontier.get('p', [])!.open).toStrictEqual(false);
  expect([...state.frontier.get('p', [])!.values]).toStrictEqual([ff]);
  expect(state.frontier.get('q', [])).toStrictEqual(null);

  expect(step(program, state)).toBeNull(); // pop p is ff
  expect(state.explored.get('p', [])).toStrictEqual({ type: 'just', just: ff });
  expect(state.explored.get('q', [])).toStrictEqual(null);
  expect(state.frontier.get('p', [])).toStrictEqual(null);
  expect([...state.frontier.get('q', [])!.values]).toStrictEqual([tt]);

  expect(step(program, state)).toBeNull(); // pop q is tt
  expect(state.explored.get('p', [])).toStrictEqual({ type: 'just', just: ff });
  expect(state.explored.get('q', [])).toStrictEqual({ type: 'just', just: tt });
  expect(state.frontier.get('p', [])).toStrictEqual(null);
  expect(state.frontier.get('q', [])).toStrictEqual(null);
});

test('multiple premises (datalog, no arguments)', () => {
  let program: Program;
  let state: SearchState;

  program = build('a. b. c. d :- a, b, c.');
  state = createSearchState(program);
  expect(step(program, state)).toBeNull(); // pop $seed. agenda now possibly: [a,b,c]
  expect(step(program, state)).toBeNull(); // agenda now possibly: [a,b]
  expect(step(program, state)).toBeNull(); // agenda now possibly: [a]
  expect(step(program, state)).toBeNull(); // agenda now possibly: [@d-1-1]
  expect(step(program, state)).toBeNull(); // agenda now possibly: [@d-1-2]
  expect(step(program, state)).toBeNull(); // agenda now possibly: [d]
  expect(step(program, state)).toBeNull(); // agenda now possibly: [d]
  expect(state.agenda).toBeNull();
  expect(state.deferred.size).toBe(0);
  expect(state.frontier.size).toBe(0);
  expect(state.explored.size).toStrictEqual({ pos: 7, neg: 0 });
});
