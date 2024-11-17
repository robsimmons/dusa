import { Data, DataSet } from './data.js';
import {
  lookup as lookupTree,
  visit as visitTree,
} from './avl.js';
import {
  TrieNode,
  lookup as lookupTrie,
  visit as visitTrie,
} from './trie.js';
import { AttributeMap } from './attributemap.js';

export type Constraint = { type: 'just'; just: Data } | { type: 'noneOf'; noneOf: DataSet };

export class Database {
  private map: AttributeMap<Constraint>;
  private pos: number;
  private neg: number;

  private constructor(map: AttributeMap<Constraint>, pos: number, neg: number) {
    this.map = map;
    this.pos = pos;
    this.neg = neg;
  }

  get size() {
    return { pos: this.pos, neg: this.neg };
  }

  static empty(): Database {
    return new Database(AttributeMap.empty(), 0, 0);
  }

  get(name: string, args: Data[]): Constraint | null {
    return this.map.get(name, args);
  }

  set(
    name: string,
    args: Data[],
    value: Constraint,
    limit: number | null = null,
  ): [Database, Constraint | null] {
    const [newMap, removed] = this.map.set(name, args, value, limit);
    const [posInc, negInc] = value.type === 'just' ? [1, 0] : [0, 1];
    const [posDec, negDec] = removed === null ? [0, 0] : removed.type === 'just' ? [1, 0] : [0, 1];
    return [new Database(newMap, this.pos + posInc - posDec, this.neg + negInc - negDec), removed];
  }

  visit(name: string, args: Data[], limit: number, depth: number): Generator<Data[]> {
    const relation = this.map.getTrie(name);
    if (relation === null) return nullIterator();
    return visitor(relation, args, limit, depth);
  }
}

function* visitor(
  t: TrieNode<Data, Constraint>,
  args: Data[],
  limit: number,
  depth: number,
): Generator<Data[]> {
  // corner case: no outputs in access pattern
  if (depth === 0) {
    // even more corner case: access pattern like `a [_]* is _`
    if (limit === 0) {
      if (
        t.children !== null /* the predicate has arguments */ ||
        t.value.type === 'just' /* the constraint is positive */
      ) {
        yield [];
      }
      return;
    }

    // perform all lookups but the last one
    const parent = lookupTrie(t, args, limit - 1);
    if (parent === null) {
      return;
    }

    // handle access pattern like `a [+]+ is +`
    if (parent.children === null) {
      if (parent.value.type === 'just' && parent.value.just === args[limit - 1]) {
        yield [];
      }
      return;
    }

    // handle access pattern like `a [+]+ [_]* is _`
    const child = lookupTree(parent.children, args[limit - 1]);
    if (child !== null) {
      yield [];
    }
    return;
  }

  const base = lookupTrie(t, args, limit);
  for (const { keys, value } of visitTrie(base, depth - 1)) {
    if (value.children === null) {
      if (value.value.type === 'just') {
        keys.push(value.value.just);
        yield keys;
        keys.pop();
      }
    } else {
      for (const { key } of visitTree(value.children)) {
        keys.push(key);
        yield keys;
        keys.pop();
      }
    }
  }
}

// eslint-disable-next-line require-yield
function* nullIterator<T>(): Generator<T> {
  return;
}
