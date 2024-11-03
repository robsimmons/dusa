import {
  Compare,
  AVLNode as TreeNode,
  insert as insertTree,
  lookup as lookupTree,
  visit as visitTree,
  singleton as singletonTree,
} from './avl.js';

export type TrieNode<K, V> =
  | {
      child: TreeNode<K, TrieNode<K, V>>;
    }
  | {
      child: null;
      value: V;
    };

export type Trie<K, V> = TrieNode<K, V> | null;

export function lookup<K, V>(compare: Compare<K>, t: Trie<K, V>, keys: K[]): TrieNode<K, V> | null {
  for (const key of keys) {
    if (t === null) return null;
    t = lookupTree(compare, t.child, key);
  }
  return t;
}

export function singleton<K, V>(index: number, keys: K[], value: V): TrieNode<K, V> {
  let t: TrieNode<K, V> = { child: null, value };
  for (let i = keys.length - 1; i >= index; i--) {
    t = { child: singletonTree(keys[i], t) };
  }
  return t;
}

export function insert<K, V>(
  compare: Compare<K>,
  t: Trie<K, V>,
  index: number,
  keys: K[],
  value: V,
): [TrieNode<K, V>, Trie<K, V>] {
  if (t === null) {
    return [singleton(index, keys, value), null];
  }

  if (index === keys.length) {
    return [{ child: null, value }, t];
  }

  const subTrie = lookupTree(compare, t.child, keys[index]);
  const [result, removed] = insert(compare, subTrie, index + 1, keys, value);
  const [child] = insertTree(compare, t.child, keys[index], result);
  return [{ child }, removed];
}

type TreeIterator<K, V> = Iterator<{ key: K; value: TrieNode<K, V> }>;

export function* visit<K, V>(tr: Trie<K, V>, depth: number) {
  const keys: K[] = [];
  const stack: TreeIterator<K, V>[] = [];
  let current: Trie<K, V> = tr;

  while (current !== null) {
    // Descend
    while (stack.length < depth) {
      const iterator: TreeIterator<K, V> = visitTree(current!.child);
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
