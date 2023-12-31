export type Data = ViewsIndex | bigint;

export type DataView =
  | { type: 'triv' }
  | { type: 'int'; value: bigint }
  | { type: 'bool'; value: boolean }
  | { type: 'string'; value: string }
  | { type: 'const'; name: string; args: Data[] }
  | { type: 'ref'; value: number };

type ViewsIndex = number;
let nextRef: number = -1;
let views: DataView[] = [
  { type: 'triv' },
  { type: 'bool', value: true },
  { type: 'bool', value: false },
];
let strings: { [s: string]: number } = {};
let structures: { [name: string]: DataTrie } = {};

export function DANGER_RESET_DATA() {
  nextRef = -1;
  views = [{ type: 'triv' }, { type: 'bool', value: true }, { type: 'bool', value: false }];
  strings = {};
  structures = {};
}

export const TRIV_DATA = 0;
export const BOOL_TRUE = 1;
export const BOOL_FALSE = 2;

export function expose(d: Data): DataView {
  if (typeof d === 'bigint') return { type: 'int', value: d };
  if (d <= nextRef) throw new Error(`Internalized ref ${-d} too small.`);
  if (d < 0) return { type: 'ref', value: -d };
  if (d >= views.length) throw new Error(`Internalized value ${d} invalid`);
  return views[d];
}

type DataTrie = {
  value?: ViewsIndex;
  indexChildren: { [value: ViewsIndex]: DataTrie };
  bigintChildren: { [value: string]: DataTrie };
};

function getStructureIndex(name: string, args: Data[]): ViewsIndex | null {
  let structure: DataTrie | undefined = structures[name];
  for (const arg of args) {
    if (structure === undefined) return null;
    if (typeof arg === 'bigint') structure = structure.bigintChildren[`${arg}`];
    else structure = structure.indexChildren[arg];
  }
  if (structure?.value === undefined) return null;
  return structure.value;
}

function setStructureIndex(name: string, args: Data[], value: ViewsIndex) {
  if (!structures[name]) {
    structures[name] = { bigintChildren: {}, indexChildren: {} };
  }
  let structure = structures[name];
  for (const arg of args) {
    if (typeof arg === 'bigint') {
      const index = `${arg}`;
      if (!structure.bigintChildren[index]) {
        structure.bigintChildren[index] = { bigintChildren: {}, indexChildren: {} };
      }
      structure = structure.bigintChildren[index];
    } else {
      if (!structure.indexChildren[arg]) {
        structure.indexChildren[arg] = { bigintChildren: {}, indexChildren: {} };
      }
      structure = structure.indexChildren[arg];
    }
  }
  if (structure.value !== undefined) throw new Error(`Invariant, setting an existing structure`);
  structure.value = value;
}

export function hide(d: DataView): Data {
  switch (d.type) {
    case 'triv':
      return 0;
    case 'int':
      return d.value;
    case 'bool':
      return d.value ? 1 : 2;
    case 'ref':
      if (-d.value <= nextRef || d.value >= 0) {
        throw new Error(`Ref value is invalid`);
      }
      return -d.value;
    case 'string': {
      const candidate = strings[d.value];
      if (candidate) return candidate;
      const result = views.length;
      views.push({ type: 'string', value: d.value });
      strings[d.value] = result;
      return result;
    }
    case 'const': {
      const candidate = getStructureIndex(d.name, d.args);
      if (candidate !== null) return candidate;
      const result = views.length;
      views.push({ type: 'const', name: d.name, args: d.args });
      setStructureIndex(d.name, d.args, result);
      return result;
    }
  }
}

export function dataToString(d: Data, needsParens = true): string {
  const view = expose(d);
  switch (view.type) {
    case 'triv':
      return `()`;
    case 'int':
      return `${view.value}`;
    case 'bool':
      return `#${view.value ? 'tt' : 'ff'}`;
    case 'ref':
      return `#${view.value}`;
    case 'string':
      return `"${view.value}"`;
    case 'const':
      return view.args.length === 0
        ? view.name
        : needsParens
          ? `(${view.name} ${view.args.map((arg) => dataToString(arg)).join(' ')})`
          : `${view.name} ${view.args.map((arg) => dataToString(arg)).join(' ')}`;
  }
}

export function getRef(): Data {
  return nextRef--;
}
