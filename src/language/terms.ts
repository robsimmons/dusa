import { SourceLocation } from '../parsing/source-location.js';

export type Pattern =
  | { type: 'trivial' }
  | { type: 'int'; value: number }
  | { type: 'bool'; value: boolean }
  | { type: 'string'; value: string }
  | { type: 'const'; name: string; args: Pattern[] }
  | { type: 'wildcard'; name: null | string }
  | { type: 'var'; name: string };

export type ParsedPattern =
  | { type: 'trivial'; loc: SourceLocation }
  | { type: 'int'; value: number; loc: SourceLocation }
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
  t: ParsedPattern,
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
      return t.args.every((arg: ParsedPattern) => theseVarsGroundThisPattern(vars, arg));
    case 'var':
      return vars.has(t.name);
  }
}
