import { Token, dusaTokenizer } from './dusa-tokenizer.js';
import { ParsedPattern } from './terms.js';
import { ParsedConclusion, ParsedPremise, ParsedTopLevel } from './syntax.js';
import { Issue, parseWithStreamParser } from '../parsing/parser.js';
import { SourceLocation, SourcePosition } from '../parsing/source-location.js';
import { BUILT_IN_MAP, isBuiltIn } from './dusa-builtins.js';

interface ImperativeStream<T> {
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
): { errors: Issue[] } | { errors: null; document: ParsedTopLevel[] } {
  const tokens = parseWithStreamParser(dusaTokenizer, str);

  for (const issue of tokens.issues) {
    if (issue.severity === 'warning') {
      console.error(`Parse warning: ${issue.msg} at line ${issue.loc?.start.line}`);
    }
  }
  if (tokens.issues.filter(({ severity }) => severity === 'error').length > 0) {
    return { errors: tokens.issues };
  }

  const parseResult = parseTokens(tokens.document);
  const parseIssues = parseResult.filter((decl): decl is Issue => decl.type === 'Issue');
  const parseDecls = parseResult.filter((decl): decl is ParsedTopLevel => decl.type !== 'Issue');

  // If parsing phase gives warning-level issues, this will need to be modified as above
  if (parseIssues.length > 0) {
    return { errors: parseIssues };
  }

  return { errors: null, document: parseDecls };
}

function parseDeclOrIssue(t: ImperativeStream<Token>): ParsedTopLevel | Issue | null {
  try {
    return parseDecl(t);
  } catch (e) {
    if (e instanceof DusaSyntaxError) {
      let next: Token | null;
      while ((next = t.next()) !== null && next.type !== '.');
      return { type: 'Issue', msg: e.message, severity: 'error', loc: e.loc };
    } else {
      throw e;
    }
  }
}

export function parseTokens(tokens: Token[]): (ParsedTopLevel | Issue)[] {
  const t = mkStream(tokens);
  const result: (ParsedTopLevel | Issue)[] = [];

  let decl = parseDeclOrIssue(t);
  while (decl !== null) {
    result.push(decl);
    decl = parseDeclOrIssue(t);
  }
  return result;
}

function mkStream<T>(xs: T[]): ImperativeStream<T> {
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

function force(t: ImperativeStream<Token>, type: string): Token {
  const tok = t.next();
  if (tok === null) {
    throw new DusaSyntaxError(`Expected to find '${type}', but instead reached the end of input.`);
  }
  if (tok.type !== type) {
    throw new DusaSyntaxError(
      `Expected to find '${type}', but instead found '${tok.type}'.`,
      tok.loc,
    );
  }
  return tok;
}

function chomp(t: ImperativeStream<Token>, type: string): Token | null {
  if (t.peek()?.type === type) {
    return t.next();
  } else {
    return null;
  }
}

function forceFullTerm(t: ImperativeStream<Token>): ParsedPattern {
  const result = parseFullTerm(t);
  if (result === null) {
    throw new DusaSyntaxError(
      'Expected to find a term here, but no term found.',
      t.peek()?.loc ?? undefined,
    );
  }
  return result;
}

export function parseConclusion(
  nameTok: Token & { type: 'const' },
  t: ImperativeStream<Token>,
): ParsedConclusion {
  const name = nameTok.value;

  let lastLoc = nameTok.loc;
  const args: ParsedPattern[] = [];
  let next = parseTerm(t);
  while (next !== null) {
    lastLoc = next.loc;
    args.push(next);
    next = parseTerm(t);
  }

  const isToken = chomp(t, 'is') || chomp(t, 'is?');
  if (!isToken) {
    return { name, args, type: 'datalog', loc: { start: nameTok.loc.start, end: lastLoc.end } };
  }

  let tok: Token | null;
  if ((tok = chomp(t, '{')) !== null) {
    const choices: ParsedPattern[] = [];
    choices.push(forceFullTerm(t));
    while ((tok = chomp(t, '}')) === null) {
      force(t, ',');
      choices.push(forceFullTerm(t));
    }
    return {
      name,
      args,
      type: isToken.type === 'is' ? 'closed' : 'open',
      choices,
      loc: { start: nameTok.loc.start, end: tok.loc.end },
    };
  } else {
    const value = parseFullTerm(t);
    if (value === null) {
      throw new DusaSyntaxError(
        `Expected to find a value after '${isToken.type}', but did not.`,
        isToken.loc,
      );
    }
    return {
      name,
      args,
      type: isToken.type === 'is' ? 'closed' : 'open',
      choices: [value],
      loc: { start: nameTok.loc.start, end: value.loc.end },
    };
  }
}

const BINARY_PREDICATES = {
  '==': 'Equality',
  '!=': 'Inequality',
  '<=': 'Leq',
  '<': 'Lt',
  '>=': 'Geq',
  '>': 'Gt',
} as const;

export function forcePremise(t: ImperativeStream<Token>): ParsedPremise {
  const a = forceFullTerm(t);
  for (const [tok, type] of Object.entries(BINARY_PREDICATES)) {
    if (chomp(t, tok)) {
      const b = forceFullTerm(t);
      return { type, a, b, loc: { start: a.loc.start, end: b.loc.end } };
    }
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

export function parseDecl(t: ImperativeStream<Token>): ParsedTopLevel | null {
  let tok = t.next();
  if (tok === null) return null;

  let result: ParsedTopLevel;
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
    } else if (tok.value === 'builtin') {
      const builtin = chomp(t, 'var') as null | { loc: SourceLocation; type: 'var'; value: string };
      if (builtin === null || !isBuiltIn(builtin.value)) {
        throw new DusaSyntaxError(
          `#builtin must be followed by the ALL_CAPS name of a built-in operation. Options are ${Object.keys(BUILT_IN_MAP).sort().join(', ')}.`,
          builtin?.loc ? { start: tok.loc.start, end: builtin.loc.end } : tok.loc,
        );
      }

      const constTok = chomp(t, 'const') as null | {
        loc: SourceLocation;
        type: 'const';
        value: string;
      };
      if (constTok === null) {
        throw new DusaSyntaxError(
          `#builtin ${builtin.value} must be followed by a constant to use for the built-in operation.`,
          { start: tok.loc.start, end: builtin.loc.end },
        );
      }

      const trailingPeriod = chomp(t, '.');
      return {
        type: 'Builtin',
        builtin: builtin.value,
        name: constTok.value,
        loc: {
          start: tok.loc.start,
          end: trailingPeriod === null ? constTok.loc.end : trailingPeriod.loc.end,
        },
      };
    } else if (tok.value === 'lazy') {
      const predicate = chomp(t, 'const') as null | {
        loc: SourceLocation;
        type: 'var';
        value: string;
      };
      if (predicate === null) {
        throw new DusaSyntaxError(`#lazy must be followed by the name of a predicate.`, tok.loc);
      }
      const trailingPeriod = chomp(t, '.');

      return {
        type: 'Lazy',
        name: predicate.value,
        loc: {
          start: tok.loc.start,
          end: trailingPeriod === null ? predicate.loc.end : trailingPeriod.loc.end,
        },
      };
    } else {
      throw new DusaSyntaxError(
        `Unexpected directive '${tok.value}'. Valid directives are #builtin, #demand, #forbid, and #lazy.`,
        tok.loc,
      );
    }
  } else if (tok.type === ':-') {
    throw new DusaSyntaxError(`Declaration started with ':-' (use #forbid instead)`, tok.loc);
  } else if (tok.type === 'const') {
    const conclusion = parseConclusion(tok, t);
    result = {
      type: 'Rule',
      premises: [],
      conclusion,
      loc: conclusion.loc, // loc.end will be replaced
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

export function parseFullTerm(t: ImperativeStream<Token>): ParsedPattern | null {
  const tok = t.peek();
  if (tok?.type === 'const') {
    t.next();
    const args: ParsedPattern[] = [];
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

export function parseTerm(t: ImperativeStream<Token>): ParsedPattern | null {
  const tok = t.peek();
  if (tok === null) return null;
  if (tok.type === '(') {
    t.next();
    const result = parseFullTerm(t);
    if (result === null) {
      throw new DusaSyntaxError('Did not find a term following an open parenthesis.', {
        start: tok.loc.start,
        end: t.peek()?.loc.end ?? tok.loc.end,
      });
    }
    const closeParen = t.next();
    if (closeParen?.type !== ')') {
      throw new DusaSyntaxError('Did not find the matching parenthesis that was expected.', {
        start: tok.loc.start,
        end: closeParen?.loc.end ?? result.loc.end,
      });
    }
    return result;
  }

  if (tok.type === 'triv') {
    t.next();
    return { type: 'trivial', loc: tok.loc };
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
    return { type: 'int', value: tok.value, loc: tok.loc };
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
