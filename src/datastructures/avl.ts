export interface AVLNode<K, V> {
  height: number;
  key: K;
  value: V;
  left: null | AVLNode<K, V>;
  right: null | AVLNode<K, V>;
}

export type AVL<K, V> = AVLNode<K, V> | null;

function height<K, V>(t: AVL<K, V>) {
  return t === null ? 0 : t.height;
}

export function lookup<K, V>(t: AVL<K, V>, key: K): V | null {
  while (t !== null) {
    // const comp = compare(t.key, key);
    // if (comp === 0) return t.value;
    if (t.key === key) return t.value;
    // if (comp < 0) {
    if (t.key > key) {
      t = t.left;
    } else {
      t = t.right;
    }
  }
  return null;
}

/** Precondition: height(left) and height(right) differ by at most one */
function create<K, V>(key: K, value: V, left: AVL<K, V>, right: AVL<K, V>): AVLNode<K, V> {
  return {
    height: Math.max(height(left), height(right)) + 1,
    key,
    value,
    left,
    right,
  };
}

export function singleton<K, V>(key: K, value: V): AVLNode<K, V> {
  return create(key, value, null, null);
}

/** Precondition: height(left) === 2 + height(right) */
function createAndFixLeft<K, V>(keyZ: K, valueZ: V, x: AVLNode<K, V>, D: AVL<K, V>) {
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
function createAndFixRight<K, V>(keyX: K, valueX: V, A: AVL<K, V>, z: AVLNode<K, V>) {
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
function createAndFix<K, V>(key: K, value: V, left: AVL<K, V>, right: AVL<K, V>): AVLNode<K, V> {
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

export type Ref<V> = null | { current: V | null };

export function insert<K, V>(t: AVL<K, V>, key: K, value: V, ref: Ref<V>): AVLNode<K, V> {
  if (t === null) {
    return create(key, value, null, null);
  }

  if (t.key === key) {
    if (ref) ref.current = t.value;
    return create(t.key, value, t.left, t.right);
  } else if (t.key > key) {
    const newLeft = insert(t.left, key, value, ref);
    return createAndFix(t.key, t.value, newLeft, t.right);
  } else {
    const newRight = insert(t.right, key, value, ref);
    return createAndFix(t.key, t.value, t.left, newRight);
  }
}

/**
 * Ad-hoc way of cheaply returning a random element that's,
 * y'know, uniform-ish.
 */
export function choose<K, V>(t: AVL<K, V>): [K, V] | null {
  // First, chart a random path from the root to a leaf
  const options: AVLNode<K, V>[] = [];
  while (t !== null) {
    options.push(t);
    t = Math.random() < 0.5 ? t.left : t.right;
  }

  // Then, starting at the leaf, repeatedly flip a coin.
  // Walk back up if its heads, stop if it's tails (or got back to the root).
  if (options.length === 0) return null;
  let i = options.length - 1;
  let r = Math.random();
  while (i > 0 && r < 0.5) {
    r *= 2;
    i--;
  }
  const selected = options[i];
  return [selected.key, selected.value];
}

export function* visit<K, V>(t: AVL<K, V>): IterableIterator<{ key: K; value: V }> {
  const stack: AVLNode<K, V>[] = [];
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

function removeMin<K, V>(t: AVLNode<K, V>): [K, V, AVLNode<K, V> | null] {
  if (t.left === null) {
    return [t.key, t.value, t.right];
  }
  const [key, value, left] = removeMin(t.left);
  return [key, value, createAndFix(t.key, t.value, left, t.right)];
}

export function remove<K, V>(t: AVL<K, V>, key: K, ref: Ref<V>): AVL<K, V> {
  if (t === null) return null;

  if (t.key > key) {
    const newLeft = remove(t.left, key, ref);
    if (newLeft === t.left) return t;
    return createAndFix(t.key, t.value, newLeft, t.right);
  }
  if (t.key < key) {
    const newRight = remove(t.right, key, ref);
    if (newRight === t.right) return t;
    return createAndFix(t.key, t.value, t.left, newRight);
  }
  if (ref) ref.current = t.value;
  if (t.right === null) return t.left;
  const [rootKey, rootValue, newRight] = removeMin(t.right);
  return createAndFix(rootKey, rootValue, t.left, newRight);
}

export function* iterator<K, V>(t: AVL<K, V>): Generator<[K, V]> {
  const stack: AVLNode<K, V>[] = [];
  for (;;) {
    if (t === null) {
      if (stack.length === 0) return;
      t = stack.pop()!;
      yield [t.key, t.value];
      t = t.right;
    } else if (t.left === null) {
      yield [t.key, t.value];
      t = t.right;
    } else {
      stack.push(t);
      t = t.left;
    }
  }
}
