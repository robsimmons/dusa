import { Data, expose, hide } from './data';
import { DataMap } from './datamap';

export class AttributeMap<T> {
  map: DataMap<T>;

  private constructor(map: DataMap<T>) {
    this.map = map;
  }

  static new<T>(): AttributeMap<T> {
    return new AttributeMap(DataMap.new());
  }

  set(name: string, args: Data[], value: T) {
    return new AttributeMap(this.map.set(hide({ type: 'const', name, args }), value));
  }

  get(name: string, args: Data[]) {
    return this.map.get(hide({ type: 'const', name, args }));
  }

  remove(name: string, args: Data[]): [T, AttributeMap<T>] | null {
    const result = this.map.remove(hide({ type: 'const', name, args }));
    if (result === null) return null;
    return [result[0], new AttributeMap(result[1])];
  }

  entries(): [string, Data[], T][] {
    const accum: [string, Data[], T][] = [];
    for (const [data, value] of this.map.entries()) {
      const view = expose(data);
      if (view.type !== 'const') throw new Error('Invariant for AttributeMap');
      accum.push([view.name, view.args, value]);
    }
    return accum;
  }

  get length() {
    return this.map.length;
  }

  every(test: (name: string, args: Data[], value: T) => boolean): boolean {
    return this.map.every((data, value) => {
      const view = expose(data);
      if (view.type !== 'const') throw new Error('Invariant for AttributeMap');
      return test(view.name, view.args, value);
    });
  }

  popFirst(): [string, Data[], T, AttributeMap<T>] {
    const [data, value, map] = this.map.popFirst();
    const view = expose(data);
    if (view.type !== 'const') throw new Error('Invariant for AttributeMap');
    return [view.name, view.args, value, new AttributeMap(map)];
  }

  popRandom(): [string, Data[], T, AttributeMap<T>] {
    const [data, value, map] = this.map.popRandom();
    const view = expose(data);
    if (view.type !== 'const') throw new Error('Invariant for AttributeMap');
    return [view.name, view.args, value, new AttributeMap(map)];
  }
}
