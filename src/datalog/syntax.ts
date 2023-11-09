import { Issue } from './parsing/parser';
import { SourceLocation } from './parsing/source-location';
import { ParsedPattern, Pattern, freeParsedVars, repeatedWildcards, termToString } from './terms';

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

export function propToString(p: Proposition) {
  const args = p.args.map((arg) => ` ${termToString(arg)}`).join('');
  const value = p.value === null || p.value.type === 'triv' ? '' : ` is ${termToString(p.value)}`;
  return `${p.name}${args}${value}`;
}

function headToString(head: Conclusion) {
  const args = head.args.map((arg) => ` ${termToString(arg)}`).join('');
  if (head.values === null) {
    return `${head.name}${args}`;
  } else if (head.values.length !== 1 || !head.exhaustive) {
    return `${head.name}${args} is { ${head.values
      .map((term) => termToString(term, false))
      .join(', ')}${head.exhaustive ? '' : head.values.length < 2 ? '?' : ', ?'} }`;
  } else if (head.values[0].type === 'triv') {
    return `${head.name}${args}`;
  } else {
    return `${head.name}${args} is ${termToString(head.values[0], false)}`;
  }
}

function premiseToString(premise: Premise) {
  switch (premise.type) {
    case 'Equality':
      return `${termToString(premise.a)} == ${termToString(premise.b)}`;
    case 'Inequality':
      return `${termToString(premise.a)} != ${termToString(premise.b)}`;
    case 'Proposition':
      return propToString(premise);
  }
}

export function declToString(decl: Declaration): string {
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

/**
 * Gathers uses of free variables in premises and checks that
 * free variables are being used correctly and that named wildcards
 * (like _X) aren't being reused.
 *
 * Will rearrange inequality and equality premises so that the fully-groundable
 * term always comes first.
 */
function checkFreeVarsInPremises(premises: ParsedPremise[]):
  | {
      errors: null;
      fv: Set<string>;
      forbidden: Set<string>;
      premises: ParsedPremise[];
    }
  | {
      errors: Issue[];
    } {
  const knownFreeVars = new Map<string, SourceLocation>();
  const knownWildcards = new Set<string>();
  const knownForbiddenVars = new Set<string>();
  const errors: Issue[] = [];

  function checkNotForbidden(fv: Map<string, SourceLocation>) {
    for (const [v, loc] of fv.entries()) {
      if (knownForbiddenVars.has(v)) {
        errors.push({
          type: 'Issue',
          msg: `Variable ${v} cannot be reused in a later premise because its first occurance was in an inequality`,
          loc,
        });
      }
    }
  }

  function checkForDuplicateWildcards(...patterns: ParsedPattern[]) {
    for (const [dup, loc] of repeatedWildcards(knownWildcards, ...patterns)) {
      errors.push({
        type: 'Issue',
        msg: `Named wildcard ${dup} used multiple times in a rule.`,
        loc,
      });
    }
  }

  const newPremises = premises.map((premise) => {
    switch (premise.type) {
      case 'Inequality':
      case 'Equality': {
        checkForDuplicateWildcards(premise.a, premise.b);
        const [newA, newB] = [premise.a, premise.b].map((tm) => {
          const wildcards = new Set<string>();
          repeatedWildcards(wildcards, tm);
          const fv = freeParsedVars(tm);
          checkNotForbidden(fv);
          let newVar: string | null = null;
          for (const [v, loc] of fv) {
            if (!knownFreeVars.has(v)) {
              newVar = v;
              if (premise.type === 'Inequality') {
                knownForbiddenVars.add(v);
              } else {
                knownFreeVars.set(v, loc);
              }
            }
          }
          for (const wc of wildcards) {
            newVar = wc;
          }
          return newVar;
        });

        if (newA && newB) {
          errors.push({
            type: 'Issue',
            msg: `Only one side of an ${premise.type.toLowerCase()} can include a first occurance of a variable or a wildcard. The left side uses ${newA}, the right side uses ${newB}.`,
            loc: premise.loc,
          });
        }

        // Make sure the groundable premise is the first one
        if (newA) {
          premise = { ...premise, a: premise.b, b: premise.a };
        }

        return premise;
      }

      case 'Proposition': {
        const propArgs = premise.value === null ? premise.args : [...premise.args, premise.value];
        checkForDuplicateWildcards(...propArgs);
        const fv = freeParsedVars(...propArgs);
        checkNotForbidden(fv);
        for (const [v, loc] of fv) {
          knownFreeVars.set(v, loc);
        }
        return premise;
      }
    }
  });

  if (errors.length === 0) {
    return {
      fv: new Set(knownFreeVars.keys()),
      errors: null,
      forbidden: knownForbiddenVars,
      premises: newPremises,
    };
  }
  return { errors };
}

export function checkFreeVarsInDecl(
  decl: ParsedDeclaration,
): { errors: Issue[] } | { errors: null; decl: ParsedDeclaration } {
  const premiseCheck = checkFreeVarsInPremises(decl.premises);
  if (premiseCheck.errors !== null) {
    return { errors: premiseCheck.errors };
  }
  const { fv, forbidden, premises } = premiseCheck;

  switch (decl.type) {
    case 'Demand':
    case 'Forbid':
      return { errors: null, decl: { ...decl, premises } };
    case 'Rule': {
      const errors: Issue[] = [];
      const headArgs =
        decl.conclusion.values === null
          ? decl.conclusion.args
          : [...decl.conclusion.args, ...decl.conclusion.values];
      const headVars = freeParsedVars(...headArgs);
      const wildcards = new Set<string>();
      repeatedWildcards(wildcards, ...headArgs);

      for (const w of wildcards) {
        errors.push({
          type: 'Issue',
          msg: `Cannot include wildcard ${w} in the head of a rule.`,
          loc: decl.conclusion.loc,
        });
      }

      for (const [v, loc] of headVars) {
        if (forbidden.has(v)) {
          errors.push({
            type: 'Issue',
            msg: `Variable '${v}' used in head of rule but was first defined in an inequality.`,
            loc,
          });
        } else if (!fv.has(v)) {
          errors.push({
            type: 'Issue',
            msg: `Variable '${v}' used in head of rule but not defined in a premise.`,
            loc,
          });
        }
      }

      if (errors.length !== 0) {
        return { errors };
      }
      return {
        errors: null,
        decl: { ...decl, premises },
      };
    }
  }
}

export function check(
  decls: ParsedDeclaration[],
): { errors: Issue[] } | { errors: null; decls: ParsedDeclaration[] } {
  const errors: Issue[] = [];
  const newDecls = decls.map((decl) => {
    const res = checkFreeVarsInDecl(decl);
    if (res.errors !== null) {
      errors.push(...res.errors);
    } else {
      decl = res.decl;
    }
    return decl;
  });

  if (errors.length !== 0) {
    return { errors };
  }
  return { errors: null, decls: newDecls };
}
