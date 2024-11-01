import { test, expect } from 'vitest';
import { srcToBinarized } from './binarize2.test.js';
import { makeIntermediatePredicatesMatchJoinOrder } from './binarize2.js';
import { generateIndices } from './indexes.js';
import { r } from './buf.js';

function srcToIndexed(source: string) {
  const binarized = srcToBinarized(source);
  return makeIntermediatePredicatesMatchJoinOrder(generateIndices(binarized));
}

console.log(r);