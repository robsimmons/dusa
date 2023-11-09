import { Token, dusaTokenizer } from './dusa-tokenizer';
import { ParsedPattern } from './terms';
import { ParsedDeclaration, ParsedPremise } from './syntax';
import { Issue, parseWithStreamParser } from './parsing/parser';
import { SourceLocation, SourcePosition } from './parsing/source-location';

interface Istream<T> {
  next(): T | null;
  peek(): T | null;
}

export class DusaSyntaxError extends SyntaxError {
  public name = 'DusaSyntaxError';
  public message: string;
  public loc?: SourceLocation;
  constructor(msg: string, loc?: SourceLocation) {
    super();
    this.message = msg;
    this.loc = loc;
  }
}

export function parse(
  str: string,
): { errors: Issue[] } | { errors: null; document: ParsedDeclaration[] } {
  const tokens = parseWithStreamParser(dusaTokenizer, str);
  if (tokens.issues.length > 0) return { errors: tokens.issues };
  const parseResult = parseTokens(tokens.document);
  const parseIssues = parseResult.filter((decl): decl is Issue => decl.type === 'Issue');
  const parseDecls = parseResult.filter((decl): decl is ParsedDeclaration => decl.type !== 'Issue');
  if (parseIssues.length > 0) {
    return { errors: parseIssues };
  }
  return { errors: null, document: parseDecls };
}

function parseDeclOrIssue(t: Istream<Token>): ParsedDeclaration | Issue | null {
  try {
    return parseDecl(t);
  } catch (e) {
    if (e instanceof DusaSyntaxError) {
      let next: Token | null;
      while ((next = t.next()) !== null && next.type !== '.');
      return { type: 'Issue', msg: e.message, loc: e.loc };
    } else {
      throw e;
    }
  }
}

export function parseTokens(tokens: Token[]): (ParsedDeclaration | Issue)[] {
  const t = mkStream(tokens);
  const result: (ParsedDeclaration | Issue)[] = [];

  let decl = parseDeclOrIssue(t);
  while (decl !== null) {
    result.push(decl);
    decl = parseDeclOrIssue(t);
  }
  return result;
}

function mkStream<T>(xs: T[]): Istream<T> {
  let i = 0;
  return {
    next() {
      if (i >= xs.length) return null;
      return xs[i++];
    },
    peek() {
      if (i >= xs.length) return null;
      return xs[i];
    },
  };
}

function force(t: Istream<Token>, type: string): Token {
  const tok = t.next();
  if (tok === null) throw new DusaSyntaxError(`Expected ${type}, found end of input.`);
  if (tok.type !== type) throw new DusaSyntaxError(`Expected ${type}, found ${tok.type}`, tok.loc);
  return tok;
}

function chomp(t: Istream<Token>, type: string): Token | null {
  if (t.peek()?.type === type) {
    return t.next();
  } else {
    return null;
  }
}

function forceFullTerm(t: Istream<Token>): ParsedPattern {
  const result = parseFullTerm(t);
  if (result === null) {
    throw new DusaSyntaxError('Expected a term, but no term found', t.peek()?.loc ?? undefined);
  }
  return result;
}

export function parseHeadValue(t: Istream<Token>): {
  values: null | ParsedPattern[];
  exhaustive: boolean;
  end: SourcePosition | null;
} {
  const istok = chomp(t, 'is');
  if (!istok) {
    return { values: null, exhaustive: true, end: null };
  }

  let tok: Token | null;
  if ((tok = chomp(t, '{')) !== null) {
    const values = [];
    let exhaustive = true;
    let end = tok.loc.end;
    if (chomp(t, '?')) {
      exhaustive = false;
    } else {
      values.push(forceFullTerm(t));
    }
    while ((tok = chomp(t, '}')) === null) {
      if (chomp(t, ',')) {
        if (chomp(t, '?')) {
          exhaustive = false;
        } else {
          values.push(forceFullTerm(t));
        }
      } else {
        force(t, '?');
        end = force(t, '}').loc.end;
        exhaustive = false;
        break;
      }
    }
    return { values, exhaustive, end: tok?.loc.end ?? end };
  } else {
    const value = parseFullTerm(t);
    if (value === null) {
      throw new DusaSyntaxError(`Did not find value after 'is'`, istok.loc);
    }
    return { values: [value], exhaustive: true, end: value.loc.end };
  }
}

export function forcePremise(t: Istream<Token>): ParsedPremise {
  const a = forceFullTerm(t);
  if (chomp(t, '==')) {
    const b = forceFullTerm(t);
    return { type: 'Equality', a, b, loc: { start: a.loc.start, end: b.loc.end } };
  }
  if (chomp(t, '!=')) {
    const b = forceFullTerm(t);
    return { type: 'Inequality', a, b, loc: { start: a.loc.start, end: b.loc.end } };
  }
  if (a.type !== 'const') {
    throw new DusaSyntaxError(`Expected an attribute, found a '${a.type}'`, a.loc);
  }
  if (chomp(t, 'is')) {
    const value = forceFullTerm(t);
    return {
      type: 'Proposition',
      name: a.name,
      args: a.args,
      value,
      loc: { start: a.loc.start, end: value.loc.end },
    };
  }
  return {
    type: 'Proposition',
    name: a.name,
    args: a.args,
    value: null,
    loc: a.loc,
  };
}

export function parseDecl(t: Istream<Token>): ParsedDeclaration | null {
  let tok = t.next();
  if (tok === null) return null;

  let result: ParsedDeclaration;
  const start: SourcePosition = tok.loc.start;
  if (tok.type === 'hashdirective') {
    if (tok.value === 'forbid') {
      result = {
        type: 'Forbid',
        premises: [],
        loc: tok.loc, // dummy value, will be replaced
      };
    } else if (tok.value === 'demand') {
      result = {
        type: 'Demand',
        premises: [],
        loc: tok.loc,
      };
    } else {
      throw new DusaSyntaxError(
        `Unexpected directive '${tok.value}'. Valid directives are #builtin, #demand, and #forbid.`,
      );
    }
  } else if (tok.type === ':-') {
    throw new DusaSyntaxError(`Declaration started with ':-' (use #forbid instead)`, tok.loc);
  } else if (tok.type === 'const') {
    const name = tok.value;
    let attributeEnd = tok.loc.end;
    const args: ParsedPattern[] = [];
    let next = parseTerm(t);
    while (next !== null) {
      attributeEnd = next.loc.end;
      args.push(next);
      next = parseTerm(t);
    }
    const { values, exhaustive, end } = parseHeadValue(t);
    result = {
      type: 'Rule',
      premises: [],
      conclusion: { name, args, values, exhaustive, loc: { start, end: end ?? attributeEnd } },
      loc: tok.loc, // dummy value, will be replaced
    };

    if ((tok = chomp(t, '.')) !== null) {
      return { ...result, loc: { start, end: tok.loc.end } };
    }
    force(t, ':-');
  } else {
    throw new DusaSyntaxError(`Unexpected token '${tok.type}' at start of declaration`, tok.loc);
  }

  result.premises.push(forcePremise(t));
  while ((tok = chomp(t, '.')) === null) {
    force(t, ',');
    result.premises.push(forcePremise(t));
  }

  return { ...result, loc: { start, end: tok.loc.end } };
}

export function parseFullTerm(t: Istream<Token>): ParsedPattern | null {
  const tok = t.peek();
  if (tok?.type === 'const' || tok?.type === 'builtin') {
    t.next();
    const args: ParsedPattern[] = [];
    let endLoc = tok.loc.end;
    let next = parseTerm(t);
    while (next !== null) {
      endLoc = next.loc.end;
      args.push(next);
      next = parseTerm(t);
    }
    if (tok.type === 'const') {
      return {
        type: 'const',
        name: tok.value,
        args,
        loc: { start: tok.loc.start, end: endLoc },
      };
    }
    return {
      type: 'special',
      name: tok.builtin,
      symbol: tok.value,
      args,
      loc: { start: tok.loc.start, end: endLoc },
    };
  }

  return parseTerm(t);
}

export function parseTerm(t: Istream<Token>): ParsedPattern | null {
  const tok = t.peek();
  if (tok === null) return null;
  if (tok.type === '(') {
    t.next();
    const result = parseFullTerm(t);
    if (result === null) {
      throw new DusaSyntaxError('No term following an open parenthesis', {
        start: tok.loc.start,
        end: t.peek()?.loc.end ?? tok.loc.end,
      });
    }
    const closeParen = t.next();
    if (closeParen?.type !== ')') {
      throw new DusaSyntaxError('Did not find expected matching parenthesis', {
        start: tok.loc.start,
        end: closeParen?.loc.end ?? result.loc.end,
      });
    }
    return result;
  }

  if (tok.type === 'triv') {
    t.next();
    return { type: 'triv', loc: tok.loc };
  }

  if (tok.type === 'var') {
    t.next();
    return { type: 'var', name: tok.value, loc: tok.loc };
  }

  if (tok.type === 'wildcard') {
    t.next();
    return { type: 'wildcard', name: tok.value === '_' ? null : tok.value, loc: tok.loc };
  }

  if (tok.type === 'int') {
    t.next();
    return { type: tok.value < 0 ? 'int' : 'nat', value: tok.value, loc: tok.loc };
  }

  if (tok.type === 'string') {
    t.next();
    return { type: 'string', value: tok.value, loc: tok.loc };
  }

  if (tok.type === 'const') {
    t.next();
    return { type: 'const', name: tok.value, args: [], loc: tok.loc };
  }

  if (tok.type === 'builtin') {
    t.next();
    return { type: 'special', name: tok.builtin, symbol: tok.value, args: [], loc: tok.loc };
  }

  return null;
}
