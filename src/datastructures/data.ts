import {
  AVL as Tree,
  lookup as lookupTree,
  insert as insertTree,
  choose as chooseTree,
  remove as removeTree,
  iterator as iteratorTree,
} from './avl.js';

type ViewsIndex = number;

/**
 * Outside data.ts, the type Data should be treated externally as an opaque type.
 *
 * A piece of Data belongs to a specific HashCons object, and Data returned from
 * one HashCons.hide() cannot be given to another HashCons object.
 */
export type Data = ViewsIndex | bigint;

export type DataView =
  | { type: 'trivial' }
  | { type: 'int'; value: bigint }
  | { type: 'bool'; value: boolean }
  | { type: 'string'; value: string }
  | { type: 'const'; name: string; args: Data[] }
  | { type: 'ref'; value: number };

type DataTrie = {
  value?: ViewsIndex;
  children: { [value: string | ViewsIndex]: DataTrie };
};

export class HashCons {
  private nextRef: number = -1;
  private views: DataView[] = [
    { type: 'trivial' },
    { type: 'bool', value: true },
    { type: 'bool', value: false },
  ];
  private strings: { [s: string]: number } = {};
  private structures: { [name: string]: DataTrie } = {};

  static readonly TRIVIAL = 0;
  static readonly BOOL_TRUE = 1;
  static readonly BOOL_FALSE = 2;

  expose(d: Data): DataView {
    if (typeof d === 'bigint') return { type: 'int', value: d };
    if (d <= this.nextRef) throw new Error(`Internalized ref ${-d} is invalid.`);
    if (d < 0) return { type: 'ref', value: -d };
    if (d >= this.views.length) throw new Error(`Internalized value ${d} is invalid.`);
    return this.views[d];
  }

  private getStructureIndex(name: string, args: Data[]): ViewsIndex | null {
    let structure: DataTrie | undefined = this.structures[name];
    for (const arg of args) {
      if (structure === undefined) return null;
      structure = structure.children[typeof arg === 'bigint' ? `${arg}n` : arg];
    }
    return structure?.value ?? null;
  }

  private setStructureIndex(name: string, args: Data[], value: ViewsIndex) {
    if (!this.structures[name]) this.structures[name] = { children: {} };
    let structure = this.structures[name];

    for (const arg of args) {
      const index = typeof arg === 'bigint' ? `${arg}n` : arg;
      if (!structure.children[index]) structure.children[index] = { children: {} };
      structure = structure.children[index];
    }
    structure.value = value;
  }

  hide(d: DataView): Data {
    switch (d.type) {
      case 'trivial':
        return HashCons.TRIVIAL;
      case 'int':
        return d.value;
      case 'bool':
        return d.value ? HashCons.BOOL_TRUE : HashCons.BOOL_FALSE;
      case 'ref':
        return -d.value;
      case 'string': {
        const candidate = this.strings[d.value];
        if (candidate !== undefined) return candidate;
        const result = this.views.length;
        this.views.push({ type: 'string', value: d.value });
        this.strings[d.value] = result;
        return result;
      }
      case 'const': {
        const candidate = this.getStructureIndex(d.name, d.args);
        if (candidate !== null) return candidate;
        const result = this.views.length;
        this.views.push({ type: 'const', name: d.name, args: d.args });
        this.setStructureIndex(d.name, d.args, result);
        return result;
      }
    }
  }

  genRef(): Data {
    return this.nextRef--;
  }

  toString(d: Data, needsParens = false): String {
    const view = this.expose(d);
    switch (view.type) {
      case 'trivial':
        return `()`;
      case 'int':
        return `${view.value}`;
      case 'bool':
        return `#${view.value ? 'tt' : 'ff'}`;
      case 'ref':
        return `#${view.value}`;
      case 'string': {
        return `"${escapeString(view.value)}"`;
      }
      case 'const':
        return view.args.length === 0
          ? view.name
          : needsParens
            ? `(${view.name} ${view.args.map((arg) => this.toString(arg, true)).join(' ')})`
            : `${view.name} ${view.args.map((arg) => this.toString(arg, true)).join(' ')}`;
    }
  }
}

/** Compares data without accessing memory; suitable for internal data structures. */
export function compareData(a: Data, b: Data): number {
  if (typeof a === 'number') {
    if (typeof b === 'number') {
      return a - b;
    }
    return 1;
  }
  if (typeof b === 'bigint') {
    return a > b ? 1 : a < b ? -1 : 0;
  }
  return -1;
}

export function compareString(a: string, b: string): number {
  if (a > b) return 1;
  if (a < b) return -1;
  return 0;
}

export function escapeString(input: string): string {
  const escaped = [];
  let i = 0;
  while (i < input.length) {
    if (input.codePointAt(i)! > 0xffff) {
      escaped.push(`\\u{${input.codePointAt(i)!.toString(16)}}`);
      i += 2;
    } else {
      const ch = input.charAt(i);
      if (ch.charCodeAt(0) > 0xff) {
        escaped.push(`\\u{${input.charCodeAt(i).toString(16)}}`);
      } else if (ch.match(/[ !#-[\]-~]/)) {
        escaped.push(ch);
      } else if (ch === '\\') {
        escaped.push('\\\\');
      } else if (ch === '"') {
        escaped.push('\\"');
      } else if (ch === '\n') {
        escaped.push('\\n');
      } else if (ch.charCodeAt(0) >= 16) {
        escaped.push(`\\x${input.charCodeAt(i).toString(16)}`);
      } else {
        escaped.push(`\\x0${input.charCodeAt(i).toString(16)}`);
      }
      i += 1;
    }
  }
  return escaped.join('');
}

export class DataMap<T> {
  private tree: Tree<Data, T>;
  private _size: number;

  private constructor(tree: Tree<Data, T>, size: number) {
    this.tree = tree;
    this._size = size;
  }

  get size() {
    return this._size;
  }

  static empty<T>(): DataMap<T> {
    return new DataMap<T>(null, 0);
  }

  static singleton<T>(key: Data, value: T) {
    return new DataMap<T>({ height: 1, key, value, left: null, right: null }, 1);
  }

  get(key: Data) {
    return lookupTree(compareData, this.tree, key);
  }

  set(key: Data, value: T) {
    const [newTree, removed] = insertTree(compareData, this.tree, key, value);
    return new DataMap(newTree, removed === null ? this._size + 1 : this._size);
  }

  remove(key: Data): null | [DataMap<T>, T] {
    const removeResult = removeTree(compareData, this.tree, key);
    if (removeResult === null) return null;
    const [newTree, removed] = removeResult;
    return [new DataMap(newTree, removed === null ? this._size : this._size - 1), removed];
  }

  /** Return the only element if it exists, otherwise return null */
  getSingleton(): null | [Data, T] {
    if (this._size !== 1) return null;
    return [this.tree!.key, this.tree!.value];
  }

  /** Quickly return a single element, or null if one exists */
  example(): null | [Data, T] {
    return this.tree === null ? null : [this.tree.key, this.tree.value];
  }

  /** Return an element if one exists, with some chance that any element will be selected. */
  choose(): null | [Data, T] {
    return chooseTree(this.tree);
  }

  [Symbol.iterator]() {
    return iteratorTree(this.tree);
  }
}

export class DataSet {
  private map: DataMap<true>;

  private constructor(map: DataMap<true>) {
    this.map = map;
  }

  get size() {
    return this.map.size;
  }

  static empty(): DataSet {
    return new DataSet(DataMap.empty());
  }

  static singleton(key: Data) {
    return new DataSet(DataMap.singleton(key, true));
  }

  has(key: Data) {
    return !!this.map.get(key);
  }

  add(key: Data) {
    return new DataSet(this.map.set(key, true));
  }

  /** Return the only element if it exists, otherwise return null */
  getSingleton() {
    return this.map.getSingleton();
  }

  /** Quickly return a single element, or null if one exists */
  example() {
    return this.map.example()?.[0] ?? null;
  }

  /** Return an element if one exists, with some chance that any element will be selected. */
  choose() {
    return this.map.choose()?.[0] ?? null;
  }

  [Symbol.iterator]() {
    return keyIterator(this.map);
  }
}

function* keyIterator<T>(map: DataMap<T>) {
  for (const [key] of map) {
    yield key;
  }
}
