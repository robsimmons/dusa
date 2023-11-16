import { SourceLocation } from './parsing/source-location';
import { SPECIAL_DEFAULTS } from './dusa-builtins';
import { Data, expose, hide } from './data';

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

export type Substitution = { [varName: string]: Data };

export function match(
  substitution: Substitution,
  pattern: Pattern,
  data: Data,
): null | Substitution {
  const dv = expose(data);
  switch (pattern.type) {
    case 'triv':
      if (pattern.type !== dv.type) return null;
      return substitution;
    case 'int':
    case 'nat':
      if (dv.type !== 'int') return null;
      if (BigInt(pattern.value) !== dv.value) return null;
      return substitution;
    case 'string':
      if (pattern.type !== dv.type) return null;
      if (pattern.value !== dv.value) return null;
      return substitution;
    case 'special':
      if (pattern.name === 'NAT_ZERO' && pattern.args.length === 0) {
        if (dv.type !== 'int') {
          throw new Error(`Type error: matching NAT_ZERO against a ${dv.type}`);
        }

        return dv.value === 0n ? substitution : null;
      }

      if (pattern.name === 'NAT_SUCC' && pattern.args.length === 1) {
        if (dv.type !== 'int') {
          throw new Error(`Type error: matching NAT_SUCC against a ${dv.type}`);
        }
        return dv.value > 0n
          ? match(substitution, pattern.args[0], hide({ type: 'int', value: dv.value - 1n }))
          : null;
      }

      if (pattern.name === 'INT_PLUS') {
        if (dv.type !== 'int') {
          throw new Error(`Type error: matching INT_PLUS against a ${dv.type}`);
        }
        const increment = pattern.args
          .map((arg, i) => {
            if (i === pattern.nonground) return 0n;
            const value = expose(apply(substitution, arg));
            if (value.type !== 'int') {
              throw new Error(`Type error: argument #${i} to INT_PLUS is ${dv.type}, not int.`);
            }
            return value.value;
          })
          .reduce((x, y) => x + y, 0n);

        if (pattern.nonground === undefined) {
          return increment === dv.value ? substitution : null;
        }
        return match(
          substitution,
          pattern.args[pattern.nonground],
          hide({ type: 'int', value: dv.value - increment }),
        );
      }

      if (pattern.name === 'INT_MINUS' && pattern.args.length === 2) {
        if (dv.type !== 'int') {
          throw new Error(`Type error: matching INT_MINUS against a ${dv.type}`);
        }
        if (pattern.nonground === undefined) {
          const [x, y] = pattern.args.map((arg, i) => {
            const value = expose(apply(substitution, arg));
            if (value.type !== 'int') {
              throw new Error(`Type error: argument #${i} to INT_MINUS is ${dv.type}, not int.`);
            }
            return value.value;
          });
          return x - y === dv.value ? substitution : null;
        }
        throw new Error('Non ground matching against INT_MINUS not implemented');
      }

      if (pattern.name === 'STRING_CONCAT') {
        if (dv.type !== 'string') {
          throw new Error(`Type error: matching STRING_CONCAT against a ${dv.type}`);
        }

        const strings = pattern.args.map((arg, i) => {
          if (i === pattern.nonground) return '';
          const value = expose(apply(substitution, arg));
          if (value.type !== 'string') {
            throw new Error(
              `Type error: argument #${i} to STRING_CONCAT is ${value.type}, not string.`,
            );
          }
          return value.value;
        });

        if (pattern.nonground === undefined) {
          return strings.join('') === dv.value ? substitution : null;
        }
        const prefix = strings.slice(0, pattern.nonground).join('');
        if (dv.value.length < prefix.length || prefix !== dv.value.slice(0, prefix.length)) {
          return null;
        }

        const prefixRemoved = dv.value.slice(prefix.length);
        const postfix = strings.slice(pattern.nonground + 1).join('');
        if (
          prefixRemoved.length < postfix.length ||
          postfix !== prefixRemoved.slice(prefixRemoved.length - postfix.length)
        ) {
          return null;
        }

        return match(
          substitution,
          pattern.args[pattern.nonground],
          hide({
            type: 'string',
            value: prefixRemoved.slice(0, prefixRemoved.length - postfix.length),
          }),
        );
      }

      throw new Error(
        `Type error: cannot support ${pattern.name} with ${pattern.args.length} argument${
          pattern.args.length === 1 ? '' : 's'
        }`,
      );

    case 'const':
      if (dv.type !== 'const' || pattern.name !== dv.name || pattern.args.length !== dv.args.length)
        return null;
      for (let i = 0; i < pattern.args.length; i++) {
        const candidate = match(substitution, pattern.args[i], dv.args[i]);
        if (candidate === null) return null;
        substitution = candidate;
      }
      return substitution;

    case 'wildcard':
      return substitution;

    case 'var':
      if (substitution[pattern.name] !== undefined) {
        return equal(substitution[pattern.name], data) ? substitution : null;
      }
      return { [pattern.name]: data, ...substitution };
  }
}

export function apply(substitution: Substitution, pattern: Pattern): Data {
  switch (pattern.type) {
    case 'triv':
    case 'string': {
      return hide(pattern);
    }
    case 'int':
    case 'nat':
      return hide({ type: 'int', value: BigInt(pattern.value) });

    case 'special': {
      if (pattern.name === 'NAT_ZERO' && pattern.args.length === 0) {
        return hide({ type: 'int', value: 0n });
      }

      if (pattern.name === 'NAT_SUCC' && pattern.args.length === 1) {
        const arg = expose(apply(substitution, pattern.args[0]));
        if (arg.type === 'int') {
          return hide({ type: 'int', value: arg.value + 1n });
        } else {
          throw new Error(`Type error: argument to NAT_SUCC is an ${arg.type}, not a nat.`);
        }
      }

      if (pattern.name === 'INT_PLUS') {
        const args = pattern.args.map((arg, i) => {
          const value = expose(apply(substitution, arg));
          if (value.type !== 'int') {
            throw new Error(`Type error: argument #${i} to INT_PLUS is ${value.type}, not int.`);
          }
          return value.value;
        });
        return hide({
          type: 'int',
          value: args.reduce((x, y) => x + y, 0n),
        });
      }

      if (pattern.name === 'INT_MINUS' && pattern.args.length === 2) {
        const [x, y] = pattern.args.map((arg, i) => {
          const value = expose(apply(substitution, arg));
          if (value.type !== 'int') {
            throw new Error(`Type error: argument #${i} to INT_PLUS is ${value.type}, not int.`);
          }
          return value.value;
        });
        return hide({ type: 'int', value: x - y });
      }

      if (pattern.name === 'STRING_CONCAT') {
        const args = pattern.args.map((arg, i) => {
          const value = expose(apply(substitution, arg));
          if (value.type !== 'string') {
            throw new Error(
              `Type error: argument #${i} to STRING_CONCAT is ${value.type}, not string.`,
            );
          }
          return value.value;
        });
        return hide({ type: 'string', value: args.join('') });
      }

      throw new Error(
        `Type error: cannot support ${pattern.name} with ${pattern.args.length} argument${
          pattern.args.length === 1 ? '' : 's'
        }`,
      );
    }

    case 'const': {
      return hide({
        type: 'const',
        name: pattern.name,
        args: pattern.args.map((arg) => apply(substitution, arg)),
      });
    }

    case 'wildcard': {
      throw new Error(`Cannot match apply a substitution to a pattern containing the wildcard '_'`);
    }

    case 'var': {
      const result = substitution[pattern.name];
      if (result == null) {
        throw new Error(
          `Free variable '${pattern.name}' not assigned to in grounding substitution`,
        );
      }
      return result;
    }
  }
}

export function equal(t: Data, s: Data): boolean {
  return t === s;
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
