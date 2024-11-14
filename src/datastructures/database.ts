import { Data, DataSet } from './data.js';
import {
  AVL as Tree,
  lookup as lookupTree,
  insert as insertTree,
  visit as visitTree,
} from './avl.js';
import {
  TrieNode,
  lookup as lookupTrie,
  insert as insertTrie,
  visit as visitTrie,
} from './trie.js';

export type Constraint = { type: 'just'; just: Data } | { type: 'noneOf'; noneOf: DataSet };

interface Relation {
  pos: number;
  neg: number;
  trie: TrieNode<Data, Constraint>;
}
const emptyRelation = { trie: null, neg: 0, pos: 0 };

export class Database {
  private tree: Tree<string, Relation>;
  private pos: number;
  private neg: number;

  private constructor(tree: Tree<string, Relation>, pos: number, neg: number) {
    this.tree = tree;
    this.pos = pos;
    this.neg = neg;
  }

  get size() {
    return { pos: this.pos, neg: this.neg };
  }

  static empty(): Database {
    return new Database(null, 0, 0);
  }

  get(name: string, args: Data[]) {
    const trie = lookupTree(this.tree, name);
    const leaf = lookupTrie(trie?.trie ?? null, args);
    if (leaf === null || leaf.children !== null) return null;
    return leaf.value;
  }

  set(name: string, args: Data[], value: Constraint): [Database, Constraint | null] {
    const { trie, pos, neg } = lookupTree(this.tree, name) ?? emptyRelation;
    const [result, removed] = insertTrie(trie, args, 0, value);

    if (removed && removed.children) throw new Error('Database.set invariant');
    const [posInc, negInc] = value.type === 'just' ? [1, 0] : [0, 1];
    const [posDec, negDec] =
      removed === null ? [0, 0] : removed.value.type === 'just' ? [1, 0] : [0, 1];
    const newRel = {
      pos: pos + posInc - posDec,
      neg: neg + negInc - negDec,
      trie: result,
    };
    const [newTree] = insertTree(this.tree, name, newRel);

    return [
      new Database(newTree, this.pos + posInc - posDec, this.neg + negInc - negDec),
      removed?.value ?? null,
    ];
  }

  visit(name: string, args: Data[], depth: number): Generator<Data[]> {
    const relation = lookupTree(this.tree, name);
    if (relation === null) return nullIterator();
    return visitor(relation.trie, args, depth);
  }
}

function* visitor(t: TrieNode<Data, Constraint>, args: Data[], depth: number): Generator<Data[]> {
  // corner case: no outputs in access pattern
  if (depth === 0) {
    // even more corner case: access pattern like `a [_]* is _`
    if (args.length === 0) {
      if (
        t.children !== null /* the predicate has arguments */ ||
        t.value.type === 'just' /* the constraint is positive */
      ) {
        yield [];
      }
      return;
    }

    // perform all lookups but the last one
    const parent = lookupTrie(t, args.slice(0, args.length - 1));
    if (parent === null) {
      return;
    }

    // handle access pattern like `a [+]+ is +`
    if (parent.children === null) {
      if (parent.value.type === 'just' && parent.value.just === args[args.length - 1]) {
        yield [];
      }
      return;
    }

    // handle access pattern like `a [+]+ [_]* is _`
    const child = lookupTree(parent.children, args[args.length - 1]);
    if (child !== null) {
      yield [];
    }
    return;
  }

  const base = lookupTrie(t, args);
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
