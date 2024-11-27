import { test, expect } from 'vitest';
import { ingestBytecodeProgram, Program } from './program.js';
import { ChoiceTree, ChoiceZipper, step } from './choiceengine.js';
import { AgendaMember, createSearchState } from './forwardengine.js';
import { Database } from '../datastructures/database.js';
import { List } from '../datastructures/conslist.js';
import { Data } from '../datastructures/data.js';
import { Dusa } from '../client.js';

function build(source: string) {
  return ingestBytecodeProgram(Dusa.compile(source));
}

function simplify(
  prog: Program,
  path: ChoiceZipper,
  tree: ChoiceTree | null,
  model: Database | null,
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
    let agenda: List<AgendaMember> = tree.state.agenda;
    const agendaItems: string[] = [];
    while (agenda !== null) {
      agendaItems.push(
        `${agenda.data.name}${agenda.data.args.map((arg: Data) => ' ' + prog.data.toString(arg)).join('')}`,
      );
      agenda = agenda.next;
    }
    simpleTree = agendaItems.toReversed();
  } else if (tree.state.deferred.size === 0) {
    simpleTree = 'leaf containing model';
  } else {
    simpleTree = `leaf with ${tree.state.deferred.size} deferred attributes`;
  }

  if (model === null) {
    simpleSolution = null;
  } else {
    simpleSolution = model.size;
  }

  return { path: simplePath.toReversed(), tree: simpleTree, model: simpleSolution };
}

let path: ChoiceZipper;
let tree: ChoiceTree | null;
let model: Database | null;

test('choice engine runs datalog programs', () => {
  const prog = build(`c. d :- c. e :- c. g :- f.`);
  path = null;
  tree = { type: 'leaf', state: createSearchState(prog) };
  model = null;

  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: ['$seed'],
    model: null,
  });
  [path, tree, model] = step(prog, path, tree!); // pop $seed
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: ['c'],
    model: null,
  });
  [path, tree, model] = step(prog, path, tree!); // pop c
  expect(model).toBeNull();
  [path, tree, model] = step(prog, path, tree!); // pop d or e
  expect(model).toBeNull();
  [path, tree, model] = step(prog, path, tree!); // pop the other one
  expect(model).toBeNull();
  [path, tree, model] = step(prog, path, tree!); // return model
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: null,
    model: { pos: 4, neg: 0 },
  });
});

test('choice engine runs closed choices', () => {
  const prog = build(`c is { 1, 2, 3 }.`);
  path = null;
  tree = { type: 'leaf', state: createSearchState(prog) };
  model = null;

  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: ['$seed'],
    model: null,
  });
  [path, tree, model] = step(prog, path, tree!); // pop $seed
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'leaf with 1 deferred attributes',
    model: null,
  });
  [path, tree, model] = step(prog, path, tree!); // agenda empty, create branch point on c
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'branch on c',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // descend into branch
  const c1 = simplify(prog, path, tree, model).path?.[0]?.slice(-1);
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['c is ' + c1],
    tree: ['c'],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop `c is ?`
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['c is ' + c1],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // model found!
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['c is ' + c1],
    tree: null,
    model: { pos: 2, neg: 0 },
  });

  [path, tree, model] = step(prog, path, tree!); // ascend into parent
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'branch on c',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // descend into branch
  const c2 = simplify(prog, path, tree, model).path?.[0]?.slice(-1);
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['c is ' + c2],
    tree: ['c'],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop `c is ?`
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['c is ' + c2],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // model found!
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['c is ' + c2],
    tree: null,
    model: { pos: 2, neg: 0 },
  });

  [path, tree, model] = step(prog, path, tree!); // ascend into, and collapse, parent
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: ['c'],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop `c is ?`
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // last model on queue
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: null,
    model: { pos: 2, neg: 0 },
  });
});

test('choice engine runs open choices', () => {
  const prog = build(`c is? 1.`);
  path = null;
  tree = { type: 'leaf', state: createSearchState(prog) };
  model = null;

  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: ['$seed'],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop $seed
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'leaf with 1 deferred attributes',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // agenda empty, create branch point on c
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'branch on c',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // descend into just child
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['c is 1'],
    tree: ['c'],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop c is 1
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['c is 1'],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // model found!
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['c is 1'],
    tree: null,
    model: { pos: 2, neg: 0 },
  });

  [path, tree, model] = step(prog, path, tree!); // ascend into, and collapse, parent
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // model found (c isn't 1)
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: null,
    model: { pos: 1, neg: 1 },
  });
});

test('mutual exclusion', () => {
  const prog = build(`p is? ff. q is? ff. p is tt :- q is ff. q is tt :- p is ff.`);
  path = null;
  tree = { type: 'leaf', state: createSearchState(prog) };
  model = null;

  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: ['$seed'],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop $seed
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'leaf with 2 deferred attributes',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // agenda empty, create branch point on [pq]
  const pq = `${simplify(prog, path, tree, model).tree}`.slice(-1);
  const qp = pq === 'p' ? 'q' : 'p';
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'branch on ' + pq,
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // descend into child
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [pq + ' is ff'],
    tree: [pq],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop [pq] is ff
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [pq + ' is ff'],
    tree: [qp],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop [qp] is tt
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [pq + ' is ff'],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // model found: { pq is ff, qp is tt }
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [pq + ' is ff'],
    tree: null,
    model: { neg: 0, pos: 3 },
  });

  [path, tree, model] = step(prog, path, tree!); // ascend into, and collapse, parent
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'leaf with 1 deferred attributes',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // agenda empty, create branch point on [qp]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'branch on ' + qp,
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // descend into child
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [qp + ' is ff'],
    tree: [qp],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop [qp] is ff
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [qp + ' is ff'],
    tree: [pq],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // descend, pop [pq] is tt
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [qp + ' is ff'],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // model found: { qp is ff, pq is tt }
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [qp + ' is ff'],
    tree: null,
    model: { neg: 0, pos: 3 },
  });

  [path, tree, model] = step(prog, path, tree!); // ascend into, and collapse, parent
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // model found: { qp isn't ff, pq isn't ff }
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: null,
    model: { neg: 2, pos: 1 },
  });
});

test('Multiple choice', () => {
  const prog = build(`p is { tt, ff }. q is { tt, ff }.`);
  path = null;
  tree = { type: 'leaf', state: createSearchState(prog) };
  model = null;

  [path, tree, model] = step(prog, path, tree!); // pop $seed
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'leaf with 2 deferred attributes',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // agenda empty, create branch point on [pq]
  const pq = `${simplify(prog, path, tree, model).tree}`.slice(-1);
  const qp = pq === 'p' ? 'q' : 'p';
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'branch on ' + pq,
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // descend
  const pqft = `${simplify(prog, path, tree, model).path}`.slice(-2);
  // const pqtf = pqft === 'tt' ? 'ff' : 'tt';
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [pq + ' is ' + pqft],
    tree: [pq],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); //  pop [pq] is [pqft]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [pq + ' is ' + pqft],
    tree: 'leaf with 1 deferred attributes',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // agenda empty, create branch point on [qp]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [pq + ' is ' + pqft],
    tree: 'branch on ' + qp,
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // descend
  const qpft = `${simplify(prog, path, tree, model).path}`.slice(-2);
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [pq + ' is ' + pqft, qp + ' is ' + qpft],
    tree: [qp],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop [qp] is [qpft]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [pq + ' is ' + pqft, qp + ' is ' + qpft],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // model found: { pq is pqft, qp is qpft }
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [pq + ' is ' + pqft, qp + ' is ' + qpft],
    tree: null,
    model: { neg: 0, pos: 3 },
  });

  [path, tree, model] = step(prog, path, tree!); // ascend into, and collapse, parent
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [pq + ' is ' + pqft],
    tree: [qp],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop [qp] is [qptf]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [pq + ' is ' + pqft],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // model found: { pq is pqft, qp is qptf }
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [pq + ' is ' + pqft],
    tree: null,
    model: { neg: 0, pos: 3 },
  });

  [path, tree, model] = step(prog, path, tree!); // ascend into, and collapse, parent
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: [pq],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop [qp] is [qpft]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'leaf with 1 deferred attributes',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // agenda empty, create branch point on [qp]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'branch on ' + qp,
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // descend
  const qpft2 = `${simplify(prog, path, tree, model).path}`.slice(-2);
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [qp + ' is ' + qpft2],
    tree: [qp],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop [qp] is [qpft2]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [qp + ' is ' + qpft2],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // model found: { pq is qpft, qp is qptf2 }
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [qp + ' is ' + qpft2],
    tree: null,
    model: { neg: 0, pos: 3 },
  });

  [path, tree, model] = step(prog, path, tree!); // ascend into, and collapse, parent
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: [qp],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop [qp] is [qptf2]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // model found: { pq is qpft, qp is qpft2 }
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: null,
    model: { neg: 0, pos: 3 },
  });
});

test('three levels', () => {
  const prog = build(`q a. q b. q c. p X is { tt, ff } :- q X.`);
  path = null;
  tree = { type: 'leaf', state: createSearchState(prog) };
  model = null;

  const last = (ab: string[]) => {
    switch (ab.toSorted().join('')) {
      case 'ab':
        return 'c';
      case 'ac':
        return 'b';
      default:
        return 'a';
    }
  };

  [path, tree, model] = step(prog, path, tree!); // pop $seed
  [path, tree, model] = step(prog, path, tree!); // pop q a
  [path, tree, model] = step(prog, path, tree!); // pop q b
  [path, tree, model] = step(prog, path, tree!); // pop q c
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'leaf with 3 deferred attributes',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // agenda empty, create branch point on p [A]
  const a = `${simplify(prog, path, tree, model).tree}`.slice(-1);
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'branch on p ' + a,
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // descend
  const at = simplify(prog, path, tree, model).path[0].slice(-2);
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at],
    tree: ['p ' + a],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); //  pop p [A] is [T]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at],
    tree: 'leaf with 2 deferred attributes',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // agenda empty, create branch point on p [B]
  const b = `${simplify(prog, path, tree, model).tree}`.slice(-1);
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at],
    tree: 'branch on p ' + b,
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // descend
  const bt = simplify(prog, path, tree, model).path[1].slice(-2);
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at, 'p ' + b + ' is ' + bt],
    tree: ['p ' + b],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); //  pop p [B] is [T]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at, 'p ' + b + ' is ' + bt],
    tree: 'leaf with 1 deferred attributes',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // agenda empty, create branch point on p [B]
  const c = last([a, b]);
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at, 'p ' + b + ' is ' + bt],
    tree: 'branch on p ' + c,
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // descend
  const ct = simplify(prog, path, tree, model).path[2].slice(-2);
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at, 'p ' + b + ' is ' + bt, 'p ' + c + ' is ' + ct],
    tree: ['p ' + c],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop p [B] is [T]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at, 'p ' + b + ' is ' + bt, 'p ' + c + ' is ' + ct],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // return model #1: { p [A] is [T], p [B] is [T], p [C] is [T]}
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at, 'p ' + b + ' is ' + bt, 'p ' + c + ' is ' + ct],
    tree: null,
    model: { pos: 7, neg: 0 },
  });

  [path, tree, model] = step(prog, path, tree!); // ascend into, and collapse, parent
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at, 'p ' + b + ' is ' + bt],
    tree: ['p ' + c],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop p [C] is [F]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at, 'p ' + b + ' is ' + bt],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // return model #2: { p [A] is [T], p [B] is [T], p [C] is [F]}
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at, 'p ' + b + ' is ' + bt],
    tree: null,
    model: { pos: 7, neg: 0 },
  });

  [path, tree, model] = step(prog, path, tree!); // ascend into, and collapse, parent
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at],
    tree: ['p ' + b],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop p [B] is [F]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at],
    tree: 'leaf with 1 deferred attributes',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // agenda empty, create branch point on p [C]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at],
    tree: 'branch on p ' + c,
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // descend
  const ct2 = simplify(prog, path, tree, model).path[1].slice(-2);
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at, 'p ' + c + ' is ' + ct2],
    tree: ['p ' + c],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop p [C] is [T]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at, 'p ' + c + ' is ' + ct2],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // return model #3: { p [A] is [T], p [B] is [F], p [C] is [T]}
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at, 'p ' + c + ' is ' + ct2],
    tree: null,
    model: { pos: 7, neg: 0 },
  });

  [path, tree, model] = step(prog, path, tree!); // ascend into, and collapse, parent
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at],
    tree: ['p ' + c],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop p [C] is [F]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // return model #4: { p [A] is [T], p [B] is [F], p [C] is [F]}
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + a + ' is ' + at],
    tree: null,
    model: { pos: 7, neg: 0 },
  });

  [path, tree, model] = step(prog, path, tree!); // ascend into, and collapse, parent
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: ['p ' + a],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop p [A] is [F]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'leaf with 2 deferred attributes',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // agenda empty, create branch point on p [B]
  const b2 = `${simplify(prog, path, tree, model).tree}`.slice(-1);
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'branch on p ' + b2,
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // descend
  const bt2 = simplify(prog, path, tree, model).path[0].slice(-2);
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + b2 + ' is ' + bt2],
    tree: ['p ' + b2],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop p [B] is [T]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + b2 + ' is ' + bt2],
    tree: 'leaf with 1 deferred attributes',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // agenda empty, create branch point on p [C]
  const c2 = last([a, b2]);
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + b2 + ' is ' + bt2],
    tree: 'branch on p ' + c2,
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // descend
  const ct3 = simplify(prog, path, tree, model).path[1].slice(-2);
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + b2 + ' is ' + bt2, 'p ' + c2 + ' is ' + ct3],
    tree: ['p ' + c2],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop p [C] is [T]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + b2 + ' is ' + bt2, 'p ' + c2 + ' is ' + ct3],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // return model #5: { p [A] is [F], p [B] is [T], p [C] is [T]}
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + b2 + ' is ' + bt2, 'p ' + c2 + ' is ' + ct3],
    tree: null,
    model: { pos: 7, neg: 0 },
  });

  [path, tree, model] = step(prog, path, tree!); // ascend into, and collapse, parent
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + b2 + ' is ' + bt2],
    tree: ['p ' + c2],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop p [C] is [F]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + b2 + ' is ' + bt2],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // return model #6: { p [A] is [F], p [B] is [T], p [C] is [F]}
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + b2 + ' is ' + bt2],
    tree: null,
    model: { pos: 7, neg: 0 },
  });

  [path, tree, model] = step(prog, path, tree!); // ascend into, and collapse, parent
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: ['p ' + b2],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop p [B] is [F]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'leaf with 1 deferred attributes',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // agenda empty: create branch point on p [C]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'branch on p ' + c2,
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // descend
  const ct4 = simplify(prog, path, tree, model).path[0].slice(-2);
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + c2 + ' is ' + ct4],
    tree: ['p ' + c2],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop p [C] is [T]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + c2 + ' is ' + ct4],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // return model #7: { p [A] is [F], p [B] is [F], p [C] is [T] }
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: ['p ' + c2 + ' is ' + ct4],
    tree: null,
    model: { pos: 7, neg: 0 },
  });

  [path, tree, model] = step(prog, path, tree!); // ascend into, and collapse, parent
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: ['p ' + c2],
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // pop p [C] is [F]
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: 'leaf containing model',
    model: null,
  });

  [path, tree, model] = step(prog, path, tree!); // return #8: { p [A] is [F], p [B] is [F], p [C] is [F] }
  expect(simplify(prog, path, tree, model)).toStrictEqual({
    path: [],
    tree: null,
    model: { pos: 7, neg: 0 },
  });
});
