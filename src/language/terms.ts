import { SourceLocation } from '../parsing/source-location.js';
import { SPECIAL_DEFAULTS } from './dusa-builtins.js';

export type Pattern =
  | { type: 'triv' }
  | { type: 'int'; value: number }
  | { type: 'nat'; value: number }
  | { type: 'string'; value: string }
  | { type: 'const'; name: string; args: Pattern[] }
  | {
      type: 'special';
      name: keyof typeof SPECIAL_DEFAULTS;
      symbol: string;
      args: Pattern[];
      nonground?: number;
    }
  | { type: 'wildcard'; name: null | string }
  | { type: 'var'; name: string };

export type ParsedPattern =
  | { type: 'triv'; loc: SourceLocation }
  | { type: 'int'; value: number; loc: SourceLocation }
  | { type: 'nat'; value: number; loc: SourceLocation }
  | { type: 'string'; value: string; loc: SourceLocation }
  | { type: 'const'; name: string; args: ParsedPattern[]; loc: SourceLocation }
  | {
      type: 'special';
      name: keyof typeof SPECIAL_DEFAULTS;
      symbol: string;
      args: ParsedPattern[];
      loc: SourceLocation;
    }
  | { type: 'wildcard'; name: null | string; loc: SourceLocation }
  | { type: 'var'; name: string; loc: SourceLocation };

export function termToString(t: Pattern, needsParens = true): string {
  switch (t.type) {
    case 'triv':
      return `()`;
    case 'wildcard':
      return `_`;
    case 'int':
    case 'nat':
      return `${t.value}`;
    case 'string':
      return `"${t.value}"`;
    case 'const':
    case 'special': {
      const name = t.type === 'const' ? t.name : `${t.symbol}<${t.name}>`;
      return t.args.length === 0
        ? name
        : needsParens
          ? `(${name} ${t.args.map((arg) => termToString(arg)).join(' ')})`
          : `${name} ${t.args.map((arg) => termToString(arg)).join(' ')}`;
    }
    case 'var':
      return t.name;
  }
}

function repeatedWildcardsAccum(
  wildcards: Set<string>,
  repeatedWildcards: Map<string, SourceLocation>,
  p: ParsedPattern,
) {
  switch (p.type) {
    case 'wildcard':
      if (p.name !== null && wildcards.has(p.name)) {
        repeatedWildcards.set(p.name, p.loc);
      }
      wildcards.add(p.name ?? '_');
      return;
    case 'int':
    case 'string':
    case 'triv':
    case 'var':
      return;
    case 'const':
    case 'special':
      for (const arg of p.args) {
        repeatedWildcardsAccum(wildcards, repeatedWildcards, arg);
      }
      return;
  }
}

export function repeatedWildcards(
  knownWildcards: Set<string>,
  ...patterns: ParsedPattern[]
): [string, SourceLocation][] {
  const repeatedWildcards = new Map<string, SourceLocation>();
  for (const pattern of patterns) {
    repeatedWildcardsAccum(knownWildcards, repeatedWildcards, pattern);
  }
  return [...repeatedWildcards.entries()];
}

function freeVarsAccum(s: Set<string>, p: Pattern) {
  switch (p.type) {
    case 'var':
      s.add(p.name);
      return;
    case 'int':
    case 'string':
    case 'triv':
    case 'wildcard':
      return;
    case 'const':
    case 'special':
      for (const arg of p.args) {
        freeVarsAccum(s, arg);
      }
      return;
  }
}

export function freeVars(...patterns: Pattern[]): Set<string> {
  const s = new Set<string>();
  for (const pattern of patterns) {
    freeVarsAccum(s, pattern);
  }
  return s;
}

function freeParsedVarsAccum(s: Map<string, SourceLocation>, p: ParsedPattern) {
  switch (p.type) {
    case 'var':
      s.set(p.name, p.loc);
      return;
    case 'int':
    case 'string':
    case 'triv':
    case 'wildcard':
      return;
    case 'const':
    case 'special':
      for (const arg of p.args) {
        freeParsedVarsAccum(s, arg);
      }
      return;
  }
}

export function freeParsedVars(...patterns: ParsedPattern[]): Map<string, SourceLocation> {
  const s = new Map<string, SourceLocation>();
  for (const pattern of patterns) {
    freeParsedVarsAccum(s, pattern);
  }
  return s;
}
