import {
  Compare,
  AVLNode as TreeNode,
  insert as insertTree,
  lookup as lookupTree,
  remove as removeTree,
  visit as visitTree,
  singleton as singletonTree,
} from './avl.js';

export type TrieNode<K, V> =
  | {
      children: TreeNode<K, TrieNode<K, V>>;
    }
  | {
      children: null;
      value: V;
    };

export type Trie<K, V> = TrieNode<K, V> | null;

export function lookup<K, V>(compare: Compare<K>, t: Trie<K, V>, keys: K[]): TrieNode<K, V> | null {
  for (const key of keys) {
    if (t === null) return null;
    t = lookupTree(compare, t.children, key);
  }
  return t;
}

export function singleton<K, V>(index: number, keys: K[], value: V): TrieNode<K, V> {
  let t: TrieNode<K, V> = { children: null, value };
  for (let i = keys.length - 1; i >= index; i--) {
    t = { children: singletonTree(keys[i], t) };
  }
  return t;
}

export function insert<K, V>(
  compare: Compare<K>,
  t: Trie<K, V>,
  keys: K[],
  index: number,
  value: V,
): [TrieNode<K, V>, Trie<K, V>] {
  if (t === null) {
    return [singleton(index, keys, value), null];
  }

  if (index === keys.length) {
    return [{ children: null, value }, t];
  }

  const subTrie = lookupTree(compare, t.children, keys[index]);
  const [child, removed] = insert(compare, subTrie, keys, index + 1, value);
  const [children] = insertTree(compare, t.children, keys[index], child);
  return [{ children }, removed];
}

type TreeIterator<K, V> = Iterator<{ key: K; value: TrieNode<K, V> }>;

export function* visit<K, V>(tr: Trie<K, V>, depth: number) {
  const keys: K[] = [];
  const stack: TreeIterator<K, V>[] = [];
  let current: Trie<K, V> = tr;

  while (current !== null) {
    // Descend
    while (stack.length < depth) {
      const iterator: TreeIterator<K, V> = visitTree(current!.children);
      const result = iterator.next();
      if (result.done) throw new Error('Empty trie child');
      const child = result.value;
      keys.push(child.key);
      stack.push(iterator);
      current = child.value;
    }

    yield { keys: [...keys], value: current };

    // Ascend
    while (true) {
      keys.pop();
      const iterator = stack.pop();
      if (!iterator) return;
      const result = iterator.next();
      if (!result.done) {
        keys.push(result.value.key);
        stack.push(iterator);
        current = result.value.value;
        break;
      }
    }
  }
}

export function remove<K, V>(
  compare: Compare<K>,
  t: Trie<K, V>,
  keys: K[],
  index: number,
): [Trie<K, V>, TrieNode<K, V>] | null {
  if (t === null) return null;
  if (index === keys.length) return [null, t];
  if (!t.children) throw new Error('Empty trie child');

  const child = lookupTree(compare, t.children, keys[index]);
  if (child === null) return null;

  const removeChildResult = remove(compare, child, keys, index + 1);
  if (removeChildResult === null) return null;

  const [newChild, removed] = removeChildResult;
  if (newChild === null) {
    const [newChildren] = removeTree(compare, t.children, keys[index])!;
    if (newChildren === null) {
      return [null, removed];
    } else {
      return [{ children: newChildren }, removed];
    }
  } else {
    const [newChildren] = insertTree(compare, t.children, keys[index], newChild);
    return [{ children: newChildren }, removed];
  }
}
