export interface AVLNode<K, V> {
  height: number;
  size: number;
  key: K;
  value: V;
  left: null | AVLNode<K, V>;
  right: null | AVLNode<K, V>;
}

export type AVL<K, V> = AVLNode<K, V> | null;

function height<K, V>(t: AVL<K, V>) {
  return t === null ? 0 : t.height;
}

function size<K, V>(t: AVL<K, V>): number {
  return t === null ? 0 : t.size;
}

export function lookup<K, V>(compare: (a: K, b: K) => number) {
  return (t: AVL<K, V>, key: K): V | null => {
    while (t !== null) {
      const comp = compare(t.key, key);
      if (comp === 0) return t.value;
      if (comp < 0) {
        t = t.left;
      } else {
        t = t.right;
      }
    }
    return null;
  };
}

/** Precondition: height(left) and height(right) differ by at most one */
function create<K, V>(
  key: K,
  value: V,
  left: AVLNode<K, V> | null,
  right: AVLNode<K, V> | null,
): AVLNode<K, V> {
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
function createAndFixLeft<K, V>(keyZ: K, valueZ: V, x: AVLNode<K, V>, D: AVLNode<K, V> | null) {
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
function createAndFixRight<K, V>(keyX: K, valueX: V, A: AVLNode<K, V> | null, z: AVLNode<K, V>) {
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

/** Precondition: height(left) and height(right) differ by 2 at most. */
function createAndFix<K, V>(
  key: K,
  value: V,
  left: AVLNode<K, V> | null,
  right: AVLNode<K, V> | null,
): AVLNode<K, V> {
  switch (height(left) - height(right)) {
    case -2:
      return createAndFixRight(key, value, left, right!);
    case 2:
      return createAndFixLeft(key, value, left!, right);
    default:
      break;
  }
  return create(key, value, left, right);
}

export function insert<K, V>(compare: (a: K, b: K) => number) {
  function result(t: AVLNode<K, V> | null, key: K, value: V): AVLNode<K, V> {
    if (t === null) return create(key, value, null, null);
    const comp = compare(t.key, key);
    if (comp === 0) {
      return create(t.key, value, t.left, t.right);
    } else if (comp < 0) {
      return createAndFix(t.key, t.value, result(t.left, key, value), t.right);
    } else {
      return createAndFix(t.key, t.value, t.left, result(t.right, key, value));
    }
  }
  return result;
}

/*
function removeMin<K, V>(t: AVLNode<K, V>): [K, V, AVLNode<K, V> | null] {
  if (t.left === null) {
    return [t.key, t.value, t.right];
  }
  const [key, value, left] = removeMin(t.left);
  return [key, value, createAndFix(t.key, t.value, left, t.right)];
}

function remove<K, V>(t: AVLNode<K, V> | null, key: K): [V, AVLNode<K, V> | null] | null {
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

function removeNth<K, V>(t: AVLNode<K, V> | null, n: number): [K, V, AVLNode<K, V> | null] {
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

function getNth<K, V>(t: AVLNode<K, V> | null, n: number): [K, V] {
  if (t === null) throw new Error('Out of bounds lookup');
  if (n < size(t.left)) return getNth(t.left, n);
  if (n > size(t.left)) return getNth(t.right, n - size(t.left) - 1);
  return [t.key, t.value];
}

function isTreeNode<K, V>(t: null | AVLNode<K, V>, lo?: K, hi?: K): boolean {
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

function accumEntries<K, V>(accum: [K, V][], t: null | AVLNode<K, V>) {
  if (t === null) return;
  accumEntries(accum, t.left);
  accum.push([t.key, t.value]);
  accumEntries(accum, t.right);
}

function every<K, V>(t: null | AVLNode<K, V>, test: (key: K, value: V) => boolean): boolean {
  if (t === null) return true;
  return test(t.key, t.value) && every(t.left, test) && every(t.right, test);
}

*/
