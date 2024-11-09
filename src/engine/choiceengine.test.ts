import { test, expect } from 'vitest';
import { ingestBytecodeProgram, Program } from './program.js';
import { compile } from '../language/compile.js';
import { parse } from '../language/dusa-parser.js';
import { check } from '../language/check.js';
import { builtinModes } from '../language/dusa-builtins.js';
import { ChoiceTree, ChoiceZipper, step } from './choiceengine.js';
import { createSearchState } from './forwardengine.js';
import { Database } from '../datastructures/database.js';
import { List } from '../datastructures/conslist.js';
import { Data } from '../datastructures/data.js';

function build(source: string) {
  const parsed = parse(source);
  if (parsed.errors !== null) throw parsed.errors;
  const { errors, arities, builtins } = check(builtinModes, parsed.document);
  if (errors.length !== 0) throw errors;
  const bytecode = compile(builtins, arities, parsed.document);
  return ingestBytecodeProgram(bytecode);
}

function simplify(
  prog: Program,
  path: ChoiceZipper,
  tree: ChoiceTree | null,
  solution: Database | null,
) {
  const simplePath: string[] = [];
  let simpleTree: null | string | string[] = null;
  let simpleSolution: null | { pos: number; neg: number };

  while (path !== null) {
    const [name, args] = path.data[0].attribute;
    const choice = path.data[1];
    simplePath.push(
      `${name}${args.map((arg) => ' ' + prog.data.toString(arg)).join('')} ${choice.type === 'just' ? `is ${prog.data.toString(choice.just)}` : `isn't known`}`,
    );
    path = path.next;
  }

  if (tree === null) {
    simpleTree = null;
  } else if (tree.type === 'choice') {
    const [name, args] = tree.attribute;
    simpleTree = `branch on ${name}${args.map((arg) => ' ' + prog.data.toString(arg)).join('')}`;
  } else if (tree.state.agenda !== null) {
    let agenda: List<any> = tree.state.agenda;
    const agendaItems: string[] = [];
    while (agenda !== null) {
      agendaItems.push(
        `${agenda.data.name}${agenda.data.args.map((arg: Data) => ' ' + prog.data.toString(arg)).join('')}`,
      );
      agenda = agenda.next;
    }
    simpleTree = agendaItems.toReversed();
  } else if (tree.state.deferred.size === 0) {
    simpleTree = 'leaf containing solution';
  } else {
    simpleTree = `leaf with ${tree.state.deferred.size} deferred options`;
  }

  if (solution === null) {
    simpleSolution = null;
  } else {
    simpleSolution = solution.size;
  }

  return { path: simplePath.toReversed(), tree: simpleTree, solution: simpleSolution };
}

test('choice engine runs datalog programs', () => {
  const prog = build(`c. d :- c. e :- c. g :- f.`);
  let path: ChoiceZipper = null;
  let tree: ChoiceTree | null = { type: 'leaf', state: createSearchState(prog) };
  let solution: Database | null = null;

  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: ['$seed'],
    solution: null,
  });
  [path, tree, solution] = step(prog, path, tree!); // pop $seed
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: ['c'],
    solution: null,
  });
  [path, tree, solution] = step(prog, path, tree!); // pop c
  expect(solution).toBeNull();
  [path, tree, solution] = step(prog, path, tree!); // pop d or e
  expect(solution).toBeNull();
  [path, tree, solution] = step(prog, path, tree!); // pop the other one
  expect(solution).toBeNull();
  [path, tree, solution] = step(prog, path, tree!); // return solution
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: null,
    solution: { pos: 4, neg: 0 },
  });
});

test('choice engine runs closed choices', () => {
  const prog = build(`c is { 1, 2, 3 }.`);
  let path: ChoiceZipper = null;
  let tree: ChoiceTree | null = { type: 'leaf', state: createSearchState(prog) };
  let solution: Database | null = null;
  let result: any;

  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: ['$seed'],
    solution: null,
  });
  [path, tree, solution] = step(prog, path, tree!); // pop $seed
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'leaf with 1 deferred options',
    solution: null,
  });
  [path, tree, solution] = step(prog, path, tree!); // agenda empty, create branch point on c
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'branch on c',
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // descend into branch and pop `c is ?`
  result = simplify(prog, path, tree, solution);
  expect(result.path.join(',').slice(0, -1)).toStrictEqual('c is ');
  expect(result.solution).toBeNull();
  expect(result.tree).toStrictEqual('leaf containing solution');

  [path, tree, solution] = step(prog, path, tree!); // solution found!
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'branch on c',
    solution: { pos: 2, neg: 0 },
  });

  [path, tree, solution] = step(prog, path, tree!); // descend into branch and pop `c is ?`
  result = simplify(prog, path, tree, solution);
  expect(result.path.join(',').slice(0, -1)).toStrictEqual('c is ');
  expect(result.solution).toBeNull();
  expect(result.tree).toStrictEqual('leaf containing solution');

  [path, tree, solution] = step(prog, path, tree!); // solution found!
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: ['c'],
    solution: { pos: 2, neg: 0 },
  });

  [path, tree, solution] = step(prog, path, tree!); // pop `c is ?`
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'leaf containing solution',
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // last solution on queue
  expect(result.path.join(',').slice(0, -1)).toStrictEqual('c is ');
  expect(result.solution).toBeNull();
  expect(result.tree).toStrictEqual('leaf containing solution');
});

test('choice engine runs open choices', () => {
  const prog = build(`c is? 1.`);
  let path: ChoiceZipper = null;
  let tree: ChoiceTree | null = { type: 'leaf', state: createSearchState(prog) };
  let solution: Database | null = null;

  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: ['$seed'],
    solution: null,
  });
  [path, tree, solution] = step(prog, path, tree!); // pop $seed
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'leaf with 1 deferred options',
    solution: null,
  });
  [path, tree, solution] = step(prog, path, tree!); // agenda empty, create branch point on c
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'branch on c',
    solution: null,
  });
  [path, tree, solution] = step(prog, path, tree!); // agenda empty, follow just branch
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: ['c is 1'],
    tree: 'leaf containing solution',
    solution: null,
  });
  [path, tree, solution] = step(prog, path, tree!); // solution found (c is 1)
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'leaf containing solution',
    solution: { pos: 2, neg: 0 },
  });
  [path, tree, solution] = step(prog, path, tree!); // solution found (c isn't 1)
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: null,
    solution: { pos: 1, neg: 1 },
  });
});

test('mutual exclusion', () => {
  const prog = build(`p is? ff. q is? ff. p is tt :- q is ff. q is tt :- p is ff.`);
  let path: ChoiceZipper = null;
  let tree: ChoiceTree | null = { type: 'leaf', state: createSearchState(prog) };
  let solution: Database | null = null;

  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: ['$seed'],
    solution: null,
  });
  [path, tree, solution] = step(prog, path, tree!); // pop $seed
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'leaf with 2 deferred options',
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // agenda empty, create branch point on [pq]
  const pq = `${simplify(prog, path, tree, solution).tree}`.slice(-1);
  const qp = pq === 'p' ? 'q' : 'p';
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'branch on ' + pq,
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // descend, pop [pq] is ff
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [pq + ' is ff'],
    tree: [qp],
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // pop [qp] is tt
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [pq + ' is ff'],
    tree: 'leaf containing solution',
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // solution found: { pq is ff, qp is tt }
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'leaf with 1 deferred options',
    solution: { neg: 0, pos: 3 },
  });

  [path, tree, solution] = step(prog, path, tree!); // agenda empty, create branch point on [qp]
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'branch on ' + qp,
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // descend, pop [qp] is ff
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [qp + ' is ff'],
    tree: [pq],
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // descend, pop [pq] is tt
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [qp + ' is ff'],
    tree: 'leaf containing solution',
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // solution found: { qp is ff, pq is tt }
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'leaf containing solution',
    solution: { neg: 0, pos: 3 },
  });

  [path, tree, solution] = step(prog, path, tree!); // solution found: { qp isn't ff, pq isn't ff }
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: null,
    solution: { neg: 2, pos: 1 },
  });
});

test('Multiple choice', () => {
  const prog = build(`p is { tt, ff }. q is { tt, ff }.`);
  let path: ChoiceZipper = null;
  let tree: ChoiceTree | null = { type: 'leaf', state: createSearchState(prog) };
  let solution: Database | null = null;

  [path, tree, solution] = step(prog, path, tree!); // pop $seed
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'leaf with 2 deferred options',
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // agenda empty, create branch point on [pq]
  const pq = `${simplify(prog, path, tree, solution).tree}`.slice(-1);
  const qp = pq === 'p' ? 'q' : 'p';
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'branch on ' + pq,
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // descend, pop [pq] is [pqft]
  const pqft = `${simplify(prog, path, tree, solution).path}`.slice(-2);
  // const pqtf = pqft === 'tt' ? 'ff' : 'tt';
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [pq + ' is ' + pqft],
    tree: 'leaf with 1 deferred options',
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // agenda empty, create branch point on [qp]
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [pq + ' is ' + pqft],
    tree: 'branch on ' + qp,
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // descend, pop [qp] is [qpft]
  const qpft = `${simplify(prog, path, tree, solution).path}`.slice(-2);
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [pq + ' is ' + pqft, qp + ' is ' + qpft],
    tree: 'leaf containing solution',
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // solution found: { pq is pqft, qp is qpft }
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [pq + ' is ' + pqft],
    tree: [qp],
    solution: { neg: 0, pos: 3 },
  });

  [path, tree, solution] = step(prog, path, tree!); // pop [qp] is [qptf]
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [pq + ' is ' + pqft],
    tree: 'leaf containing solution',
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // solution found: { pq is pqft, qp is qptf }
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: [pq],
    solution: { neg: 0, pos: 3 },
  });

  [path, tree, solution] = step(prog, path, tree!); // pop [qp] is [qpft]
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'leaf with 1 deferred options',
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // agenda empty, create branch point on [qp]
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'branch on ' + qp,
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // descend, pop [qp] is [qpft2]
  const qpft2 = `${simplify(prog, path, tree, solution).path}`.slice(-2);
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [qp + ' is ' + qpft2],
    tree: 'leaf containing solution',
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // solution found: { pq is qpft, qp is qptf2 }
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: [qp],
    solution: { neg: 0, pos: 3 },
  });

  [path, tree, solution] = step(prog, path, tree!); // pop [qp] is [qptf2]
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: 'leaf containing solution',
    solution: null,
  });

  [path, tree, solution] = step(prog, path, tree!); // solution found: { pq is qpft, qp is qpft2 }
  expect(simplify(prog, path, tree, solution)).toStrictEqual({
    path: [],
    tree: null,
    solution: { neg: 0, pos: 3 },
  });
});
