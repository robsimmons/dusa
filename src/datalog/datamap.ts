import { Data } from './data';

interface TreeNode<K, V> {
  height: number;
  size: number;
  key: K;
  value: V;
  left: null | TreeNode<K, V>;
  right: null | TreeNode<K, V>;
}

function height<K, V>(t: TreeNode<K, V> | null) {
  return t === null ? 0 : t.height;
}

function size<K, V>(t: TreeNode<K, V> | null): number {
  return t === null ? 0 : t.size;
}

function lookup<K, V>(t: TreeNode<K, V> | null, key: K): V | null {
  if (t === null) return null;
  if (t.key === key) return t.value;
  return key < t.key ? lookup(t.left, key) : lookup(t.right, key);
}

/** Precondition: height(left) and height(right) differ by at most one */
function create<K, V>(
  key: K,
  value: V,
  left: TreeNode<K, V> | null,
  right: TreeNode<K, V> | null,
): TreeNode<K, V> {
  return {
    height: Math.max(height(left), height(right)) + 1,
    size: size(left) + size(right) + 1,
    key,
    value,
    left,
    right,
  };
}

/** Precondition: height(left) === 2 + height(right) */
function createAndFixLeft<K, V>(keyZ: K, valueZ: V, x: TreeNode<K, V>, D: TreeNode<K, V> | null) {
  if (height(x.left) >= height(x.right)) {
    /* This is the 'single rotation case,' where a single rotation will fix things.
     * During insertion, the heights will never be equal, and the resulting tree will
     * have height h+2. During deletion, it's possible for the resulting tree to have
     * height h+3.
     *
     *         z              x
     *       /   \           / \
     *      x     D         A   z
     *    /   \  [h]  --->     / \
     *   A     B              B   D
     * [h+1]  [h]
     *       [h+1]
     */
    return create(x.key, x.value, x.left, create(keyZ, valueZ, x.right, D));
  } else {
    /* This is the double rotation case. The resulting tree will have height h+2
     *
     *         z                 y
     *       /   \             /   \
     *      x     D           x     z
     *    /   \  [h]  --->   / \   / \
     *   A     y            A   B C   D
     *  [h]  /   \
     *      B     C
     *     [h]   [h]
     *    [h-1] [h-1]
     */
    const y = x.right!;
    return create(
      y.key,
      y.value,
      create(x.key, x.value, x.left, y.left),
      create(keyZ, valueZ, y.right, D),
    );
  }
}

/** Precondition: height(left) + 2 === height(right) */
function createAndFixRight<K, V>(keyX: K, valueX: V, A: TreeNode<K, V> | null, z: TreeNode<K, V>) {
  if (height(z.left) <= height(z.right)) {
    /* This is the 'single rotation case,' where a single rotation will fix things.
     * During insertion, the heights will never be equal, and the resulting tree will
     * have height h+2. During deletion, it's possible for the resulting tree to have
     * height h+3.
     *
     *      x                   z
     *    /   \                / \
     *   A     z              x   C
     *  [h]  /   \    --->   / \
     *      B     C         A   B
     *     [h]  [h+1]
     *    [h+1]
     */
    return create(z.key, z.value, create(keyX, valueX, A, z.left), z.right);
  } else {
    /* This is the double rotation case. The resulting tree will have height h+2
     *
     *       x                  y
     *     /   \              /   \
     *    A     z            x     z
     *   [h]  /   \   --->  / \   / \
     *       y     D       A   B C   D
     *     /   \  [h]
     *    B     C
     *   [h]   [h]
     *  [h-1] [h-1]
     */
    const y = z.left!;
    return create(
      y.key,
      y.value,
      create(keyX, valueX, A, y.left),
      create(z.key, z.value, y.right, z.right),
    );
  }
}

function createAndFix<K, V>(
  key: K,
  value: V,
  left: TreeNode<K, V> | null,
  right: TreeNode<K, V> | null,
): TreeNode<K, V> {
  switch (height(left) - height(right)) {
    case -2:
      return createAndFixRight(key, value, left, right!);
    case 2:
      return createAndFixLeft(key, value, left!, right);
    case -1:
    case 0:
    case 1:
      break;
    default:
      throw new Error(`TreeNode: heights differ by ${Math.abs(height(left) - height(right))}`);
  }
  return create(key, value, left, right);
}

function removeMin<K, V>(t: TreeNode<K, V>): [K, V, TreeNode<K, V> | null] {
  if (t.left === null) {
    return [t.key, t.value, t.right];
  }
  const [key, value, left] = removeMin(t.left);
  return [key, value, createAndFix(t.key, t.value, left, t.right)];
}

function remove<K, V>(t: TreeNode<K, V> | null, key: K): [V, TreeNode<K, V> | null] | null {
  if (t === null) return null;
  if (key < t.key) {
    const result = remove(t.left, key);
    return result === null ? null : [result[0], createAndFix(t.key, t.value, result[1], t.right)];
  }
  if (key > t.key) {
    const result = remove(t.right, key);
    return result === null ? null : [result[0], createAndFix(t.key, t.value, t.left, result[1])];
  }
  if (t.right === null) return [t.value, t.left];
  const [rootKey, rootValue, newRight] = removeMin(t.right);
  return [t.value, createAndFix(rootKey, rootValue, t.left, newRight)];
}

function removeNth<K, V>(t: TreeNode<K, V> | null, n: number): [K, V, TreeNode<K, V> | null] {
  if (t === null) throw new Error('Out of bounds removal');
  if (n < size(t.left)) {
    const [key, value, left] = removeNth(t.left, n);
    return [key, value, createAndFix(t.key, t.value, left, t.right)];
  }
  if (n > size(t.left)) {
    const [key, value, right] = removeNth(t.right, n - size(t.left) - 1);
    return [key, value, createAndFix(t.key, t.value, t.left, right)];
  }
  if (t.right === null) return [t.key, t.value, t.left];
  const [rootKey, rootValue, newRight] = removeMin(t.right);
  return [t.key, t.value, createAndFix(rootKey, rootValue, t.left, newRight)];
}

function getNth<K, V>(t: TreeNode<K, V> | null, n: number): [K, V] {
  if (t === null) throw new Error('Out of bounds lookup');
  if (n < size(t.left)) return getNth(t.left, n);
  if (n > size(t.left)) return getNth(t.right, n - size(t.left) - 1);
  return [t.key, t.value];
}

function insert<K, V>(t: TreeNode<K, V> | null, key: K, value: V): TreeNode<K, V> {
  if (t === null) return create(key, value, null, null);
  if (key < t.key) {
    return createAndFix(t.key, t.value, insert(t.left, key, value), t.right);
  } else if (key > t.key) {
    return createAndFix(t.key, t.value, t.left, insert(t.right, key, value));
  }
  return create(t.key, value, t.left, t.right);
}

function isTreeNode<K, V>(t: null | TreeNode<K, V>, lo?: K, hi?: K): boolean {
  if (t === null) return true;
  return (
    (lo == null || lo < t.key) &&
    (hi == null || hi > t.key) &&
    t.height === 1 + Math.max(height(t.left), height(t.right)) &&
    t.size === 1 + size(t.left) + size(t.right) &&
    isTreeNode(t.left, lo, t.key) &&
    isTreeNode(t.right, t.key, hi)
  );
}

function accumEntries<K, V>(accum: [K, V][], t: null | TreeNode<K, V>) {
  if (t === null) return;
  accumEntries(accum, t.left);
  accum.push([t.key, t.value]);
  accumEntries(accum, t.right);
}

function every<K, V>(t: null | TreeNode<K, V>, test: (key: K, value: V) => boolean): boolean {
  if (t === null) return true;
  return test(t.key, t.value) && every(t.left, test) && every(t.right, test);
}

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
