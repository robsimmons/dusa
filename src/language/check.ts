import { Issue } from '../parsing/parser.js';
import { SourceLocation } from '../parsing/source-location.js';
import {
  ParsedDeclaration,
  ParsedPremise,
  freeVarsPremise,
  visitPropsInProgram,
  visitSubterms,
  visitTermsInPremises,
} from './syntax.js';
import {
  ParsedPattern,
  freeParsedVars,
  repeatedWildcards,
  termToString,
  theseVarsGroundThisPattern,
} from './terms.js';

export function checkPropositionArity(
  decls: (Issue | ParsedDeclaration)[],
): { issues: null; arities: { [pred: string]: number } } | { issues: Issue[] } {
  const arities: Map<string, Map<number, SourceLocation[]>> = new Map();
  for (const prop of visitPropsInProgram(decls)) {
    if (!arities.get(prop.name)) arities.set(prop.name, new Map());
    if (!arities.get(prop.name)!.get(prop.args.length)) {
      arities.get(prop.name)!.set(prop.args.length, [prop.loc]);
    } else {
      arities.get(prop.name)!.get(prop.args.length)!.push(prop.loc);
    }
  }

  const actualArities: { [pred: string]: number } = {};
  const issues: Issue[] = [];
  for (const [pred, map] of arities.entries()) {
    const arityList = [...map.entries()].sort((a, b) => b[1].length - a[1].length);
    const expectedArity = arityList[0][0];
    actualArities[pred] = expectedArity;
    for (let i = 1; i < arityList.length; i++) {
      const [arity, occurrences] = arityList[i];
      for (const occurrence of occurrences) {
        issues.push({
          type: 'Issue',
          msg: `Predicate '${pred}' usually has ${expectedArity} argument${
            expectedArity === 1 ? '' : 's'
          }, but here it has ${arity}`,
          loc: occurrence,
        });
      }
    }
  }

  if (issues.length > 0) return { issues };
  return { issues: null, arities: actualArities };
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

  for (const premise of premises) {
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
        break;
      }

      case 'Proposition': {
        const propArgs = premise.value === null ? premise.args : [...premise.args, premise.value];
        checkForDuplicateWildcards(...propArgs);
        const fv = freeParsedVars(...propArgs);
        checkNotForbidden(fv);
        for (const [v, loc] of fv) {
          knownFreeVars.set(v, loc);
        }
        break;
      }
    }
  }

  if (errors.length === 0) {
    return {
      fv: new Set(knownFreeVars.keys()),
      errors: null,
      forbidden: knownForbiddenVars,
    };
  }
  return { errors };
}

export function checkFreeVarsInDecl(decl: ParsedDeclaration): Issue[] {
  const premiseCheck = checkFreeVarsInPremises(decl.premises);
  if (premiseCheck.errors !== null) {
    return premiseCheck.errors;
  }
  const { fv, forbidden } = premiseCheck;

  switch (decl.type) {
    case 'Demand':
    case 'Forbid':
      return [];
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

      return errors;
    }
  }
}

function checkFunctionalPredicatesInTerm(
  preds: Map<string, number>,
  boundVars: Set<string>,
  pattern: ParsedPattern,
): Issue[] {
  if (pattern.type === 'const') {
    const expectedNum = preds.get(pattern.name);
    if (expectedNum !== undefined && expectedNum !== pattern.args.length) {
      return [
        {
          type: 'Issue',
          loc: pattern.loc,
          msg: `The functional predicate '${pattern.name}' should be given ${expectedNum} argument${
            expectedNum === 1 ? '' : 's'
          }, but is given ${pattern.args.length} here`,
        },
      ];
    }
  } else if (pattern.type === 'special') {
    switch (pattern.name) {
      case 'BOOLEAN_FALSE':
      case 'BOOLEAN_TRUE':
      case 'NAT_ZERO':
        if (pattern.args.length !== 0) {
          return [
            {
              type: 'Issue',
              loc: pattern.loc,
              msg: `Built-in ${pattern.name} (${pattern.symbol}) expects no argument, has ${pattern.args.length}`,
            },
          ];
        }
        break;
      case 'INT_MINUS':
        if (pattern.args.length !== 2) {
          return [
            {
              type: 'Issue',
              loc: pattern.loc,
              msg: `Built-in ${pattern.name} (${pattern.symbol}) expects two arguments, has ${pattern.args.length}`,
            },
          ];
        }
        if (
          !theseVarsGroundThisPattern(boundVars, pattern.args[0]) ||
          !theseVarsGroundThisPattern(boundVars, pattern.args[1])
        ) {
          return [
            {
              type: 'Issue',
              loc: pattern.loc,
              msg: `Built-in ${pattern.name} (${pattern.symbol}) needs to have one of its arguments grounded by previous premises, and that is not the case here.`,
            },
          ];
        }
        break;
      case 'INT_TIMES': {
        for (const arg of pattern.args) {
          if (!theseVarsGroundThisPattern(boundVars, arg)) {
            return [
              {
                type: 'Issue',
                loc: pattern.loc,
                msg: `Built-in ${pattern.name} (${
                  pattern.symbol
                }) needs to have all of its arguments grounded by previous premises, but the argument '${termToString(
                  arg,
                )}' is not ground`,
              },
            ];
          }
        }
        break;
      }

      case 'EQUAL':
      case 'INT_PLUS':
      case 'NAT_SUCC':
      case 'STRING_CONCAT': {
        let nonGround: ParsedPattern | null = null;
        for (const arg of pattern.args) {
          if (!theseVarsGroundThisPattern(boundVars, arg)) {
            if (nonGround === null) {
              nonGround = arg;
            } else {
              return [
                {
                  type: 'Issue',
                  loc: pattern.loc,
                  msg: `Built-in ${pattern.name} (${
                    pattern.symbol
                  }) needs to have all but one of its arguments grounded by previous premises, but the arguments '${termToString(
                    nonGround,
                  )}' and '${termToString(arg)}' are both not ground.`,
                },
              ];
            }
          }
        }
        break;
      }
    }
  }
  return [];
}

/**
 * This check assumes that the first free variable checks have passed, and serves
 * only to check that the flattening transformation will produce a well-moded program when
 * functional predicates get flattened out into separate premises, and where functional
 * predicates in new premises have a appropriate number of arguments.
 */
export function checkFunctionalPredicatesInDecl(
  preds: Map<string, number>,
  decl: ParsedDeclaration,
): Issue[] {
  const boundVars = new Set<string>();
  const issues: Issue[] = [];
  for (const premise of decl.premises) {
    for (const pattern of visitTermsInPremises(premise)) {
      issues.push(...checkFunctionalPredicatesInTerm(preds, boundVars, pattern));
    }
    for (const fv of freeVarsPremise(premise)) {
      boundVars.add(fv);
    }
  }
  if (decl.type === 'Rule') {
    for (const pattern of visitSubterms(
      ...decl.conclusion.args,
      ...(decl.conclusion.values ?? []),
    )) {
      issues.push(...checkFunctionalPredicatesInTerm(preds, boundVars, pattern));
    }
  }
  return issues;
}

export function check(decls: ParsedDeclaration[]): {
  errors: Issue[];
  arities: Map<string, number>;
} {
  const arityInfo = checkPropositionArity(decls);
  const errors: Issue[] = arityInfo.issues || [];
  for (const decl of decls) {
    const declErrors = checkFreeVarsInDecl(decl);
    if (declErrors.length === 0 && arityInfo.issues === null) {
      const preds = new Map(Object.entries(arityInfo.arities));
      declErrors.push(...checkFunctionalPredicatesInDecl(preds, decl));
    }
    errors.push(...declErrors);
  }

  return { errors, arities: new Map(Object.entries(arityInfo)) };
}
