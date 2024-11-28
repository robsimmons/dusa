import { test, expect } from 'vitest';
import { Database } from '../datastructures/database.js';
import { execute } from './choiceengine.js';
import { ingestBytecodeProgram, Program } from './program.js';
import { Dusa } from '../client.js';

function build(source: string) {
  return ingestBytecodeProgram(Dusa.compile(source));
}

function simplify(prog: Program, db: Database, keys: [string, number][]) {
  const facts: string[] = [];
  for (const [key, depth] of keys) {
    for (const args of db.visit(key, [], 0, depth)) {
      facts.push(`${key}${args.map((arg) => ` ${prog.data.toString(arg, true)}`).join('')}`);
    }
  }
  return facts.sort().join(', ');
}

function testExecution(source: string, preds: [string, number][]) {
  const prog = build(source);
  return [...execute(prog)]
    .filter((db) => db.size.neg === 0)
    .map((db) => simplify(prog, db, preds))
    .sort();
}

test('Overlapping non-exhaustive choices', () => {
  expect(
    testExecution(
      `
        p.
        q.
        r is? { a, b, c } :- p.
        r is? { a, c, d } :- p.
        r is? e :- q.
        r is? f.
    `,
      [['r', 1]],
    ),
  ).toStrictEqual(['r a', 'r b', 'r c', 'r d', 'r e', 'r f']);
});

test('Absent/extant regression simplified', () => {
  expect(
    testExecution(
      `
        reachable 1 1.
        edge 1 2 is extant.
        reachable Start Y :- reachable Start X, edge X Y is extant.
      `,
      [['reachable', 2]],
    ),
  ).toStrictEqual(['reachable 1 1, reachable 1 2']);
});

test('Absent/extant regression full', () => {
  expect(
    testExecution(
      `
        vertex 0.
        vertex 1.
        vertex 2.
    
        edge 0 1 is absent.
        edge 0 2 is absent.
        edge 1 2 is extant.
        edge X Y is Z :- edge Y X is Z.
    
        reachable N N :- vertex N.
        reachable Start Y :- reachable Start X, edge X Y is extant.
      `,
      [['reachable', 2]],
    ),
  ).toStrictEqual(['reachable 0 0, reachable 1 1, reachable 1 2, reachable 2 1, reachable 2 2']);
});

test('Forbid and demand: one solution', () => {
  expect(
    testExecution(
      `
        p a is { tt, ff }.
        p b is { tt, ff }.
        #demand p a is tt.
        #forbid p b is ff.
      `,
      [['p', 2]],
    ),
  ).toStrictEqual(['p a tt, p b tt']);
});

test('Forbid and demand: several solutions', () => {
  expect(
    testExecution(
      `
        q a. q b. q c. q d.
        p X is { tt, ff } :- q X.
        #demand p a is tt, p b is tt.
        #forbid p c is ff, p d is ff.
      `,
      [['p', 2]],
    ),
  ).toStrictEqual([
    'p a tt, p b tt, p c ff, p d tt',
    'p a tt, p b tt, p c tt, p d ff',
    'p a tt, p b tt, p c tt, p d tt',
  ]);
});

test('Three sets of choices', () => {
  expect(
    testExecution(
      `
        p a is { tt, ff }.
        p b is { tt, ff }.
        p c is { tt, ff }.
      `,
      [['p', 2]],
    ),
  ).toStrictEqual([
    'p a ff, p b ff, p c ff',
    'p a ff, p b ff, p c tt',
    'p a ff, p b tt, p c ff',
    'p a ff, p b tt, p c tt',
    'p a tt, p b ff, p c ff',
    'p a tt, p b ff, p c tt',
    'p a tt, p b tt, p c ff',
    'p a tt, p b tt, p c tt',
  ]);
});

test('Generating edges', () => {
  expect(
    testExecution(
      `
        vertex a. vertex b.

        edge X X is absent :- vertex X.
        edge X Y is { extant, absent } :- vertex X, vertex Y.
      `,
      [['edge', 3]],
    ),
  ).toStrictEqual([
    'edge a a absent, edge a b absent, edge b a absent, edge b b absent',
    'edge a a absent, edge a b absent, edge b a extant, edge b b absent',
    'edge a a absent, edge a b extant, edge b a absent, edge b b absent',
    'edge a a absent, edge a b extant, edge b a extant, edge b b absent',
  ]);
});

test('Generating edges', () => {
  expect(
    testExecution(
      `
        vertex a. vertex b. vertex c.

        edge X X is absent :- vertex X.
        edge X Y is { extant, absent } :- vertex X, vertex Y.
        edge X Y is Z :- edge Y X is Z.

        reach N N :- vertex N.
        reach Start Y :- reach Start X, edge X Y is extant.
      `,
      [['reach', 2]],
    ),
  ).toStrictEqual([
    'reach a a, reach a b, reach a c, reach b a, reach b b, reach b c, reach c a, reach c b, reach c c',
    'reach a a, reach a b, reach a c, reach b a, reach b b, reach b c, reach c a, reach c b, reach c c',
    'reach a a, reach a b, reach a c, reach b a, reach b b, reach b c, reach c a, reach c b, reach c c',
    'reach a a, reach a b, reach a c, reach b a, reach b b, reach b c, reach c a, reach c b, reach c c',
    'reach a a, reach a b, reach b a, reach b b, reach c c',
    'reach a a, reach a c, reach b b, reach c a, reach c c',
    'reach a a, reach b b, reach b c, reach c b, reach c c',
    'reach a a, reach b b, reach c c',
  ]);
});

test('Open ended and closed ended possibility', () => {
  expect(
    testExecution(
      `
        opt a. opt b. opt c. opt d. opt e. opt f. opt g. opt h. 

        choice is? X :- opt X.
        p X is? ff :- opt X.
        p choice is tt.
      `,
      [
        ['p', 2],
        ['choice', 1],
      ],
    ),
  ).toStrictEqual([
    'choice a, p a tt, p b ff, p c ff, p d ff, p e ff, p f ff, p g ff, p h ff',
    'choice b, p a ff, p b tt, p c ff, p d ff, p e ff, p f ff, p g ff, p h ff',
    'choice c, p a ff, p b ff, p c tt, p d ff, p e ff, p f ff, p g ff, p h ff',
    'choice d, p a ff, p b ff, p c ff, p d tt, p e ff, p f ff, p g ff, p h ff',
    'choice e, p a ff, p b ff, p c ff, p d ff, p e tt, p f ff, p g ff, p h ff',
    'choice f, p a ff, p b ff, p c ff, p d ff, p e ff, p f tt, p g ff, p h ff',
    'choice g, p a ff, p b ff, p c ff, p d ff, p e ff, p f ff, p g tt, p h ff',
    'choice h, p a ff, p b ff, p c ff, p d ff, p e ff, p f ff, p g ff, p h tt',
  ]);
});

test('Value conflict', () => {
  expect(
    testExecution(
      `
        p is a.
        p is b.
      `,
      [['p', 1]],
    ),
  ).toStrictEqual([]);
});

test('Forcing a value conflict in a noneOf branch', () => {
  expect(
    testExecution(
      `
        q is? a.
        p is? a.
        q is X :- p is X.
        p is X :- q is X.
      `,
      [
        ['p', 1],
        ['q', 1],
      ],
    ),
  ).toStrictEqual(['p a, q a']);
});

test('Binary operation builtins', () => {
  expect(
    testExecution(
      `
        q X :- 4 == X.
        r a :- q X, X != 4.
        r b :- q X, 4 == X.
        r c :- q X, X < 5. 
        r d :- q X, X < 4. 
        r e :- q X, X < 3. 
        r f :- q X, X <= 5. 
        r g :- q X, X <= 4. 
        r h :- q X, X <= 3.
        r i :- q X, X >= 5. 
        r j :- q X, X >= 4. 
        r k :- q X, X >= 3. 
        r l :- q X, X > 5. 
        r m :- q X, X > 4. 
        r n :- q X, X > 3.
        r o1 :- q X, X > "A".
        r o2 :- q X, "A" > X.
        r o3 :- q X, X >= "A".
        r o4 :- q X, "A" >= X.
        r o5 :- q X, X < "A".
        r o6 :- q X, "A" < "B".
        r o7 :- q X, "A" >= "B".
        r o8 :- q X, a < X.
        r o9 :- q X, X <= a.
        r oA :- q X, a > X.
        r oB :- q X, X >= zz a g.
      `,
      [['r', 1]],
    ),
  ).toStrictEqual(['r b, r c, r f, r g, r j, r k, r n, r o6']);

  expect(
    testExecution(
      `
        p a.
        q (f a b a c).
        r (m Y Z W Q) :- q X, f Y Z W Q == X.
        r (n Y Z W) :- q X, X == f Y Z Y W.
        r (o Y Z W) :- q X, X == f Y Z W Z.
        r X :- f 3 X == f 3 9.
        r z1 :- q X, X != f _ _ _. 
        r z2 :- q X, X != f _ _ _ _. 
        r z3 :- q X, X != f _ _ _ _ _. 
      `,
      [['r', 1]],
    ),
  ).toStrictEqual(['r (m a b a c), r (n a b c), r 9, r z1, r z3']);

  expect(
    testExecution(
      `
        a (pair 10 2).
        b Y :- a X, X == pair Y _.
        c Y :- a X, pair _ Y == X.
        d (pair X Y) :- b Y, c X.
        e X :- d A, c Y, A == pair Y X.
        f X :- d A, c Y, A == pair X Y.
    
    `,
      [
        ['a', 1],
        ['b', 1],
        ['c', 1],
        ['d', 1],
        ['e', 1],
        ['f', 1],
      ],
    ),
  ).toStrictEqual(['a (pair 10 2), b 10, c 2, d (pair 2 10), e 10']);
});

test('Builtins BOOLEAN_FALSE and BOOLEAN_TRUE', () => {
  expect(
    testExecution('#builtin BOOLEAN_TRUE tt\n#builtin BOOLEAN_FALSE ff\nb a :- tt == tt.', [
      ['b', 1],
    ]),
  ).toStrictEqual(['b a']);
  expect(
    testExecution('#builtin BOOLEAN_TRUE tt\n#builtin BOOLEAN_FALSE ff\nb a :- tt == ff.', [
      ['b', 1],
    ]),
  ).toStrictEqual(['']);
  expect(
    testExecution('#builtin BOOLEAN_TRUE tt\n#builtin BOOLEAN_FALSE ff\nb a :- tt != ff.', [
      ['b', 1],
    ]),
  ).toStrictEqual(['b a']);
});

test('Builtins NAT_ZERO and NAT_SUCC', () => {
  expect(testExecution('#builtin NAT_ZERO z\nb X :- z is X.', [['b', 1]])).toStrictEqual(['b 0']);
  expect(testExecution('#builtin NAT_ZERO z\nb a :- z is 0.', [['b', 1]])).toStrictEqual(['b a']);
  expect(testExecution('#builtin NAT_ZERO z\nb a :- z is 1.', [['b', 1]])).toStrictEqual(['']);
  expect(testExecution('#builtin NAT_SUCC s\nb X :- s 4 is X.', [['b', 1]])).toStrictEqual(['b 5']);
  expect(testExecution('#builtin NAT_SUCC s\nb X :- s X is 4.', [['b', 1]])).toStrictEqual(['b 3']);
  expect(testExecution('#builtin NAT_SUCC s\nb X :- s 0 is X.', [['b', 1]])).toStrictEqual(['b 1']);
  expect(testExecution('#builtin NAT_SUCC s\nb X :- s X is 0.', [['b', 1]])).toStrictEqual(['']);
  expect(testExecution('#builtin NAT_SUCC s\nb X :- s -1 is X.', [['b', 1]])).toStrictEqual(['']);
  expect(testExecution('#builtin NAT_SUCC s\nb X :- s X is -1.', [['b', 1]])).toStrictEqual(['']);
  expect(
    testExecution('#builtin NAT_ZERO z\n#builtin NAT_SUCC s\nb (s (s (s z))).', [['b', 1]]),
  ).toStrictEqual(['b 3']);
});

test('Builtins INT_PLUS, INT_MINUS, INT_TIMES', () => {
  expect(testExecution('#builtin INT_PLUS plus\nb (plus 1 4).', [['b', 1]])).toStrictEqual(['b 5']);
  expect(testExecution('#builtin INT_PLUS plus\nb (plus 1 2 3 4).', [['b', 1]])).toStrictEqual([
    'b 10',
  ]);
  expect(
    testExecution('#builtin INT_PLUS plus\nb X :- plus -1 -11 is X.', [['b', 1]]),
  ).toStrictEqual(['b -12']);
  expect(
    testExecution('#builtin INT_PLUS plus\nb X :- plus -1 X -20 -40 is 11.', [['b', 1]]),
  ).toStrictEqual(['b 72']);
  expect(testExecution('#builtin INT_PLUS plus\nb (plus "Five" 4).', [['b', 1]])).toStrictEqual([
    '',
  ]);
  expect(testExecution('#builtin INT_MINUS minus\nb (minus "Five" 4).', [['b', 1]])).toStrictEqual([
    '',
  ]);
  expect(testExecution('#builtin INT_MINUS minus\nb (minus 99 2).', [['b', 1]])).toStrictEqual([
    'b 97',
  ]);
  expect(
    testExecution('#builtin INT_MINUS minus\nb X :- minus 12 X is 3.', [['b', 1]]),
  ).toStrictEqual(['b 9']);
  expect(
    testExecution('#builtin INT_MINUS minus\nb X :- minus X 12 is 3.', [['b', 1]]),
  ).toStrictEqual(['b 15']);
  expect(
    testExecution(
      `
        #builtin INT_PLUS plus
        a 2.
        a 7.
        a 12.
        d 9.
        d 19.
        d 6.
        e X Y :- a X, a Y, d (plus X Y).
      `,
      [['e', 2]],
    ),
  ).toStrictEqual(['e 12 7, e 2 7, e 7 12, e 7 2']);
  expect(
    testExecution(
      `
        #builtin INT_PLUS plus
      
        a 2.
        a 7.
        a 12.
        d 9.
        d 19.
        d 6.
        e X Y :- a X, a Y, plus X Y == Z, d Z.
      `,
      [['e', 2]],
    ),
  ).toStrictEqual(['e 12 7, e 2 7, e 7 12, e 7 2']);
  expect(
    testExecution(
      `
        #builtin INT_TIMES times
      
        a 2.
        a 7.
        a 12.
        e Z :- a X, a Y, times X Y == Z.
        e Z :- a X, times X "A" == Z.
      `,
      [['e', 1]],
    ),
  ).toStrictEqual(['e 14, e 144, e 24, e 4, e 49, e 84']);
});

test('Functional predicates in ground position', () => {
  expect(
    testExecution(
      `
        s 0 is 1.
        s 1 is 2.
        s 2 is 3.
        s 3 is 4.
        
        p a N :- N == 4, N == 4.
        p b N :- N == 3, N == s 2.
        p c N :- N == 0, s N == 1.
        p d N :- N == 0, s N == s 0.
        p e N :- N == 3, 3 == N.
        p f N :- N == 2, s 1 == N.
        p g N :- N == 3, 4 == s N.
        p h N :- N == 3, s 3 == s N.
        p i N :- N == 0, s 0 == N.
        p i N :- N == 0, N == s 0.
      `,
      [['p', 2]],
    ),
  ).toStrictEqual(['p a 4, p b 3, p c 0, p d 0, p e 3, p f 2, p g 3, p h 3']);
});

test('Long chain of inferences', () => {
  const program =
    Array.from({ length: 30 })
      .map((_, i) => `a ${i} :- a ${i + 1}.`)
      .join('\n') + '\na 30.';
  const solution = Array.from({ length: 31 })
    .map((_, i) => `a ${i}`)
    .sort()
    .join(', ');

  expect(testExecution(program, [['a', 1]])).toStrictEqual([solution]);
});
