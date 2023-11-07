import { Data } from './data';

interface TreeNode<K, V> {
  height: number;
  key: K;
  value: V;
  left: null | TreeNode<K, V>;
  right: null | TreeNode<K, V>;
}

function height<K, V>(t: TreeNode<K, V> | null) {
  return t === null ? 0 : t.height;
}

function lookup<K, V>(t: TreeNode<K, V> | null, key: K): V | null {
  if (t === null) return null;
  if (t.key === key) return t.value;
  return key < t.key ? lookup(t.left, key) : lookup(t.right, key);
}

function insert<K, V>(t: TreeNode<K, V> | null, key: K, value: V): TreeNode<K, V> {
  if (t === null) return { height: 1, key, value, left: null, right: null };
  if (key < t.key) {
    const tL = insert(t.left, key, value);
    if (tL.height === height(t.right) + 2) {
      const newHeight = tL.height;
      if (height(tL.left) === height(tL.right))
        throw new Error('Failed invariant in tree insertion');
      if (height(tL.left) > height(tL.right))
        return { ...tL, right: { ...t, height: newHeight - 1, left: tL.right } };
      const small = tL;
      const medium = tL.right!;
      const large = t;

      return {
        ...medium,
        height: newHeight,
        left: { ...small, height: newHeight - 1, left: tL.left, right: tL.right!.left },
        right: { ...large, height: newHeight - 1, left: tL.right!.right, right: t.right },
      };
    }
    return { ...t, height: 1 + Math.max(tL.height, height(t.right)), left: tL, right: t.right };
  }

  if (key > t.key) {
    const tR = insert(t.right, key, value);
    if (height(t.left) + 2 == tR.height) {
      const newHeight = tR.height;
      if (height(tR.left) == height(tR.right))
        throw new Error('Failed invariant in tree insertion');
      if (height(tR.left) < height(tR.right))
        return { ...tR, left: { ...t, height: newHeight - 1, right: tR.left } };
      const small = t;
      const medium = tR.left!;
      const large = tR;

      return {
        ...medium,
        height: newHeight,
        left: { ...small, height: newHeight - 1, left: t.left, right: tR.left!.left },
        right: { ...large, height: newHeight - 1, left: tR.left!.right, right: tR.right },
      };
    }
    return { ...t, height: 1 + Math.max(height(t.left), tR.height), left: t.left, right: tR };
  }

  return { ...t, value };
}

function isTreeNode<K, V>(t: null | TreeNode<K, V>, lo?: K, hi?: K): boolean {
  if (t === null) return true;
  return (
    (lo == null || lo < t.key) &&
    (hi == null || hi > t.key) &&
    t.height === 1 + Math.max(height(t.left), height(t.right)) &&
    isTreeNode(t.left, lo, t.key) &&
    isTreeNode(t.right, t.key, hi)
  );
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

  isOk() {
    if (!(isTreeNode(this.indexTree) && isTreeNode(this.bigintTree))) {
      console.log(this.indexTree);
      console.log(this.bigintTree);
      return false;
    }
    return true;
  }
}
