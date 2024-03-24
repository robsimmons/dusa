import { Data, TRIV_DATA, expose, hide } from "./datastructures/data.js";

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
  args: InputTerm[];
  value?: InputTerm;
}


export type JsonData = null | number | bigint | string | JsonData[] | { [field: string]: JsonData };

export function dataToTerm(d: Data): Term {
  const view = expose(d);
  if (view.type === 'triv') return null;
  if (view.type === 'int') return view.value;
  if (view.type === 'bool') return view.value;
  if (view.type === 'string') return view.value;
  if (view.type === 'ref') return { name: null, value: view.value };
  if (view.args.length === 0) return { name: view.name };
  const args = view.args.map(dataToTerm) as [Term, ...Term[]];
  return { name: view.name, args };
}

export function termToData(tm: InputTerm): Data {
  if (tm === null) return TRIV_DATA;
  if (typeof tm === 'boolean') return hide({ type: 'bool', value: tm });
  if (typeof tm === 'string') return hide({ type: 'string', value: tm });
  if (typeof tm === 'bigint') return hide({ type: 'int', value: tm });
  if (typeof tm === 'object') {
    if (tm.name === null) return hide({ type: 'ref', value: tm.value });
    return hide({ type: 'const', name: tm.name, args: tm.args?.map(termToData) ?? [] });
  }
  return hide({ type: 'int', value: BigInt(tm) });
}
