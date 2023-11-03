import { SourceLocation } from './parsing/source-location';
import { SPECIAL_DEFAULTS } from './dinnik-special';

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

export type Data =
  | { type: 'triv' }
  | { type: 'int'; value: number }
  | { type: 'nat'; value: number }
  | { type: 'string'; value: string }
  | { type: 'const'; name: string; args: Data[] };

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

export type Substitution = { [varName: string]: Data };

export function match(
  substitution: Substitution,
  pattern: Pattern,
  data: Data,
): null | Substitution {
  switch (pattern.type) {
    case 'triv':
      if (pattern.type !== data.type) return null;
      return substitution;
    case 'int':
    case 'nat':
      if (data.type !== 'int' && data.type !== 'nat') return null;
      if (pattern.value !== data.value) return null;
      return substitution;
    case 'string':
      if (pattern.type !== data.type) return null;
      if (pattern.value !== data.value) return null;
      return substitution;
    case 'special':
      if (pattern.name === 'NAT_ZERO' && pattern.args.length === 0) {
        if (data.type !== 'nat' && data.type !== 'int') {
          throw new Error(`Type error: matching NAT_ZERO against a ${data.type}`);
        }

        return data.value === 0 ? substitution : null;
      }

      if (pattern.name === 'NAT_SUCC' && pattern.args.length === 1) {
        if (data.type !== 'nat' && data.type !== 'int') {
          throw new Error(`Type error: matching NAT_SUCC against a ${data.type}`);
        }
        return data.value > 0
          ? match(substitution, pattern.args[0], { type: 'nat', value: data.value - 1 })
          : null;
      }

      if (pattern.name === 'INT_PLUS') {
        if (data.type !== 'int' && data.type !== 'nat') {
          throw new Error(`Type error: matching INT_PLUS against a ${data.type}`);
        }
        const increment = pattern.args
          .map((arg, i) => {
            if (i === pattern.nonground) return 0;
            const value = apply(substitution, arg);
            if (value.type !== 'int' && value.type !== 'nat') {
              throw new Error(`Type error: argument #${i} to INT_PLUS is ${value.type}, not int.`);
            }
            return value.value;
          })
          .reduce((x, y) => x + y, 0);

        if (pattern.nonground === undefined) {
          return increment === data.value ? substitution : null;
        }
        return match(substitution, pattern.args[pattern.nonground], {
          type: 'int',
          value: data.value - increment,
        });
      }

      if (pattern.name === 'STRING_CONCAT') {
        if (data.type !== 'string') {
          throw new Error(`Type error: matching STRING_CONCAT against a ${data.type}`);
        }

        const strings = pattern.args.map((arg, i) => {
          if (i === pattern.nonground) return '';
          const value = apply(substitution, arg);
          if (value.type !== 'string') {
            throw new Error(
              `Type error: argument #${i} to STRING_CONCAT is ${value.type}, not string.`,
            );
          }
          return value.value;
        });

        if (pattern.nonground === undefined) {
          return strings.join('') === data.value ? substitution : null;
        }
        const prefix = strings.slice(0, pattern.nonground).join('');
        if (data.value.length < prefix.length || prefix !== data.value.slice(0, prefix.length)) {
          return null;
        }

        const prefixRemoved = data.value.slice(prefix.length);
        const postfix = strings.slice(pattern.nonground + 1).join('');
        if (
          prefixRemoved.length < postfix.length ||
          postfix !== prefixRemoved.slice(prefixRemoved.length - postfix.length)
        ) {
          return null;
        }

        return match(substitution, pattern.args[pattern.nonground], {
          type: 'string',
          value: prefixRemoved.slice(0, prefixRemoved.length - postfix.length),
        });
      }

      throw new Error(
        `Type error: cannot support ${pattern.name} with ${pattern.args.length} argument${
          pattern.args.length === 1 ? '' : 's'
        }`,
      );

    case 'const':
      if (
        data.type !== 'const' ||
        pattern.name !== data.name ||
        pattern.args.length !== data.args.length
      )
        return null;
      for (let i = 0; i < pattern.args.length; i++) {
        const candidate = match(substitution, pattern.args[i], data.args[i]);
        if (candidate === null) return null;
        substitution = candidate;
      }
      return substitution;

    case 'wildcard':
      return substitution;

    case 'var':
      if (substitution[pattern.name]) {
        return equal(substitution[pattern.name], data) ? substitution : null;
      }
      return { [pattern.name]: data, ...substitution };
  }
}

export function apply(substitution: Substitution, pattern: Pattern): Data {
  switch (pattern.type) {
    case 'triv':
    case 'int':
    case 'nat':
    case 'string': {
      return pattern;
    }

    case 'special': {
      if (pattern.name === 'NAT_ZERO' && pattern.args.length === 0) {
        return { type: 'nat', value: 0 };
      }

      if (pattern.name === 'NAT_SUCC' && pattern.args.length === 1) {
        const arg = apply(substitution, pattern.args[0]);
        if (arg.type === 'nat') {
          return { type: 'nat', value: arg.value + 1 };
        } else {
          throw new Error(`Type error: argument to NAT_SUCC is an ${arg.type}, not a nat.`);
        }
      }

      if (pattern.name === 'INT_PLUS') {
        const args = pattern.args.map((arg, i) => {
          const value = apply(substitution, arg);
          if (value.type !== 'int' && value.type !== 'nat') {
            throw new Error(`Type error: argument #${i} to INT_PLUS is ${value.type}, not int.`);
          }
          return value.value;
        });
        return {
          type: 'int',
          value: args.reduce((x, y) => x + y, 0),
        };
      }

      if (pattern.name === 'STRING_CONCAT') {
        const args = pattern.args.map((arg, i) => {
          const value = apply(substitution, arg);
          if (value.type !== 'string') {
            throw new Error(
              `Type error: argument #${i} to STRING_CONCAT is ${value.type}, not string.`,
            );
          }
          return value.value;
        });
        return { type: 'string', value: args.join('') };
      }

      throw new Error(
        `Type error: cannot support ${pattern.name} with ${pattern.args.length} argument${
          pattern.args.length === 1 ? '' : 's'
        }`,
      );
    }

    case 'const': {
      return {
        type: 'const',
        name: pattern.name,
        args: pattern.args.map((arg) => apply(substitution, arg)),
      };
    }

    case 'wildcard': {
      throw new Error(`Cannot match apply a substitution to a pattern containing the wildcard '_'`);
    }

    case 'var': {
      const result = substitution[pattern.name];
      if (!result) {
        throw new Error(
          `Free variable '${pattern.name}' not assigned to in grounding substitution`,
        );
      }
      return result;
    }
  }
}

export function equal(t: Data, s: Data): boolean {
  switch (t.type) {
    case 'triv':
      return t.type === s.type;
    case 'int':
    case 'nat':
      return (s.type === 'int' || s.type === 'nat') && t.value === s.value;
    case 'string':
      return t.type === s.type && t.value === s.value;
    case 'const':
      return (
        t.type === s.type &&
        t.name === s.name &&
        t.args.length === s.args.length &&
        t.args.every((arg, i) => equal(arg, s.args[i]))
      );
  }
}

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
    case 'special':
      return t.args.length === 0
        ? t.name
        : needsParens
        ? `(${t.name} ${t.args.map((arg) => termToString(arg)).join(' ')})`
        : `${t.name} ${t.args.map((arg) => termToString(arg)).join(' ')}`;
    case 'var':
      return t.name;
  }
}

export function assertData(p: Pattern): Data {
  return apply({}, p);
}

export function parseTerm(s: string): { data: Pattern; rest: string } | null {
  if (s[0] === '"') {
    const end = s.slice(1).indexOf('"');
    if (end === -1) {
      throw new Error('Unmatched quote');
    }
    return {
      data: { type: 'string', value: s.slice(1, end + 1) },
      rest: s.slice(end + 2).trimStart(),
    };
  }

  if (s[0] === '(') {
    if (s[1] === ')') {
      return { data: { type: 'triv' }, rest: s.slice(2).trimStart() };
    }
    const next = parseTerm(s.slice(1));
    if (next === null) {
      throw new Error('No term following an open parenthesis');
    }
    if (next.rest[0] !== ')') {
      throw new Error('Did not find expected matching parenthesis');
    }
    return { data: next.data, rest: next.rest.slice(1).trimStart() };
  }

  const constMatch = s.match(/^-?[0-9a-zA-Z]+/);
  if (constMatch) {
    if (constMatch[0].match(/^[A-Z]/)) {
      return {
        data: { type: 'var', name: constMatch[0] },
        rest: s.slice(constMatch[0].length).trimStart(),
      };
    }
    if (constMatch[0].match(/^-?[0-9]/)) {
      if (`${parseInt(constMatch[0])}` !== constMatch[0]) {
        throw new Error(`Bad number: '${constMatch[0]}'`);
      }
      const value = parseInt(constMatch[0]);
      return {
        data: { type: value < 0 ? 'int' : 'nat', value },
        rest: s.slice(constMatch[0].length).trimStart(),
      };
    }
    let rest = s.slice(constMatch[0].length).trimStart();
    const args = [];
    let next = parseTerm(rest);
    while (next !== null) {
      args.push(next.data);
      rest = next.rest;
      next = parseTerm(next.rest);
    }
    return { data: { type: 'const', name: constMatch[0], args }, rest };
  }

  return null;
}

export function parsePattern(s: string): Pattern {
  const result = parseTerm(s);
  if (result === null) {
    throw new Error(`Could not parse '${s}' as a pattern`);
  }
  if (result.rest !== '') {
    throw new Error(`Unexpected parsing '${s}' as a pattern: '${result.rest[0]}'`);
  }
  return result.data;
}

export function parseData(s: string): Data {
  return assertData(parsePattern(s));
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
