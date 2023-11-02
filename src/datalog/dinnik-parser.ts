import { Token, dinnikTokenizer } from './dinnik-tokenizer';
import { ParsedPattern, Pattern } from './terms';
import { Declaration, Premise } from './syntax';
import { Issue, parseWithStreamParser } from './parsing/parser';
import { SourceLocation } from './parsing/source-location';

interface Istream<T> {
  next(): T | null;
  peek(): T | null;
}

export class DinnikSyntaxError extends SyntaxError {
  public name = 'DinnikSyntaxError';
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
): { errors: Issue[] } | { errors: null; document: Declaration[] } {
  const tokens = parseWithStreamParser(dinnikTokenizer, str);
  if (tokens.issues.length > 0) return { errors: tokens.issues };
  const parseResult = parseTokens(tokens.document);
  const parseIssues = parseResult.filter((decl): decl is Issue => decl.type === 'Issue');
  const parseDecls = parseResult.filter((decl): decl is Declaration => decl.type !== 'Issue');
  if (parseIssues.length > 0) {
    return { errors: parseIssues };
  }
  return { errors: null, document: parseDecls };
}

function parseDeclOrIssue(t: Istream<Token>): Declaration | Issue | null {
  try {
    return parseDecl(t);
  } catch (e) {
    if (e instanceof DinnikSyntaxError) {
      let next: Token | null;
      while ((next = t.next()) !== null && next.type !== '.');
      return { type: 'Issue', msg: e.message, loc: e.loc };
    } else {
      throw e;
    }
  }
}

export function parseTokens(tokens: Token[]): (Declaration | Issue)[] {
  const t = mkStream(tokens);
  const result: (Declaration | Issue)[] = [];

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
  if (tok === null) throw new DinnikSyntaxError(`Expected ${type}, found end of input.`);
  if (tok.type !== type)
    throw new DinnikSyntaxError(`Expected ${type}, found ${tok.type}`, tok.loc);
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
    throw new DinnikSyntaxError('Expected a term, but no term found', t.peek()?.loc ?? undefined);
  }
  return result;
}

export function parseHeadValue(t: Istream<Token>): { values: Pattern[]; exhaustive: boolean } {
  const istok = chomp(t, 'is');
  if (!istok) {
    return { values: [{ type: 'triv' }], exhaustive: true };
  }

  if (chomp(t, '{')) {
    const values = [forceFullTerm(t)];
    let exhaustive = true;
    while (!chomp(t, '}')) {
      if (chomp(t, ',')) {
        values.push(forceFullTerm(t));
      } else {
        force(t, '...');
        force(t, '}');
        exhaustive = false;
        break;
      }
    }
    return { values, exhaustive };
  } else {
    const value = parseFullTerm(t);
    if (value === null) {
      throw new DinnikSyntaxError(`Did not find value after 'is'`, istok.loc);
    }
    return { values: [value], exhaustive: true };
  }
}

export function forcePremise(t: Istream<Token>): Premise {
  const pseudoTerm = forceFullTerm(t);
  if (chomp(t, '==')) {
    return { type: 'Equality', a: pseudoTerm, b: forceFullTerm(t) };
  }
  if (chomp(t, '!=')) {
    return { type: 'Inequality', a: pseudoTerm, b: forceFullTerm(t) };
  }
  if (pseudoTerm.type !== 'const') {
    throw new DinnikSyntaxError(
      `Expected an attribute, found a '${pseudoTerm.type}'`,
      pseudoTerm.loc,
    );
  }
  if (chomp(t, 'is')) {
    return {
      type: 'Proposition',
      name: pseudoTerm.name,
      args: [...pseudoTerm.args, forceFullTerm(t)],
    };
  }
  return {
    type: 'Proposition',
    name: pseudoTerm.name,
    args: [...pseudoTerm.args, { type: 'triv' }],
  };
}

export function parseDecl(t: Istream<Token>): Declaration | null {
  const tok = t.next();
  if (tok === null) return null;

  let result: Declaration;
  if (tok.type === ':-') {
    result = { type: 'Constraint', premises: [] };
  } else if (tok.type === 'const') {
    const name = tok.value;
    const args: Pattern[] = [];
    let next = parseTerm(t);
    while (next !== null) {
      args.push(next);
      next = parseTerm(t);
    }
    const { values, exhaustive } = parseHeadValue(t);
    result = { type: 'Rule', premises: [], conclusion: { name, args, values, exhaustive } };

    if (chomp(t, '.') !== null) {
      return result;
    }
    force(t, ':-');
  } else {
    throw new DinnikSyntaxError(`Unexpected token '${tok.type}' at start of declaration`, tok.loc);
  }

  result.premises.push(forcePremise(t));
  while (!chomp(t, '.')) {
    force(t, ',');
    result.premises.push(forcePremise(t));
  }

  return result;
}

export function parseFullTerm(t: Istream<Token>): ParsedPattern | null {
  const tok = t.peek();
  if (tok?.type === 'const') {
    t.next();
    const args: Pattern[] = [];
    let endLoc = tok.loc.end;
    let next = parseTerm(t);
    while (next !== null) {
      endLoc = next.loc.end;
      args.push(next);
      next = parseTerm(t);
    }
    return {
      type: 'const',
      name: tok.value,
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
      throw new DinnikSyntaxError('No term following an open parenthesis', {
        start: tok.loc.start,
        end: t.peek()?.loc.end ?? tok.loc.end,
      });
    }
    const closeParen = t.next();
    if (closeParen?.type !== ')') {
      throw new DinnikSyntaxError('Did not find expected matching parenthesis', {
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

  return null;
}
