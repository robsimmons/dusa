import { SourceLocation } from '../parsing/source-location.js';

export type Pattern =
  | { type: 'trivial' }
  | { type: 'int'; value: bigint }
  | { type: 'bool'; value: boolean }
  | { type: 'string'; value: string }
  | { type: 'const'; name: string; args: Pattern[] }
  | { type: 'wildcard'; name: null | string }
  | { type: 'var'; name: string };

export type ParsedPattern =
  | { type: 'trivial'; loc: SourceLocation }
  | { type: 'int'; value: bigint; loc: SourceLocation }
  | { type: 'bool'; value: boolean; loc: SourceLocation }
  | { type: 'string'; value: string; loc: SourceLocation }
  | { type: 'const'; name: string; args: ParsedPattern[]; loc: SourceLocation }
  | { type: 'wildcard'; name: null | string; loc: SourceLocation }
  | { type: 'var'; name: string; loc: SourceLocation };

export function termToString(t: Pattern | ParsedPattern, needsParens = true): string {
  switch (t.type) {
    case 'trivial':
      return `()`;
    case 'wildcard':
      return `_`;
    case 'int':
      return `${t.value}`;
    case 'bool':
      return `#${t.value ? 'tt' : 'ff'}`;
    case 'string':
      return `"${t.value}"`;
    case 'const':
      return t.args.length === 0
        ? t.name
        : needsParens
          ? `(${t.name} ${t.args.map((arg) => termToString(arg)).join(' ')})`
          : `${t.name} ${t.args.map((arg) => termToString(arg)).join(' ')}`;
    case 'var':
      return t.name;
  }
}

export function theseVarsGroundThisPattern<T>(
  vars: Set<string> | Map<string, T>,
  t: Pattern,
): boolean {
  switch (t.type) {
    case 'trivial':
    case 'int':
    case 'bool':
    case 'string':
      return true;
    case 'wildcard':
      return false;
    case 'const':
      return t.args.every((arg: Pattern) => theseVarsGroundThisPattern(vars, arg));
    case 'var':
      return vars.has(t.name);
  }
}

function freeVarsAccum(s: Set<string>, p: Pattern | ParsedPattern) {
  switch (p.type) {
    case 'var':
      s.add(p.name);
      return;
    case 'trivial':
    case 'int':
    case 'bool':
    case 'string':
    case 'wildcard':
      return;
    case 'const':
      for (const arg of p.args) {
        freeVarsAccum(s, arg);
      }
      return;
  }
}

export function freeVars(...patterns: (Pattern | ParsedPattern | null)[]): Set<string> {
  const s = new Set<string>();
  for (const pattern of patterns) {
    if (pattern !== null) {
      freeVarsAccum(s, pattern);
    }
  }
  return s;
}
