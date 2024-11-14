import { Data, escapeString, HashCons } from './datastructures/data.js';

export type Term =
  | null // Trivial type ()
  | bigint // Natural numbers and integers
  | string // Strings
  | boolean
  | { name: null; value: number } // JSON refs
  | { name: string; args?: [Term, ...Term[]] };
export interface Fact {
  name: string;
  args: Term[];
  value: Term;
}
export type InputTerm =
  | null
  | number
  | boolean
  | bigint
  | string
  | { name: null; value: number }
  | { name: string; args?: InputTerm[] };
export interface InputFact {
  name: string;
  args?: InputTerm[];
  value?: InputTerm;
}

export type JsonData = null | number | bigint | string | JsonData[] | { [field: string]: JsonData };

export function dataToTerm(data: HashCons, t: Data): Term {
  const view = data.expose(t);
  if (view.type === 'trivial') return null;
  if (view.type === 'int') return view.value;
  if (view.type === 'bool') return view.value;
  if (view.type === 'string') return view.value;
  if (view.type === 'ref') return { name: null, value: view.value };
  if (view.args.length === 0) return { name: view.name };
  const args = view.args.map((arg) => dataToTerm(data, arg)) as [Term, ...Term[]];
  return { name: view.name, args };
}

export function termToData(data: HashCons, t: InputTerm): Data {
  if (t === null) return HashCons.TRIVIAL;
  if (typeof t === 'boolean') return data.hide({ type: 'bool', value: t });
  if (typeof t === 'string') return data.hide({ type: 'string', value: t });
  if (typeof t === 'bigint') return data.hide({ type: 'int', value: t });
  if (typeof t === 'object') {
    if (t.name === null) return data.hide({ type: 'ref', value: t.value });
    return data.hide({
      type: 'const',
      name: t.name,
      args: t.args?.map((arg) => termToData(data, arg)) ?? [],
    });
  }
  return data.hide({ type: 'int', value: BigInt(t) });
}

export function termToString(tm: Term, parens = false): string {
  if (tm === null) return '()';
  if (typeof tm === 'boolean') return `bool#${tm}`;
  if (typeof tm === 'string') return `"${escapeString(tm)}"`;
  if (typeof tm === 'bigint') return `${tm}`;
  if (tm.name === null) return `ref#${tm.value}`;
  if (!tm.args) return tm.name;
  const tmStr = `${tm.name} ${tm.args.map((arg) => termToString(arg, true)).join('')}`;
  if (!parens) return tmStr;
  return `(${tmStr})`;
}
