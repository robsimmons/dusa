import { Issue } from '../parsing/parser.js';
import { SourceLocation } from '../parsing/source-location.js';
import { ParsedPattern, Pattern, freeVars, termToString } from './terms.js';

export interface Proposition {
  type: 'Proposition';
  name: string;
  args: Pattern[];
  value: null | Pattern;
}

export interface ParsedProposition {
  type: 'Proposition';
  name: string;
  args: ParsedPattern[];
  loc: SourceLocation;
  value: null | ParsedPattern;
}

export interface TermComparison {
  type: 'Equality' | 'Inequality';
  a: Pattern; // Must have no new free variables
  b: Pattern; // May have new free variables
}
export interface ParsedTermComparison {
  type: 'Equality' | 'Inequality';
  a: ParsedPattern;
  b: ParsedPattern;
  loc: SourceLocation;
}

export type Premise = Proposition | TermComparison;
export type ParsedPremise = ParsedProposition | ParsedTermComparison;

export interface Conclusion {
  name: string;
  args: Pattern[];
  values: null | Pattern[];
  exhaustive: boolean;
  loc?: SourceLocation;
}

export interface ParsedConclusion {
  name: string;
  args: ParsedPattern[];
  values: null | ParsedPattern[];
  exhaustive: boolean;
  loc: SourceLocation;
}

export type Declaration =
  | { type: 'Forbid'; premises: Premise[]; loc?: SourceLocation }
  | { type: 'Demand'; premises: Premise[]; loc?: SourceLocation }
  | {
      type: 'Rule';
      premises: Premise[];
      conclusion: Conclusion;
      loc?: SourceLocation;
    };

export type ParsedDeclaration =
  | { type: 'Forbid'; premises: ParsedPremise[]; loc: SourceLocation }
  | { type: 'Demand'; premises: ParsedPremise[]; loc: SourceLocation }
  | {
      type: 'Rule';
      premises: ParsedPremise[];
      conclusion: ParsedConclusion;
      loc: SourceLocation;
    };

export function propToString(p: ParsedProposition | Proposition) {
  const args = p.args.map((arg) => ` ${termToString(arg)}`).join('');
  const value = p.value === null || p.value.type === 'triv' ? '' : ` is ${termToString(p.value)}`;
  return `${p.name}${args}${value}`;
}

export function headToString(head: ParsedConclusion | Conclusion) {
  const args = head.args.map((arg) => ` ${termToString(arg)}`).join('');
  if (head.values === null) {
    return `${head.name}${args}`;
  } else if (head.values.length !== 1 || !head.exhaustive) {
    return `${head.name}${args} is { ${head.values
      .map((term) => termToString(term, false))
      .join(', ')}${head.exhaustive ? '' : '?'} }`;
  } else if (head.values[0].type === 'triv') {
    return `${head.name}${args}`;
  } else {
    return `${head.name}${args} is ${termToString(head.values[0], false)}`;
  }
}

function premiseToString(premise: ParsedPremise | Premise) {
  switch (premise.type) {
    case 'Equality':
      return `${termToString(premise.a)} == ${termToString(premise.b)}`;
    case 'Inequality':
      return `${termToString(premise.a)} != ${termToString(premise.b)}`;
    case 'Proposition':
      return propToString(premise);
  }
}

export function freeVarsPremise(premise: ParsedPremise | Premise) {
  switch (premise.type) {
    case 'Equality':
    case 'Inequality':
      return freeVars(premise.a, premise.b);
    case 'Proposition':
      if (premise.value === null) {
        return freeVars(...premise.args);
      } else {
        return freeVars(...premise.args, premise.value);
      }
  }
}

export function declToString(decl: ParsedDeclaration | Declaration): string {
  switch (decl.type) {
    case 'Forbid':
      return `#forbid ${decl.premises.map(premiseToString).join(', ')}.`;
    case 'Demand':
      return `#demand ${decl.premises.map(premiseToString).join(', ')}.`;
    case 'Rule':
      if (decl.premises.length === 0) {
        return `${headToString(decl.conclusion)}.`;
      }
      return `${headToString(decl.conclusion)} :- ${decl.premises
        .map(premiseToString)
        .join(', ')}.`;
  }
}

export function* visitPropsInProgram(decls: (Issue | ParsedDeclaration)[]) {
  for (const decl of decls) {
    if (decl.type === 'Rule') {
      yield decl.conclusion;
    }
    if (decl.type === 'Demand' || decl.type === 'Forbid' || decl.type === 'Rule') {
      for (const premise of decl.premises) {
        if (premise.type === 'Proposition') {
          yield premise;
        }
      }
    }
  }
}

export function* visitSubterms(...terms: ParsedPattern[]): IterableIterator<ParsedPattern> {
  for (const term of terms) {
    yield term;
    switch (term.type) {
      case 'special':
      case 'const':
        for (const subterm of term.args) {
          yield* visitSubterms(subterm);
        }
    }
  }
}

export function* visitTermsInPremises(...premises: ParsedPremise[]) {
  for (const premise of premises) {
    if (premise.type === 'Proposition') {
      for (const term of premise.args) {
        yield* visitSubterms(term);
      }
      if (premise.value) {
        yield* visitSubterms(premise.value);
      }
    } else {
      yield* visitSubterms(premise.a);
      yield* visitSubterms(premise.b);
    }
  }
}

export function* visitTermsinProgram(decls: (Issue | ParsedDeclaration)[]) {
  for (const decl of decls) {
    if (decl.type === 'Rule') {
      for (const term of decl.conclusion.args) {
        yield* visitSubterms(term);
      }
      for (const term of decl.conclusion.values ?? []) {
        yield* visitSubterms(term);
      }
    }
    if (decl.type === 'Demand' || decl.type === 'Forbid' || decl.type === 'Rule') {
      yield* visitTermsInPremises(...decl.premises);
    }
  }
}
