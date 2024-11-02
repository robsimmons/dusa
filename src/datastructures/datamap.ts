import { Data } from './data.js';


export class DataMap<T> {
  private indexTree: null | TreeNode<number, T>;
  private bigintTree: null | TreeNode<bigint, T>;

  private constructor(
    indexTree: null | TreeNode<number, T>,
    bigintTree: null | TreeNode<bigint, T>,
  ) {
    this.indexTree = indexTree;
    this.bigintTree = bigintTree;
  }

  static new<T>(): DataMap<T> {
    return new DataMap<T>(null, null);
  }

  set(key: Data, value: T) {
    if (typeof key === 'bigint')
      return new DataMap(this.indexTree, insert(this.bigintTree, key, value));
    return new DataMap(insert(this.indexTree, key, value), this.bigintTree);
  }

  get(key: Data): T | null {
    if (typeof key === 'bigint') return lookup(this.bigintTree, key);
    return lookup(this.indexTree, key);
  }

  getNth(n: number): [Data, T] {
    if (n < size(this.indexTree)) return getNth(this.indexTree, n);
    return getNth(this.bigintTree, n - size(this.indexTree));
  }

  remove(key: Data): [T, DataMap<T>] | null {
    if (typeof key === 'bigint') {
      const result = remove(this.bigintTree, key);
      if (result === null) return null;
      return [result[0], new DataMap<T>(this.indexTree, result[1])];
    }
    const result = remove(this.indexTree, key);
    if (result === null) return null;
    return [result[0], new DataMap<T>(result[1], this.bigintTree)];
  }

  entries(): [Data, T][] {
    const accum: [Data, T][] = [];
    accumEntries(accum, this.indexTree);
    accumEntries(accum, this.bigintTree);
    return accum;
  }

  get length() {
    return size(this.indexTree) + size(this.bigintTree);
  }

  every(test: (key: Data, value: T) => boolean): boolean {
    return every(this.indexTree, test) && every(this.bigintTree, test);
  }

  popFirst(): [Data, T, DataMap<T>] {
    if (this.indexTree === null) {
      if (this.bigintTree === null) {
        throw new Error('Removal from empty map');
      }
      const [k, v, bigintTree] = removeMin(this.bigintTree);
      return [k, v, new DataMap(this.indexTree, bigintTree)];
    }
    const [k, v, indexTree] = removeMin(this.indexTree);
    return [k, v, new DataMap(indexTree, this.bigintTree)];
  }

  popRandom(): [Data, T, DataMap<T>] {
    const i = size(this.indexTree);
    const b = size(this.bigintTree);
    const toRemove = Math.floor((i + b) * Math.random());
    if (toRemove < i) {
      const [k, v, indexTree] = removeNth(this.indexTree!, toRemove);
      return [k, v, new DataMap(indexTree, this.bigintTree)];
    }
    const [k, v, bigintTree] = removeNth(this.bigintTree!, toRemove - i);
    return [k, v, new DataMap(this.indexTree, bigintTree)];
  }

  isOk() {
    return isTreeNode(this.indexTree) && isTreeNode(this.bigintTree);
  }
}

type TrieNode<K, V> =
  | { depth: number; child: TreeNode<K, TrieNode<K, V>> }
  | { depth: null; value: V };

function trieLookup<K, V>(keys: K[], t: null | TrieNode<K, V>): TrieNode<K, V> | null {
  for (const key of keys) {
    if (t === null) return null;
    if (t.depth === null) throw new Error('triesize');
    t = lookup(t.child, key);
  }
  return t;
}

function singleton<K, V>(index: number, keys: K[], value: V): TrieNode<K, V> {
  if (index === keys.length) {
    return { depth: null, value };
  } else {
    return {
      depth: keys.length - index,
      child: create(keys[index], singleton(index + 1, keys, value), null, null),
    };
  }
}

function trieInsert<K, V>(
  index: number,
  keys: K[],
  value: V,
  t: null | TrieNode<K, V>,
): { result: TrieNode<K, V>; removed: V | null } {
  if (t === null) {
    return { result: singleton(index, keys, value), removed: null };
  }

  if (index === keys.length) {
    if (t.depth !== null) throw new Error('Depth invariant');
    return { result: { depth: null, value }, removed: t.value };
  }

  if (t.depth !== keys.length - index) throw new Error('Depth invariant');
  const subTrie = lookup(t.child, keys[index]);
  const { result, removed } = trieInsert(index + 1, keys, value, subTrie);
  return { result: { depth: t.depth, child: insert(t.child, keys[index], result) }, removed };
}

function* visitTree<K, V>(t: null | TreeNode<K, V>): IterableIterator<{ key: K; value: V }> {
  const stack: TreeNode<K, V>[] = [];
  for (;;) {
    while (t !== null) {
      stack.push(t);
      t = t.left;
    }
    t = stack.pop() ?? null;
    if (t === null) return;
    yield { key: t.key, value: t.value };
    t = t.right;
  }
}

function* visitTrieInOrder<K, V>(tr: TrieNode<K, V>) {
  const keys: K[] = [];
  const stack: Iterator<{ key: K; value: TrieNode<K, V> }>[] = [];
  let current: null | TrieNode<K, V> = tr;

  while (current !== null) {
    // Descend
    while (current !== null && current.depth !== null) {
      const iterator: Iterator<{ key: K; value: TrieNode<K, V> }> = visitTree(current.child);
      const result = iterator.next();
      if (result.done) throw new Error('Empty trie child');
      const child = result.value;
      keys.push(child.key);
      stack.push(iterator);
      current = child.value;
    }

    // Yield
    yield { keys: [...keys], value: current.value };

    // Ascend
    current = null;
    while (current === null) {
      keys.pop();
      const iterator = stack.pop();
      if (!iterator) return;
      const result = iterator.next();
      if (!result.done) {
        keys.push(result.value.key);
        stack.push(iterator);
        current = result.value.value;
      }
    }
  }
}

function* trieMapEntries<K, V>(t: null | TreeNode<string, TrieNode<K, V>>) {
  for (const entry of visitTree(t)) {
    for (const { keys, value } of visitTrieInOrder(entry.value)) {
      yield { name: entry.key, keys, value };
    }
  }
}

export class TrieMap<K, V> {
  private t: null | TreeNode<string, TrieNode<K, V>>;
  private constructor(t: null | TreeNode<string, TrieNode<K, V>>) {
    this.t = t;
  }

  static new<K, V>(): TrieMap<K, V> {
    return new TrieMap(null);
  }

  arity(name: string): number | null {
    const trie = lookup(this.t, name);
    if (trie === null) return null;
    return trie.depth ?? 0;
  }

  set(name: string, args: K[], value: V) {
    const trie = lookup(this.t, name);
    if (trie !== null && args.length !== (trie.depth ?? 0)) {
      throw new Error(
        `Attribute ${name} has ${trie.depth} arguments, but set was given ${args.length} arguments`,
      );
    }

    const { result, removed } = trieInsert(0, args, value, trie);
    return { result: new TrieMap(insert(this.t, name, result)), removed };
  }

  get(name: string, args: K[]): V | null {
    const trie = lookup(this.t, name);
    if (trie !== null && args.length !== (trie.depth ?? 0)) {
      throw new Error(
        `Attribute ${name} has ${trie.depth} arguments, but get was given ${args.length} arguments`,
      );
    }
    const leaf = trieLookup(args, trie);
    if (leaf === null) return null;
    if (leaf.depth !== null) {
      throw new Error(`Invariant`);
    }
    return leaf.value;
  }

  lookup(name: string, args: K[]): IterableIterator<{ keys: K[]; value: V }> {
    const trie = trieLookup(args, lookup(this.t, name));
    if (trie === null) return [][Symbol.iterator]();
    return visitTrieInOrder(trie);
  }

  entries(): IterableIterator<{ name: string; keys: K[]; value: V }> {
    return trieMapEntries(this.t);
  }
}
