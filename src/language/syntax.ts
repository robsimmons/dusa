import { Issue } from '../parsing/parser.js';
import { SourceLocation } from '../parsing/source-location.js';
import { BUILT_IN_PRED } from './dusa-builtins.js';
import { ParsedPattern, Pattern, freeVars, termToString } from './terms.js';

export interface ParsedProposition {
  type: 'Proposition';
  name: string;
  args: ParsedPattern[];
  loc: SourceLocation;
  value: null | ParsedPattern;
}

export interface ParsedTermComparison {
  type: 'Equality' | 'Inequality' | 'Gt' | 'Geq' | 'Lt' | 'Leq';
  a: ParsedPattern;
  b: ParsedPattern;
  loc: SourceLocation;
}

export type ParsedPremise = ParsedProposition | ParsedTermComparison;

export type Conclusion = {
  name: string;
  args: Pattern[];
  loc?: SourceLocation;
} & (
  | { type: 'datalog' }
  | { type: 'open'; choices: Pattern[] }
  | { type: 'closed'; choices: Pattern[] }
);

export type ParsedConclusion = {
  name: string;
  args: ParsedPattern[];
  loc: SourceLocation;
} & (
  | { type: 'datalog' }
  | { type: 'open'; choices: ParsedPattern[] }
  | { type: 'closed'; choices: ParsedPattern[] }
);

export type ParsedDeclaration =
  | { type: 'Forbid'; premises: ParsedPremise[]; loc: SourceLocation }
  | { type: 'Demand'; premises: ParsedPremise[]; loc: SourceLocation }
  | {
      type: 'Rule';
      premises: ParsedPremise[];
      conclusion: ParsedConclusion;
      loc: SourceLocation;
    };

export type ParsedBuiltin = {
  type: 'Builtin';
  builtin: BUILT_IN_PRED;
  name: string;
  loc: SourceLocation;
};

export type ParsedTopLevel = ParsedBuiltin | ParsedDeclaration;

export function propToString(p: ParsedProposition) {
  const args = p.args.map((arg) => ` ${termToString(arg)}`).join('');
  const value =
    p.value === null || p.value.type === 'trivial' ? '' : ` is ${termToString(p.value)}`;
  return `${p.name}${args}${value}`;
}

export function headToString(
  head: { name: string; args: Pattern[] } & (
    | { type: 'datalog' }
    | { type: 'open'; choices: Pattern[] }
    | { type: 'closed'; choices: Pattern[] }
  ),
): string {
  const args = head.args.map((arg) => ` ${termToString(arg)}`).join('');
  const base = `${head.name}${args}`;
  switch (head.type) {
    case 'datalog': {
      return base;
    }
    case 'open':
    case 'closed': {
      const is = head.type === 'open' ? 'is?' : 'is';
      if (head.choices.length === 1) {
        return `${base} ${is} ${termToString(head.choices[0])}`;
      }
      return `${base} ${is} { ${head.choices.map((choice) => termToString(choice, false)).join(', ')} }`;
    }
  }
}

function premiseToString(premise: ParsedPremise) {
  switch (premise.type) {
    case 'Equality':
      return `${termToString(premise.a)} == ${termToString(premise.b)}`;
    case 'Inequality':
      return `${termToString(premise.a)} != ${termToString(premise.b)}`;
    case 'Gt':
      return `${termToString(premise.a)} > ${termToString(premise.b)}`;
    case 'Geq':
      return `${termToString(premise.a)} >= ${termToString(premise.b)}`;
    case 'Lt':
      return `${termToString(premise.a)} < ${termToString(premise.b)}`;
    case 'Leq':
      return `${termToString(premise.a)} <= ${termToString(premise.b)}`;
    case 'Proposition':
      return propToString(premise);
  }
}

export function freeVarsPremise(premise: ParsedPremise) {
  switch (premise.type) {
    case 'Equality':
    case 'Inequality':
    case 'Gt':
    case 'Geq':
    case 'Lt':
    case 'Leq':
      return freeVars(premise.a, premise.b);
    case 'Proposition':
      if (premise.value === null) {
        return freeVars(...premise.args);
      } else {
        return freeVars(...premise.args, premise.value);
      }
  }
}

export function declToString(decl: ParsedTopLevel): string {
  switch (decl.type) {
    case 'Forbid':
      return `#forbid ${decl.premises.map(premiseToString).join(', ')}.`;
    case 'Demand':
      return `#demand ${decl.premises.map(premiseToString).join(', ')}.`;
    case 'Builtin':
      return `#builtin ${decl.builtin} ${decl.name}`;
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

export function* visitTermsInDecl(decl: ParsedDeclaration) {
  if (decl.type === 'Rule') {
    for (const term of decl.conclusion.args) {
      yield* visitSubterms(term);
    }
    switch (decl.conclusion.type) {
      case 'datalog':
        break;
      case 'open':
      case 'closed':
        for (const term of decl.conclusion.choices) {
          yield* visitSubterms(term);
        }
        break;
    }
  }
  if (decl.type === 'Demand' || decl.type === 'Forbid' || decl.type === 'Rule') {
    yield* visitTermsInPremises(...decl.premises);
  }
}

export function* visitTermsinProgram(decls: (Issue | ParsedDeclaration)[]) {
  for (const decl of decls) {
    if (decl.type === 'Rule') {
      for (const term of decl.conclusion.args) {
        yield* visitSubterms(term);
      }
      switch (decl.conclusion.type) {
        case 'datalog':
          break;
        case 'open':
        case 'closed':
          for (const term of decl.conclusion.choices) {
            yield* visitSubterms(term);
          }
          break;
      }
    }
    if (decl.type === 'Demand' || decl.type === 'Forbid' || decl.type === 'Rule') {
      yield* visitTermsInPremises(...decl.premises);
    }
  }
}
