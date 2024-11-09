import { Data, compareData, compareString } from './data.js';
import {
  AVL as Tree,
  lookup as lookupTree,
  insert as insertTree,
  remove as removeTree,
  choose as chooseTree,
} from './avl.js';
import {
  Trie,
  lookup as lookupTrie,
  insert as insertTrie,
  remove as removeTrie,
} from './trie.js';

export class AttributeMap<T> {
  private tree: Tree<string, Trie<Data, T>>;
  private _size: number;

  private constructor(tree: Tree<string, Trie<Data, T>>, size: number) {
    this.tree = tree;
    this._size = size;
  }

  get size() {
    return this._size;
  }

  static empty<T>(): AttributeMap<T> {
    return new AttributeMap(null, 0);
  }

  get(name: string, args: Data[]) {
    const trie = lookupTree(compareString, this.tree, name);
    const leaf = lookupTrie(compareData, trie, args);
    if (leaf === null || leaf.children !== null) return null;
    return leaf.value;
  }

  set(name: string, args: Data[], value: T): [AttributeMap<T>, T | null] {
    const trie = lookupTree(compareString, this.tree, name);
    const [newTrie, removed] = insertTrie(compareData, trie, args, 0, value);
    if (removed && removed.children) throw new Error('Attribute.set invariant');
    const [newTree] = insertTree(compareString, this.tree, name, newTrie);
    return [
      new AttributeMap(newTree, removed === null ? this._size + 1 : this._size),
      removed?.value ?? null,
    ];
  }

  remove(name: string, args: Data[]): null | [AttributeMap<T>, T] {
    const trie = lookupTree(compareString, this.tree, name);
    const removeResult = removeTrie(compareData, trie, args, 0);
    if (removeResult === null) return null;
    const [newTrie, removed] = removeResult;
    if (removed && removed.children) throw new Error('Attribute.remove invariant');
    let newTree: Tree<string, Trie<Data, T>>;
    if (newTrie === null) {
      [newTree] = removeTree(compareString, this.tree, name)!;
    } else {
      [newTree] = insertTree(compareString, this.tree, name, newTrie);
    }
    return [
      new AttributeMap(newTree, removed === null ? this._size : this._size - 1),
      removed.value,
    ];
  }

  /** Quickly return a single element, or null if one exists */
  example(): null | { name: string; args: Data[]; value: T } {
    if (this.tree === null) return null;
    let { key: name, value: trie } = this.tree;
    const args: Data[] = [];
    while (trie !== null && trie.children !== null) {
      const { key: arg, value: subTrie } = trie.children;
      args.push(arg);
      trie = subTrie;
    }
    return { name, args, value: trie!.value };
  }

  /** Return an element if one exists, with some chance that any element will be selected */
  choose(): null | { name: string; args: Data[]; value: T } {
    if (this.tree === null) return null;
    let [name, trie] = chooseTree(this.tree)!;
    const args: Data[] = [];
    while (trie !== null && trie.children !== null) {
      const [arg, subTrie] = chooseTree(trie.children)!;
      args.push(arg);
      trie = subTrie;
    }
    return { name, args, value: trie!.value };
  }
}
