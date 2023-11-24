import PQ from './binqueue.js';
import { test, expect } from 'vitest';

test(`Priority queue insertion and removal`, () => {
  let q: PQ<number> = PQ.new();
  let n: number;
  for (let i = 0; i < 1000; i++) {
    expect(q.length).toEqual(i);
    q = q.push(i, i);
  }
  for (let i = 999; i >= 0; i--) {
    [n, q] = q.pop();
    expect(q.length).toEqual(i);
    expect(n).toEqual(i);
  }

  expect(q.length).toEqual(0);
  for (let i = 0; i < 1000; i++) {
    q = q.push(999 - i, i);
  }
  for (let i = 0; i < 1000; i++) {
    [n, q] = q.pop();
    expect(n).toEqual(i);
  }
  expect(q.length).toEqual(0);

  for (let i = 0; i < 1000; i++) {
    const rand = Math.random();
    q = q.push(rand, rand);
  }
  let last = 1;
  for (let i = 0; i < 1000; i++) {
    [n, q] = q.pop();
    expect(n).toBeLessThanOrEqual(last);
    last = n;
  }
  expect(q.length).toEqual(0);
});

test(`PQ internal structure`, () => {
  const q0 = PQ.new().push(11, 'a');
  const q1 = q0.push(12, 'b');
  const q2 = q1.push(13, 'c');
  const q3 = q2.push(14, 'd').push(1, 'e').push(2, 'f').push(3, 'g').push(15, 'h');
  const [h, q4] = q3.pop();
  const [d, q5] = q4.pop();
  const [c, q6] = q5.pop();
  const [b, q7] = q6.pop();
  const [a, q8] = q7.pop();

  expect(q0.debugToString()).toEqual('a');
  expect(q1.debugToString()).toEqual('*,b[a]');
  expect(q2.debugToString()).toEqual('c,b[a]');
  expect(q3.debugToString()).toEqual('*,*,*,h[d[b[a],c],f[e],g]');
  expect(h).toEqual('h');
  expect(q4.debugToString()).toEqual('g,f[e],d[b[a],c]');
  expect(d).toEqual('d');
  expect(q5.debugToString()).toEqual('*,c[g],b[f[e],a]');
  expect(c).toEqual('c');
  expect(q6.debugToString()).toEqual('g,*,b[f[e],a]');
  expect(b).toEqual('b');
  expect(q7.debugToString()).toEqual('*,*,a[f[e],g]');
  expect(a).toEqual('a');
  expect(q8.debugToString()).toEqual('g,f[e]');
});
