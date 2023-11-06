interface Node<T> {
  exp: number;
  elem: T;
  prio: number;
  firstChild: Node<T> | null;
  nextChild: Node<T> | null;
}

function join<T>(n1: Node<T>, n2: Node<T>): Node<T> {
  if (n1.exp !== n2.exp) {
    throw new Error(`Merging heaps of sizes ${n1.exp} and ${n2.exp}`);
  }
  if (n1.prio < n2.prio) {
    const temp = n2;
    n2 = n1;
    n1 = temp;
  }
  // n1 has the higher priority
  return {
    exp: n1.exp + 1,
    elem: n1.elem,
    prio: n1.prio,
    firstChild: {
      exp: n2.exp,
      elem: n2.elem,
      prio: n2.prio,
      nextChild: n1.firstChild,
      firstChild: n2.firstChild,
    },
    nextChild: null,
  };
}

function merge<T>(h1: (null | Node<T>)[], h2: (null | Node<T>)[]): (null | Node<T>)[] {
  const len = Math.max(h1.length, h2.length);
  const result: (null | Node<T>)[] = [];
  let carry = null;
  for (let i = 0; i < len; i++) {
    const b1 = h1[i];
    const b2 = h2[i];
    if (!b1 && !b2) {
      result.push(carry); // ?00
      carry = null;
    } else if (!carry && !b1) {
      result.push(b2); // 001
      carry = null;
    } else if (!carry && !b2) {
      result.push(b1); // 010
      carry = null;
    } else if (b1 && b2) {
      result.push(carry); // ?11
      carry = join(b1, b2);
    } else if (carry && b1) {
      result.push(null); // 110
      carry = join(carry, b1);
    } else if (carry && b2) {
      result.push(null); // 101
      carry = join(carry, b2);
    }
  }
  if (carry) {
    result.push(carry);
  }
  return result;
}

function remove<T>(heaps: (null | Node<T>)[]): [T, (null | Node<T>)[]] {
  let best: null | { prio: number; index: number } = null;
  for (let i = 0; i < heaps.length; i++) {
    if (heaps[i] !== null) {
      if (best === null || heaps[i]!.prio > best.prio) {
        best = { prio: heaps[i]!.prio, index: i };
      }
    }
  }

  if (best === null) throw new Error('Removing from an empty priority queue');
  const removed = heaps[best.index]!;
  const result = removed.elem;

  const heaps1 = heaps.map((h, i) => (i === best!.index ? null : h));
  while (heaps1.length > 0 && heaps1[heaps1.length - 1] === null) {
    heaps1.pop();
  }
  const heaps2 = new Array(removed.exp);
  for (
    let removedChild = removed.firstChild;
    removedChild !== null;
    removedChild = removedChild!.nextChild
  ) {
    heaps2[removedChild.exp] = removedChild;
  }

  return [result, merge(heaps1, heaps2)];
}

function debugToString<T>(heaps: (null | Node<T>)[]) {
  return heaps.map((heap, i) => (heap === null ? '*' : debugHeapToString(heap, i)));
}

function debugHeapToString<T>(heap: Node<T>, exp: number): string {
  if (exp !== heap.exp) {
    throw new Error(`Expected heap exponent ${exp}, got heap exponent ${heap.exp}`);
  }
  if (heap.firstChild === null) {
    if (exp !== 0) {
      throw new Error(`No child for heap with exponent ${exp}`);
    }
    return `${heap.elem}`;
  }
  if (exp === 0) {
    throw new Error(`Expected heap exponent ${exp}, got heap exponent ${heap.exp}`);
  }
  const neighbors = [];
  for (let child: Node<T> | null = heap.firstChild; child !== null; child = child.nextChild) {
    exp -= 1;
    neighbors.push(debugHeapToString(child, exp));
  }
  if (exp !== 0) throw new Error(`${exp} too few children`);
  return `${heap.elem}[${neighbors.join(',')}]`;
}

export default class PQ<T> {
  private size: number;
  private heaps: (null | Node<T>)[];
  private constructor(size: number, heaps: (null | Node<T>)[]) {
    this.size = size;
    this.heaps = heaps;
  }

  static new<T>(): PQ<T> {
    return new PQ<T>(0, []);
  }

  get length() {
    return this.size;
  }

  push(prio: number, elem: T): PQ<T> {
    return new PQ(
      this.size + 1,
      merge(this.heaps, [{ exp: 0, elem, prio, firstChild: null, nextChild: null }]),
    );
  }

  pop(): [T, PQ<T>] {
    const [result, heaps] = remove(this.heaps);
    return [result, new PQ(this.size - 1, heaps)];
  }

  debugToString(): string {
    return debugToString(this.heaps).join(',');
  }

  toList(): T[] {
    const result: T[] = [];
    let heaps: (null | Node<T>)[] = this.heaps;
    let elem: T;
    for (let i = 0; i < this.size; i++) {
      [elem, heaps] = remove(heaps);
      result.push(elem);
    }
    return result;
  }
}
