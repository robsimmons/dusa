import { Data } from './data.js';
import {
  AVL as Tree,
  lookup as lookupTree,
  insert as insertTree,
  remove as removeTree,
  choose as chooseTree,
  Ref,
} from './avl.js';
import {
  Trie,
  lookup as lookupTrie,
  insert as insertTrie,
  remove as removeTrie,
  TrieNode,
} from './trie.js';

export class AttributeMap<T> {
  private tree: Tree<string, TrieNode<Data, T>>;
  private _size: number;

  protected constructor(tree: Tree<string, TrieNode<Data, T>>, size: number) {
    this.tree = tree;
    this._size = size;
  }

  get size() {
    return this._size;
  }

  static empty<T>(): AttributeMap<T> {
    return new AttributeMap(null, 0);
  }

  get(name: string, args: Data[]): T | null {
    const trie = lookupTree(this.tree, name);
    const leaf = lookupTrie(trie, args, args.length);
    if (leaf === null || leaf.children !== null) return null;
    return leaf.value;
  }

  set(
    name: string,
    args: Data[],
    value: T,
    limit: number | null = null,
  ): [AttributeMap<T>, T | null] {
    const ref: Ref<TrieNode<Data, T>> = { current: null };
    const trie = lookupTree(this.tree, name);
    const newTrie = insertTrie(trie, args, 0, limit ?? args.length, value, ref);
    if (ref.current && ref.current.children) throw new Error('Attribute.set invariant');
    const newTree = insertTree(this.tree, name, newTrie, null);
    if (ref.current === null) {
      return [new AttributeMap(newTree, this._size + 1), null];
    } else {
      return [new AttributeMap(newTree, this._size), ref.current.value];
    }
  }

  remove(name: string, args: Data[], limit: number | null = null): null | [AttributeMap<T>, T] {
    const trie = lookupTree(this.tree, name);
    const ref: Ref<TrieNode<Data, T>> = { current: null };
    const newTrie = removeTrie(trie, args, 0, limit ?? args.length, ref);
    if (ref.current === null) return null;
    if (ref.current.children) throw new Error('Attribute.remove invariant');

    let newTree: Tree<string, TrieNode<Data, T>>;
    if (newTrie === null) {
      newTree = removeTree(this.tree, name, null);
    } else {
      newTree = insertTree(this.tree, name, newTrie, null);
    }

    return [new AttributeMap(newTree, this._size - 1), ref.current.value];
  }

  /**
   * Quickly return a single element, or null if one exists
   */
  example(): null | { name: string; args: Data[]; value: T } {
    if (this.tree === null) return null;
    const name = this.tree.key;
    let trie = this.tree.value;
    const args: Data[] = [];
    while (trie !== null && trie.children !== null) {
      const { key: arg, value: subTrie } = trie.children;
      args.push(arg);
      trie = subTrie;
    }
    return { name, args, value: trie!.value };
  }

  /**
   * Return an element if one exists, with some chance that any element will
   * be selected
   */
  choose(): null | { name: string; args: Data[]; value: T } {
    if (this.tree === null) return null;
    const [name, trie_] = chooseTree(this.tree)!;
    let trie = trie_;
    const args: Data[] = [];
    while (trie !== null && trie.children !== null) {
      const [arg, subTrie] = chooseTree(trie.children)!;
      args.push(arg);
      trie = subTrie;
    }
    return { name, args, value: trie!.value };
  }

  /**
   * Abstraction-boundary-violating access to the underlying trie; necessary
   * for how the Database type currently performs visits.
   */
  getTrie(name: string): Trie<Data, T> {
    return lookupTree(this.tree, name);
  }
}
