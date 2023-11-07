import { test, expect } from 'vitest';
import { DataMap } from './datamap';

test('Inserting increasing values', () => {
  let map: DataMap<bigint> = DataMap.new();

  expect(map.isOk()).toBeTruthy();
  for (let i = 1n; i < 100n; i += 2n) {
    map = map.set(i, i);
    expect(map.isOk()).toBeTruthy();
  }

  for (let i = 0n; i <= 100n; i++) {
    if (i % 2n === 0n) {
      expect(map.get(i)).toBeNull();
    } else {
      expect(map.get(i)).toEqual(i);
    }
  }

  for (let i = 1n; i < 100n; i += 2n) {
    map = map.set(i, i + 1n);
    expect(map.isOk()).toBeTruthy();
  }

  for (let i = 0n; i <= 100n; i++) {
    if (i % 2n === 0n) {
      expect(map.get(i)).toBeNull();
    } else {
      expect(map.get(i)).toEqual(i + 1n);
    }
  }
});

test('Inserting decreasing values', () => {
  let map: DataMap<bigint> = DataMap.new();
  expect(map.isOk()).toBeTruthy();
  for (let i = 10000n; i > 9900n; i--) {
    map = map.set(i, i * 3n);
    expect(map.isOk()).toBeTruthy();
  }

  for (let i = 9900n; i > 0; i--) {
    map = map.set(i, i * 3n);
  }
  expect(map.isOk()).toBeTruthy();

  for (let i = 1n; i <= 10000n; i++) {
    expect(map.get(i)).toEqual(3n * i);
  }
});

test('Insert values in random order', () => {
  const values: [bigint, number][] = [];
  for (let i = 0n; i < 20000n; i++) {
    values.push([i, Math.random()]);
  }
  values.sort(([_a, x], [_b, y]) => x - y);
  let map: DataMap<BigInt> = DataMap.new();
  for (const [a, _] of values) {
    map = map.set(a, -a);
  }
  for (let i = 0n; i < 20000n; i++) {
    expect(map.get(i)).toEqual(-i);
  }
});
