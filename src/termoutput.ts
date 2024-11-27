import { Data, escapeString, HashCons } from './datastructures/data.js';

export type Term =
  | null // Trivial type ()
  | number // Natural numbers and integers
  | string // Strings
  | boolean
  | { name: null; value: number } // JSON refs
  | { name: string; args?: [Term, ...Term[]] };
export interface Fact {
  name: string;
  args: Term[];
  value: Term;
}
export type BigTerm =
  | null // Trivial type ()
  | bigint // Natural numbers and integers
  | string // Strings
  | boolean
  | { name: null; value: number } // JSON refs
  | { name: string; args?: [BigTerm, ...BigTerm[]] };
export interface BigFact {
  name: string;
  args: BigTerm[];
  value: BigTerm;
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

export function dataToTerm(data: HashCons, t: Data): Term {
  const view = data.expose(t);
  if (view.type === 'trivial') return null;
  if (view.type === 'int') return Number(view.value);
  if (view.type === 'bool') return view.value;
  if (view.type === 'string') return view.value;
  if (view.type === 'ref') return { name: null, value: view.value };
  if (view.args.length === 0) return { name: view.name };
  const args = view.args.map((arg) => dataToTerm(data, arg)) as [Term, ...Term[]];
  return { name: view.name, args };
}
export function dataToBigTerm(data: HashCons, t: Data): BigTerm {
  const view = data.expose(t);
  if (view.type === 'trivial') return null;
  if (view.type === 'int') return view.value;
  if (view.type === 'bool') return view.value;
  if (view.type === 'string') return view.value;
  if (view.type === 'ref') return { name: null, value: view.value };
  if (view.args.length === 0) return { name: view.name };
  const args = view.args.map((arg) => dataToBigTerm(data, arg)) as [BigTerm, ...BigTerm[]];
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

export function termToString(tm: BigTerm | Term, parens = false): string {
  if (tm === null) return '()';
  if (typeof tm === 'boolean') return `bool#${tm}`;
  if (typeof tm === 'string') return `"${escapeString(tm)}"`;
  if (typeof tm === 'bigint' || typeof tm === 'number') return `${tm}`;
  if (tm.name === null) return `ref#${tm.value}`;
  if (!tm.args) return tm.name;
  const tmStr = `${tm.name} ${tm.args.map((arg) => termToString(arg, true)).join('')}`;
  if (!parens) return tmStr;
  return `(${tmStr})`;
}

export function compareTerms(t: (Term | BigTerm)[], s: (Term | BigTerm)[]): number {
  for (let i = 0; i < Math.min(t.length, s.length); i++) {
    const c = compareTerm(t[i], s[i]);
    if (c !== 0) return c;
  }
  return s.length - t.length;
}

export function compareTerm(t1: Term | BigTerm, t2: Term | BigTerm): number {
  if (t1 === null) return t2 === null ? 0 : -1;
  if (t2 === null) return 1;
  if (typeof t1 === 'boolean') {
    return typeof t2 === 'boolean' ? (t1 ? 1 : 0) - (t2 ? 1 : 0) : -1;
  }
  if (typeof t2 === 'boolean') return 1;

  if (typeof t1 === 'string') {
    return typeof t2 === 'string' ? new Intl.Collator('en').compare(t1, t2) : -1;
  }
  if (typeof t2 === 'string') return 1;

  if (typeof t1 === 'bigint' || typeof t1 === 'number') {
    return typeof t2 === 'bigint' || typeof t2 === 'number' ? Number(t1) - Number(t2) : -1;
  }
  if (typeof t2 === 'bigint' || typeof t2 === 'number') return 1;

  if (t1.name !== null) {
    if (t2.name === null) return -1;
    const c = new Intl.Collator('en').compare(t1.name, t2.name);
    if (c !== 0) return c;
    return compareTerms(t1.args ?? [], t2.args ?? []);
  }
  if (t2.name !== null) return 1;
  return t1.value - t2.value;
}
