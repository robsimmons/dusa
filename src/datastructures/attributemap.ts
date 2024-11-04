import { Data, compareData, compareString } from './data.js';
import {
  AVL as Tree,
  lookup as lookupTree,
  insert as insertTree,
  remove as removeTree,
  visit as visitTree,
} from './avl.js';
import {
  Trie,
  lookup as lookupTrie,
  insert as insertTrie,
  remove as removeTrie,
  visit as visitTrie,
} from './trie.js';

export class AttributeMap<T> {
  private t: Tree<string, Trie<Data, T>>;

  private constructor(t: Tree<string, Trie<Data, T>>) {
    this.t = t;
  }

  static empty<T>(): AttributeMap<T> {
    return new AttributeMap(null);
  }

  get(name: string, args: Data[]) {
    const trie = lookupTree(compareString, this.t, name);
    const leaf = lookupTrie(compareData, trie, args);
    if (leaf === null || leaf.children !== null) return null;
    return leaf.value;
  }

  set(name: string, args: Data[], value: T): [AttributeMap<T>, T | null] {
    const trie = lookupTree(compareString, this.t, name);
    const [newTrie, removed] = insertTrie(compareData, trie, args, 0, value);
    if (removed && removed.children) throw new Error('Attribute.set invariant');
    const [newTree] = insertTree(compareString, this.t, name, newTrie);
    return [new AttributeMap(newTree), removed?.value ?? null];
  }

  remove(name: string, args: Data[]): null | [AttributeMap<T>, T | null] {
    const trie = lookupTree(compareString, this.t, name);
    const removeResult = removeTrie(compareData, trie, args, 0);
    if (removeResult === null) return null;
    const [newTrie, removed] = removeResult;
    if (removed && removed.children) throw new Error('Attribute.remove invariant');
    let newTree: Tree<string, Trie<Data, T>>;
    if (newTrie === null) {
      [newTree] = removeTree(compareString, this.t, name)!;
    } else {
      [newTree] = insertTree(compareString, this.t, name, newTrie);
    }
    return [new AttributeMap(newTree), removed?.value ?? null];
  }
}
