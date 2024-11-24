export type List<T> = null | { data: T; next: List<T> };

export function cons<T>(list: List<T>, data: T): List<T> {
  return { data, next: list };
}

export function uncons<T>(list: { data: T; next: List<T> }): [List<T>, T] {
  return [list.next, list.data];
}
