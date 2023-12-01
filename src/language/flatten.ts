import { SourceLocation } from '../parsing/source-location.js';
import { checkPropositionArity } from './check.js';
import { BUILT_IN_PRED } from './dusa-builtins.js';
import {
  Conclusion,
  ParsedDeclaration,
  ParsedPremise,
  freeVarsPremise,
  headToString,
} from './syntax.js';
import { ParsedPattern, Pattern, termToString, theseVarsGroundThisPattern } from './terms.js';

export interface FlatProposition {
  type: 'Proposition';
  name: string;
  args: Pattern[];
  value: Pattern;
  loc: SourceLocation;
}

export interface BuiltinProposition {
  type: 'Builtin';
  name: BUILT_IN_PRED;
  symbol: null | string;
  matchPosition: null | number;
  args: Pattern[];
  value: Pattern;
  loc: SourceLocation;
}

export type FlatPremise = FlatProposition | BuiltinProposition;

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
 * The flattening transformation picks the order in which built-in terms and which functonal
 * propositions in term position will be sequenced, and also turns syntactically supported
 * built-ins (like == and !=) into their supported form as built-in functional propositions.
 *
 * This is relatively straightforward for built-ins where all arguments are grounded by the
 * time the built-in is encountered: the function calls will be placed immediately prior to
 * the premise.
 *
 * In this example:
 *
 *     #demand f X, g (s (s X)) Y, h X (s Y).
 *
 * This needs to get flattend to:
 *
 *     #demand f X, s X is #1, s #1 is #2, g #2 Y, s Y is #3, h X #3.
 *
 * However, some built-in functions (NAT_SUCC, INT_PLUS, INT_MINUS, STRING_CONCAT) allow for
 * a distinguished "match" argument that can be resolved afterwards. In those cases, the
 *
 *     #demand f Y, g (s (s X)) Y, h X (s Z).
 *
 * This needs to get transformed to:
 *
 *     #demand f X, g #1 is Y, s |#2| is #1, s |X| is #2, h X #3, s |Z| is #3.
 *
 * to allow the checks to be run after the fact. (The pipes are used here to offset the
 * argument in the distinguished match location.)
 */

/**
 * When a pattern is grounded, we want to run any built-in functions or check
 * any functional predicates before trying to calculate the ground term.
 */
function flattenGroundPattern(
  preds: Set<string>,
  counter: { current: number },
  parsedPattern: ParsedPattern,
): { before: FlatPremise[]; pattern: Pattern } {
  switch (parsedPattern.type) {
    case 'triv':
    case 'int':
    case 'bool':
    case 'string':
    case 'wildcard': // Impossible
    case 'var':
      return { before: [], pattern: parsedPattern };
    case 'const':
    case 'special': {
      const before: FlatPremise[] = [];
      const args = [];
      for (let arg of parsedPattern.args) {
        const sub = flattenGroundPattern(preds, counter, arg);
        before.push(...sub.before);
        args.push(sub.pattern);
      }
      if (parsedPattern.type === 'special' || preds.has(parsedPattern.name)) {
        const replacementVar = `#${counter.current++}`;
        before.push(
          parsedPattern.type === 'special'
            ? {
                type: 'Builtin',
                name: parsedPattern.name,
                symbol: parsedPattern.symbol,
                args,
                value: { type: 'var', name: replacementVar },
                matchPosition: null,
                loc: parsedPattern.loc,
              }
            : {
                type: 'Proposition',
                name: parsedPattern.name,
                args,
                value: { type: 'var', name: replacementVar },
                loc: parsedPattern.loc,
              },
        );
        return { before, pattern: { type: 'var', name: replacementVar } };
      }
      return { before, pattern: { type: 'const', name: parsedPattern.name, args } };
    }
  }
}

/**
 * When a pattern is definitely NOT grounded and we encounter a (supported) functional
 * predicate or a built-in, we replace the term with a new variable and do remaining
 * matching later.
 */
function flattenNonGroundPattern(
  preds: Set<string>,
  counter: { current: number },
  boundVars: Set<string>,
  parsedPattern: ParsedPattern,
): { before: FlatPremise[]; after: FlatPremise[]; pattern: Pattern } {
  switch (parsedPattern.type) {
    case 'triv':
    case 'int':
    case 'bool':
    case 'string':
    case 'wildcard':
    case 'var':
      return { before: [], after: [], pattern: parsedPattern };
    case 'const': {
      const before: FlatPremise[] = [];
      const after: FlatPremise[] = [];
      const args = [];
      for (const arg of parsedPattern.args) {
        if (theseVarsGroundThisPattern(boundVars, arg)) {
          const sub = flattenGroundPattern(preds, counter, arg);
          before.push(...sub.before);
          args.push(sub.pattern);
        } else {
          const sub = flattenNonGroundPattern(preds, counter, boundVars, arg);
          before.push(...sub.before);
          after.push(...sub.after);
          args.push(sub.pattern);
        }
      }
      return { before, after, pattern: { type: 'const', name: parsedPattern.name, args } };
    }
    case 'special': {
      // Exactly one of the subterms must be non-ground
      const nonGroundIndex = parsedPattern.args.findIndex(
        (arg) => !theseVarsGroundThisPattern(boundVars, arg),
      );
      const replacementVar = `#${counter.current++}`;
      const nonGroundVar = `#${counter.current++}`;
      const before: FlatPremise[] = [];
      const args: Pattern[] = [];
      for (const [i, arg] of parsedPattern.args.entries()) {
        if (i !== nonGroundIndex) {
          const sub = flattenGroundPattern(preds, counter, arg);
          args.push(sub.pattern);
          before.push(...sub.before);
        } else {
          args.push({ type: 'var', name: nonGroundVar });
        }
      }
      const nonGroundPattern = parsedPattern.args[nonGroundIndex];
      const sub = flattenNonGroundPattern(preds, counter, boundVars, nonGroundPattern);
      return {
        pattern: { type: 'var', name: replacementVar },
        before,
        after: [
          ...sub.before,
          {
            type: 'Builtin',
            name: parsedPattern.name,
            symbol: parsedPattern.symbol,
            args,
            value: { type: 'var', name: replacementVar },
            matchPosition: nonGroundIndex,
            loc: parsedPattern.loc,
          },
          ...sub.after,
        ],
      };
    }
  }
}

function flattenPattern(
  preds: Set<string>,
  counter: { current: number },
  boundVars: Set<string>,
  pattern: ParsedPattern,
): { pattern: Pattern; before: FlatPremise[]; after: FlatPremise[] } {
  if (theseVarsGroundThisPattern(boundVars, pattern)) {
    return { ...flattenGroundPattern(preds, counter, pattern), after: [] };
  } else {
    return flattenNonGroundPattern(preds, counter, boundVars, pattern);
  }
}

function flattenPremise(
  preds: Set<string>,
  counter: { current: number },
  boundVars: Set<string>,
  premise: ParsedPremise,
): FlatPremise[] {
  switch (premise.type) {
    case 'Proposition': {
      const before: FlatPremise[] = [];
      const after: FlatPremise[] = [];
      const args: Pattern[] = [];
      for (const arg of premise.args) {
        const argResult = flattenPattern(preds, counter, boundVars, arg);
        before.push(...argResult.before);
        after.push(...argResult.after);
        args.push(argResult.pattern);
      }
      const valueResult: { pattern: Pattern; before: FlatPremise[]; after: FlatPremise[] } =
        premise.value === null
          ? { pattern: { type: 'triv' }, before: [], after: [] }
          : flattenPattern(preds, counter, boundVars, premise.value);
      before.push(...valueResult.before);
      after.push(...valueResult.after);
      return [
        ...before,
        {
          type: 'Proposition',
          name: premise.name,
          args,
          value: valueResult.pattern,
          loc: premise.loc,
        },
        ...after,
      ];
    }
    case 'Equality':
    case 'Inequality': {
      const matchPosition = theseVarsGroundThisPattern(boundVars, premise.a) ? 1 : 0;
      const aResult = flattenPattern(preds, counter, boundVars, premise.a);
      const bResult = flattenPattern(preds, counter, boundVars, premise.b);
      return [
        ...aResult.before,
        ...bResult.before,
        {
          type: 'Builtin',
          name: 'EQUAL',
          symbol: null,
          args: [aResult.pattern, bResult.pattern],
          value: { type: 'bool', value: premise.type === 'Equality' },
          matchPosition: matchPosition,
          loc: premise.loc,
        },
        ...aResult.after,
        ...bResult.after,
      ];
    }
  }
}

function flattenDecl(preds: Set<string>, decl: ParsedDeclaration): FlatDeclaration {
  const counter = { current: 1 };
  const boundVars = new Set<string>();
  const premises: FlatPremise[] = [];
  for (const premise of decl.premises) {
    premises.push(...flattenPremise(preds, counter, boundVars, premise));
    for (const v of freeVarsPremise(premise)) {
      boundVars.add(v);
    }
  }

  switch (decl.type) {
    case 'Demand':
    case 'Forbid':
      return { type: decl.type, loc: decl.loc, premises };
    case 'Rule': {
      const args: Pattern[] = [];
      for (const arg of decl.conclusion.args) {
        const result = flattenGroundPattern(preds, counter, arg);
        args.push(result.pattern);
        premises.push(...result.before);
      }
      let values: Pattern[] = [];
      if (decl.conclusion.values === null) {
        values.push({ type: 'triv' });
      } else {
        for (const value of decl.conclusion.values) {
          const result = flattenGroundPattern(preds, counter, value);
          values.push(result.pattern);
          premises.push(...result.before);
        }
      }
      return {
        type: 'Rule',
        premises,
        conclusion: {
          name: decl.conclusion.name,
          args,
          values,
          exhaustive: decl.conclusion.exhaustive,
          loc: decl.conclusion.loc,
        },
        loc: decl.loc,
      };
    }
  }
}

export function indexToRuleName(index: number): string {
  if (index >= 26) {
    return `${indexToRuleName(Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`;
  }
  return String.fromCharCode(97 + index);
}

export function flattenAndName(decls: ParsedDeclaration[]): [string, FlatDeclaration][] {
  const arityInfo = checkPropositionArity(decls);
  if (arityInfo.issues !== null) {
    throw new Error('Invariant violation: flattenAndName called with bad program');
  }
  const preds = new Set(Object.keys(arityInfo.arities));

  const flatDecls: [string, FlatDeclaration][] = [];
  for (const [index, decl] of decls.entries()) {
    flatDecls.push([indexToRuleName(index), flattenDecl(preds, decl)]);
  }
  return flatDecls;
}

export function flatPremiseToString(premise: FlatPremise) {
  const args = premise.args.map((arg) => termToString(arg));
  const value = termToString(premise.value);
  switch (premise.type) {
    case 'Builtin': {
      if (premise.matchPosition !== null) {
        args[premise.matchPosition] = `|${args[premise.matchPosition]}|`;
      }
      const name = premise.symbol === null ? premise.name : `${premise.symbol}/${premise.name}`;
      return `${name}${args.map((arg) => ` ${arg}`).join('')} is ${value}`;
    }
    case 'Proposition': {
      return `${premise.name}${args.map((arg) => ` ${arg}`).join('')} is ${value}`;
    }
  }
}

export function flatDeclToString([name, decl]: [string, FlatDeclaration]) {
  const premises = decl.premises.map(flatPremiseToString).join(', ');
  switch (decl.type) {
    case 'Forbid':
      return `${name}: #forbid ${premises}.`;
    case 'Demand':
      return `${name}: #forbid ${premises}.`;
    case 'Rule':
      if (decl.premises.length === 0) {
        return `${name}: ${headToString(decl.conclusion)}.`;
      }
      return `${name}: ${headToString(decl.conclusion)} :- ${premises}.`;
  }
}

export function flatProgramToString(flatProgram: [string, FlatDeclaration][]) {
  return flatProgram.map(flatDeclToString).join('\n');
}
