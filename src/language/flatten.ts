import { SourceLocation } from '../parsing/source-location.js';
import { BUILT_IN_PRED } from './dusa-builtins.js';
import {
  Conclusion,
  ParsedDeclaration,
  ParsedPremise,
  ParsedTopLevel,
  freeVarsPremise,
  headToString,
} from './syntax.js';
import { ParsedPattern, Pattern, termToString, theseVarsGroundThisPattern } from './terms.js';

export type FlatPremise = {
  args: Pattern[];
  value: Pattern | null;
  loc: SourceLocation;
} & ({ type: 'builtin'; name: BUILT_IN_PRED } | { type: 'fact'; name: string });

export type FlatDeclaration =
  | { type: 'Forbid'; premises: FlatPremise[]; loc?: SourceLocation }
  | { type: 'Demand'; premises: FlatPremise[]; loc?: SourceLocation }
  | {
      type: 'Rule';
      premises: FlatPremise[];
      conclusion: Conclusion;
      loc?: SourceLocation;
    };

/*
 * The flattening transformation is a relatively naive transformation determining the order in
 * which built-in terms and functional propositions in term position will be sequenced.
 *
 * A functional predicate is required to have only ground arguments, so it's boosted out
 * before the premise:
 *
 *     #demand f X Y, h (plus X Y).
 *       -->
 *     #demand f X Y, plus X Y is Z, h Z
 *
 * These effects stack:
 *
 *    #demand f X Y, g (plus (plus X X) (plus X Y)).
 *      -->
 *    #demand f X Y, plus X X is X2, plus X Y is Z, plus X2 Z is G, g G.
 *
 * Built-in predicates and functional propositions are treated the same way in the flattening
 * transformation, but
 */
function flattenPattern(
  preds: Map<string, undefined | BUILT_IN_PRED>,
  counter: { current: number },
  parsedPattern: ParsedPattern,
): { before: FlatPremise[]; pattern: Pattern } {
  switch (parsedPattern.type) {
    case 'trivial':
    case 'int':
    case 'bool':
    case 'string':
    case 'wildcard':
    case 'var':
      return { before: [], pattern: parsedPattern };
    case 'const': {
      const { before, args } = flattenPatterns(preds, counter, parsedPattern.args);
      if (!preds.has(parsedPattern.name)) {
        return { before, pattern: { type: 'const', name: parsedPattern.name, args } };
      } else {
        const loc = parsedPattern.loc;
        const replacementVar: Pattern = { type: 'var', name: `#${counter.current++}` };
        const builtin = preds.get(parsedPattern.name);
        const newPremise: FlatPremise = builtin
          ? { type: 'builtin', name: builtin, args, value: replacementVar, loc }
          : { type: 'fact', name: parsedPattern.name, args, value: replacementVar, loc };

        return { before: [...before, newPremise], pattern: replacementVar };
      }
    }
  }
}

function flattenPatterns(
  preds: Map<string, undefined | BUILT_IN_PRED>,
  counter: { current: number },
  parsedArgs: ParsedPattern[],
): { before: FlatPremise[]; args: Pattern[] } {
  const before: FlatPremise[] = [];
  const args = [];
  for (const arg of parsedArgs) {
    const sub = flattenPattern(preds, counter, arg);
    before.push(...sub.before);
    args.push(sub.pattern);
  }
  return { before, args };
}

function flattenPremise(
  preds: Map<string, undefined | BUILT_IN_PRED>,
  counter: { current: number },
  premise: ParsedPremise,
): FlatPremise[] {
  switch (premise.type) {
    case 'Proposition': {
      const { before, args } = flattenPatterns(preds, counter, premise.args);
      const valueResult: { pattern: Pattern | null; before: FlatPremise[] } =
        premise.value === null
          ? { pattern: null, before: [] }
          : flattenPattern(preds, counter, premise.value);
      before.push(...valueResult.before);

      const builtin = preds.get(premise.name);
      const loc = premise.loc;
      return [
        ...before,
        builtin
          ? { type: 'builtin', name: builtin, args, value: valueResult.pattern, loc }
          : { type: 'fact', name: premise.name, args, value: valueResult.pattern, loc },
      ];
    }

    case 'Gt':
    case 'Geq':
    case 'Lt':
    case 'Leq':
    case 'Equality':
    case 'Inequality': {
      let builtin: BUILT_IN_PRED;
      let value: Pattern;
      switch (premise.type) {
        case 'Equality':
          builtin = 'EQUAL';
          value = { type: 'trivial' };
          break;
        case 'Inequality':
          builtin = 'NOT_EQUAL';
          value = { type: 'trivial' };
          break;
        case 'Gt':
          builtin = 'CHECK_GT';
          value = { type: 'bool', value: true };
          break;
        case 'Geq':
          builtin = 'CHECK_GEQ';
          value = { type: 'bool', value: true };
          break;
        case 'Lt':
          builtin = 'CHECK_LT';
          value = { type: 'bool', value: true };
          break;
        case 'Leq':
          builtin = 'CHECK_LEQ';
          value = { type: 'bool', value: true };
          break;
      }

      const { before, args } = flattenPatterns(preds, counter, [premise.a, premise.b]);
      return [...before, { type: 'builtin', name: builtin, args, value, loc: premise.loc }];
    }
  }
}

function flattenDecl(
  preds: Map<string, undefined | BUILT_IN_PRED>,
  decl: ParsedDeclaration,
): FlatDeclaration {
  const counter = { current: 1 };
  const premises: FlatPremise[] = [];
  for (const premise of decl.premises) {
    premises.push(...flattenPremise(preds, counter, premise));
  }

  switch (decl.type) {
    case 'Demand':
    case 'Forbid':
      return { type: decl.type, loc: decl.loc, premises };
    case 'Rule': {
      const args: Pattern[] = decl.conclusion.args.map((arg) => {
        const result = flattenPattern(preds, counter, arg);
        premises.push(...result.before);
        return result.pattern;
      });
      switch (decl.conclusion.type) {
        case 'datalog':
          return {
            type: 'Rule',
            premises,
            conclusion: {
              name: decl.conclusion.name,
              args,
              type: 'datalog',
              loc: decl.conclusion.loc,
            },
          };
        case 'open':
        case 'closed':
          const values: Pattern[] = [];
          for (const value of decl.conclusion.values) {
            const result = flattenPattern(preds, counter, value);
            values.push(result.pattern);
            premises.push(...result.before);
          }
          return {
            type: 'Rule',
            premises,
            conclusion: {
              name: decl.conclusion.name,
              args,
              type: decl.conclusion.type,
              values,
              loc: decl.conclusion.loc,
            },
          };
      }
    }
  }
}

export function flattenDecls(
  preds: Map<string, undefined | BUILT_IN_PRED>,
  decls: ParsedTopLevel[],
): FlatDeclaration[] {
  return decls
    .filter((decl): decl is ParsedDeclaration => decl.type !== 'Builtin')
    .map((decl) => flattenDecl(preds, decl));
}


export function flatPremiseToString(premise: FlatPremise) {
  const args = premise.args.map((arg) => termToString(arg));
  const value = premise.value === null ? '' : ` is ${termToString(premise.value)}`;
  return `${premise.type === 'builtin' ? '.' : ''}${premise.name}${args.map((arg) => ` ${arg}`).join('')}${value}`;
}

export function flatDeclToString(decl: FlatDeclaration) {
  const premises = decl.premises.map(flatPremiseToString).join(', ');
  switch (decl.type) {
    case 'Forbid':
      return `#forbid ${premises}.`;
    case 'Demand':
      return `#demand ${premises}.`;
    case 'Rule':
      if (decl.premises.length === 0) {
        return `${headToString(decl.conclusion)}.`;
      }
      return `${headToString(decl.conclusion)} :- ${premises}.`;
  }
}

/*
export function flatProgramToString(flatProgram: [string, FlatDeclaration][]) {
  return flatProgram.map(flatDeclToString).join('\n');
}
*/
