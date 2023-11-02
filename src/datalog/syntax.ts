import { Issue } from './parsing/parser';
import { SourceLocation } from './parsing/source-location';
import { Pattern, freeVars, termToString } from './terms';

export interface Proposition {
  type: 'Proposition';
  name: string;
  args: Pattern[];
  loc?: SourceLocation;
}

export interface Equality {
  type: 'Equality';
  a: Pattern;
  b: Pattern;
  loc?: SourceLocation;
}

export interface Inequality {
  type: 'Inequality';
  a: Pattern;
  b: Pattern;
  loc?: SourceLocation;
}

export type Premise = Proposition | Equality | Inequality;

export interface Conclusion {
  name: string;
  args: Pattern[];
  values: Pattern[];
  exhaustive: boolean;
  loc?: SourceLocation;
}

export type Declaration =
  | { type: 'Constraint'; premises: Premise[]; loc?: SourceLocation }
  | {
      type: 'Rule';
      premises: Premise[];
      conclusion: Conclusion;
      loc?: SourceLocation;
    };

export function propToString(p: Proposition) {
  const args = p.args
    .slice(0, p.args.length - 1)
    .map((arg) => ` ${termToString(arg)}`)
    .join('');
  const value = p.args[p.args.length - 1];
  return value.type === 'triv' ? `${p.name}${args}` : `${p.name}${args} is ${termToString(value)}`;
}

function headToString(head: Conclusion) {
  const args = head.args.map((arg) => ` ${termToString(arg)}`).join('');
  if (head.values.length !== 1 || !head.exhaustive) {
    return `${head.name}${args} is { ${head.values
      .map((term) => termToString(term, false))
      .join(', ')}${head.exhaustive ? '' : '...'} }`;
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
    case 'Constraint':
      return `:- ${decl.premises.map(premiseToString).join(', ')}.`;
    case 'Rule':
      if (decl.premises.length === 0) {
        return `${headToString(decl.conclusion)}.`;
      }
      return `${headToString(decl.conclusion)} :- ${decl.premises
        .map(premiseToString)
        .join(', ')}.`;
  }
}

function checkPremises(premises: Premise[]): {
  fv: Set<string>;
  errors: Issue[];
} {
  const knownFreeVars = new Set<string>();
  const errors: Issue[] = [];
  for (const premise of premises) {
    switch (premise.type) {
      case 'Inequality': {
        const fv = freeVars(premise.a, premise.b);
        for (const v of fv) {
          if (!knownFreeVars.has(v)) {
            errors.push({
              type: 'Issue',
              msg: `Variable '${v}' not defined before being used in an inequality.`,
            });
          }
        }
        break;
      }
      case 'Equality': {
        const fvA = freeVars(premise.a);
        const fvB = freeVars(premise.b);
        for (const v of fvA) {
          if (!knownFreeVars.has(v)) {
            errors.push({
              type: 'Issue',
              msg: `The left side of an equality premise must include only previously ground variables`,
            });
          }
        }
        for (const v of fvB) {
          knownFreeVars.add(v);
        }
        break;
      }
      case 'Proposition': {
        const fv = freeVars(...premise.args);
        for (const v of fv) {
          knownFreeVars.add(v);
        }
        break;
      }
    }
  }

  return { fv: knownFreeVars, errors };
}

export function checkDecl(decl: Declaration): Issue[] {
  const { fv, errors } = checkPremises(decl.premises);
  switch (decl.type) {
    case 'Rule': {
      const headVars = freeVars(...decl.conclusion.args, ...decl.conclusion.values);
      for (const v of headVars) {
        if (!fv.has(v)) {
          errors.push({
            type: 'Issue',
            msg: `Variable '${v}' used in head of rule but not defined in a premise.`,
          });
        }
      }
      break;
    }
    case 'Constraint': {
      break;
    }
  }
  return errors;
}

export function check(decls: Declaration[]) {
  const errors: Issue[] = [];
  for (const decl of decls) {
    errors.push(...checkDecl(decl));
  }
  return errors;
}
