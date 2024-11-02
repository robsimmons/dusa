import { Data } from '../datastructures/data.js';
import { TrieMap } from '../datastructures/datamap.js';

type Intermediate = { type: 'intermediate'; name: string; shared: Data[]; passed: Data[] };
type NewFact = { type: 'fact'; name: string; args: Data[] };
type AgendaMember = Intermediate | NewFact;

type Lst<T> = null | { data: T; next: LL<T> };
function lstArr<T>(xs: Lst<T>): T[] {
  const result: T[] = [];
  for (let node = xs; node !== null; node = node.next) {
    result.push(node.data);
  }
  return result;
}

export interface Database {
  factValues: TrieMap<
    Data,
    { type: 'just'; value: Data } | { type: 'noneOf'; value: Data[] } | null
  >;
}
