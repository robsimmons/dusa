import { Token } from './dinnik-tokenizer';
import { Pattern } from '../terms';
import { Declaration, Premise } from '../syntax';
import { Issue } from '../parsing/parser';

interface Istream<T> {
  next(): T | null;
  peek(): T | null;
}

export function parse(tokens: Token[]): (Declaration | Issue)[] {
  const t = mkStream(tokens);
  const result: Declaration[] = [];
  let decl = parseDecl(t);
  while (decl !== null) {
    result.push(decl);
    decl = parseDecl(t);
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
  if (tok === null) throw new Error(`Expected ${type}, found end of input.`);
  if (tok.type !== type) throw new Error(`Expected ${type}, found ${tok.type}`);
  return tok;
}

function chomp(t: Istream<Token>, type: string): Token | null {
  if (t.peek()?.type === type) {
    return t.next();
  } else {
    return null;
  }
}

function forceTerm(t: Istream<Token>): Pattern {
  const result = parseTerm(t);
  if (result === null) {
    throw new Error('Expected a term, but no term found');
  }
  return result;
}

export function parseHeadValue(t: Istream<Token>): { values: Pattern[]; exhaustive: boolean } {
  if (!chomp(t, 'is')) {
    return { values: [{ type: 'triv' }], exhaustive: true };
  }

  if (chomp(t, '{')) {
    let values = [forceTerm(t)];
    let exhaustive = true;
    while (!chomp(t, '}')) {
      if (chomp(t, ',')) {
        values.push(forceTerm(t));
      } else {
        force(t, '...');
        force(t, '}');
        exhaustive = false;
        break;
      }
    }
    return { values, exhaustive };
  } else {
    const value = parseTerm(t);
    if (value === null) {
      throw new Error(`Did not find value after 'is'`);
    }
    return { values: [value], exhaustive: true };
  }
}

export function forcePremise(t: Istream<Token>): Premise {
  const pseudoTerm = forceTerm(t);
  if (chomp(t, '==')) {
    return { type: 'Equality', a: pseudoTerm, b: forceTerm(t) };
  }
  if (chomp(t, '!=')) {
    return { type: 'Inequality', a: pseudoTerm, b: forceTerm(t) };
  }
  if (pseudoTerm.type !== 'const') {
    throw new Error(`Expected an attribute, found a '${pseudoTerm.type}'`);
  }
  if (chomp(t, 'is')) {
    return {
      type: 'Proposition',
      name: pseudoTerm.name,
      args: [...pseudoTerm.args, forceTerm(t)],
    };
  }
  return {
    type: 'Proposition',
    name: pseudoTerm.name,
    args: [...pseudoTerm.args, { type: 'triv' }],
  };
}

export function parseDecl(t: Istream<Token>): Declaration | null {
  let tok = t.next();
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
    throw new Error(`Unexpected token '${tok.type}' at start of declaration`);
  }

  result.premises.push(forcePremise(t));
  while (!chomp(t, '.')) {
    force(t, ',');
    result.premises.push(forcePremise(t));
  }

  return result;
}

export function parseTerm(t: Istream<Token>): Pattern | null {
  let tok = t.peek();
  if (tok === null) return null;
  if (tok.type === '(') {
    t.next();
    const result = parseTerm(t);
    if (result === null) {
      throw new Error('No term following an open parenthesis');
    }
    const closeParen = t.next();
    if (closeParen?.type !== ')') {
      throw new Error('Did not find expected matching parenthesis');
    }
    return result;
  }

  if (tok.type === 'triv') {
    t.next();
    return { type: 'triv' };
  }

  if (tok.type === 'var') {
    t.next();
    return { type: 'var', name: tok.value };
  }

  if (tok.type === 'int') {
    t.next();
    return { type: tok.value < 0 ? 'int' : 'nat', value: tok.value };
  }

  if (tok.type === 'string') {
    t.next();
    return { type: 'string', value: tok.value };
  }

  if (tok.type === 'const') {
    t.next();
    const args: Pattern[] = [];
    let next = parseTerm(t);
    while (next !== null) {
      args.push(next);
      next = parseTerm(t);
    }
    return { type: 'const', name: tok.value, args };
  }

  return null;
}
