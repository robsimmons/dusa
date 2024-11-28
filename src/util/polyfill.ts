/**
 * Set.prototype.isSubsetOf and Set.prototype.isSupersetOf are newly available
 * in 2024 and aren't included in ES2022 lib.
 *
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/isSubsetOf
 */
export function subsetEq<T>(a: Set<T>, b: Set<T>) {
  for (const x of a) {
    if (!b.has(x)) return false;
  }
  return true;
}

/**
 * Set.prototype.union is newly available in 2024 and isn't included in
 * ES2022 lib.
 *
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/union
 */
export function setUnion<T>(a: Set<T>, b: Set<T>) {
  const result = new Set<T>();
  for (const x of a) {
    result.add(x);
  }
  for (const x of b) {
    result.add(x);
  }
  return result;
}

/**
 * Set.prototype.difference is newly available in 2024 and isn't included in
 * ES2022 lib.
 *
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/difference
 */
export function setDifference<T>(a: Set<T>, b: Set<T>) {
  const result = new Set<T>();
  for (const x of a) {
    if (!b.has(x)) {
      result.add(x);
    }
  }
  return result;
}

/**
 * Set.prototype.intersection is newly available in 2024 and isn't included in
 * ES2022 lib.
 *
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/intersection
 */
export function setIntersection<T>(a: Set<T>, b: Set<T>) {
  const result = new Set<T>();
  for (const x of a) {
    if (b.has(x)) {
      result.add(x);
    }
  }
  return result;
}

/**
 * Iterator.prototype.map is still not widely available in 2024 (no Safari
 * support, just a couple of months of Firefox support) and isn't included in
 * ES2022 lib.
 *
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/map
 */
export function* generatorMap<T, S>(gen: Generator<T>, map: (x: T) => S): Generator<S> {
  for (const x of gen) {
    yield map(x);
  }
}
