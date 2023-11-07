export type Data = ViewsIndex | bigint;

export type DataView =
  | { type: 'triv' }
  | { type: 'int'; value: bigint }
  | { type: 'string'; value: string }
  | { type: 'const'; name: string; args: Data[] };

type ViewsIndex = number;
const views: DataView[] = [{ type: 'triv' }];

export function expose(d: Data): DataView {
  if (typeof d === 'bigint') return { type: 'int', value: d };
  if (d < 0 || d >= views.length) throw new Error(`Internalized value ${d} invalid`);
  return views[d];
}

const strings: { [s: string]: number } = {};

type DataTrie = {
  value?: ViewsIndex;
  indexChildren: { [value: ViewsIndex]: DataTrie };
  bigintChildren: { [value: string]: DataTrie };
};
const structures: { [name: string]: DataTrie } = {};

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
