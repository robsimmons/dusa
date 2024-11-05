import { Issue } from '../parsing/parser.js';
import { SourceLocation } from '../parsing/source-location.js';
import { BUILT_IN_PRED, BuiltinMode } from './dusa-builtins.js';
import {
  ParsedBuiltin,
  ParsedDeclaration,
  ParsedTopLevel,
  visitPropsInProgram,
  visitTermsInDecl,
} from './syntax.js';
import { ParsedPattern, termToString, theseVarsGroundThisPattern } from './terms.js';

function mkErr(msg: string, loc: SourceLocation): Issue {
  return { type: 'Issue', severity: 'error', msg, loc };
}

/** Ensures that a relation is used consistently throughout a program */
function checkPropositionArity(
  builtins: Map<string, BUILT_IN_PRED>,
  decls: (Issue | ParsedDeclaration)[],
): { issues: Issue[]; arities: Map<string, { args: number; value: boolean }> } {
  const issues: Issue[] = [];

  const first: Map<string, SourceLocation> = new Map();
  const arities: Map<string, { args: number; value: boolean }> = new Map();
  for (const prop of visitPropsInProgram(decls)) {
    if (builtins.has(prop.name)) continue;

    const args = prop.args.length;
    const value =
      prop.type !== 'datalog' &&
      (prop.type === 'open' ||
        prop.type === 'closed' ||
        (prop.type === 'Proposition' && prop.value !== null));

    const stored = arities.get(prop.name);
    if (!stored) {
      first.set(prop.name, prop.loc);
      arities.set(prop.name, { args, value });
    } else if (value !== stored.value) {
      issues.push(
        mkErr(
          `First occurrence of '${prop.name}' (on line ${first.get(prop.name)!.start.line}) ${stored.value ? 'does' : 'does not'} have an associated value, but this occurrence ${value ? 'does' : 'does not'}.`,
          prop.loc,
        ),
      );
    } else if (args !== stored.args) {
      issues.push(
        mkErr(
          `First occurrence of '${prop.name}' (on line ${first.get(prop.name)!.start.line}) has ${stored.args} argument${stored.args === 1 ? '' : 's'}, but this occurrence has ${args}.`,
          prop.loc,
        ),
      );
    }
  }
  return { issues, arities };
}

/** Ensures that we can treat all wildcards just as if the programmer had written "_" */
function checkForUniqueWildcardsInDecl(decl: ParsedDeclaration): Issue[] {
  const errors: Issue[] = [];
  const knownWildcards = new Map<string, SourceLocation>();

  for (const term of visitTermsInDecl(decl)) {
    if (term.type === 'wildcard' && term.name !== null) {
      const prev = knownWildcards.get(term.name);
      if (prev === undefined) {
        knownWildcards.set(term.name, term.loc);
      } else {
        errors.push(
          mkErr(
            `The wildcard '${term.name}' was already used in this rule (line ${prev.start.line}, column ${prev.start.column}). Named wildcards can't be repeated within a rule.`,
            term.loc,
          ),
        );
      }
    }
  }

  return errors;
}

/** Descends into terms to find any incorrect uses of functional predicates in these patterns */
function checkRelationsAndBuiltinsInPatterns(
  builtinModes: (builtin: BUILT_IN_PRED) => (mode: BuiltinMode) => boolean,
  builtins: Map<string, BUILT_IN_PRED>,
  arities: Map<string, { args: number; value: boolean }>,
  previouslyGroundVars: Map<string, SourceLocation>,
  terms: ParsedPattern[],
): Issue[] {
  return (<Issue[]>[]).concat(
    ...terms.map<Issue[]>((term) =>
      checkRelationsAndBuiltinsInPattern(
        builtinModes,
        builtins,
        arities,
        previouslyGroundVars,
        term,
      ),
    ),
  );
}

/** Descends into terms to find any incorrect uses of functional predicates in this pattern */
function checkRelationsAndBuiltinsInPattern(
  builtinModes: (builtin: BUILT_IN_PRED) => (mode: BuiltinMode) => boolean,
  builtins: Map<string, BUILT_IN_PRED>,
  arities: Map<string, { args: number; value: boolean }>,
  previouslyGroundVars: Map<string, SourceLocation>,
  term: ParsedPattern,
): Issue[] {
  switch (term.type) {
    case 'bool':
    case 'int':
    case 'string':
    case 'trivial':
    case 'var':
    case 'wildcard':
      return [];
    case 'const': {
      const builtin = builtins.get(term.name);
      const arity = arities.get(term.name);
      if (!builtin && !arity) {
        return checkRelationsAndBuiltinsInPatterns(
          builtinModes,
          builtins,
          arities,
          previouslyGroundVars,
          term.args,
        );
      } else {
        if (!theseVarsGroundThisPattern(previouslyGroundVars, term)) {
          return [
            mkErr(
              `Because ${term.name} is ${builtin ? `the built-in relation ${builtin}` : 'a predicate in your program'}, for it to be used like a function symbol, all the arguments must be grounded by a previous premise. If you want to use ${term.name} with a different mode, write it out as a separate premise, like '${term.name} ${term.args
                .map(() => '* ')
                .join('')}is *'.`,
              term.loc,
            ),
          ];
        }
        if (builtin) {
          return builtinModes(builtin)({ args: term.args.map(() => 'input'), value: 'output' })
            ? []
            : [
                mkErr(
                  `The built-in relation ${builtin} can't be called with ${term.args.length} argument${term.args.length === 1 ? '' : 's'}.`,
                  term.loc,
                ),
              ];
        }
        if (!arity?.value) {
          return [
            mkErr(
              `The relation ${term.name} can't be used in a term position like this, as it does not have a value.`,
              term.loc,
            ),
          ];
        }
        if (arity.args !== term.args.length) {
          return [
            mkErr(
              `The relation ${term.name} has ${arity.args} argument${arity.args === 1 ? '' : 's'}, but only ${term.args.length} arguments were given here.`,
              term.loc,
            ),
          ];
        }
        return [];
      }
    }
  }
}

/** Descends into terms to find all wildcards in these patterns */
function getWildcardsInPatterns(
  builtins: Map<string, BUILT_IN_PRED>,
  arities: Map<string, { args: number; value: boolean }>,
  terms: ParsedPattern[],
): SourceLocation[] {
  return (<SourceLocation[]>[]).concat(
    ...terms.map((term) => getWildcardsInPattern(builtins, arities, term)),
  );
}

/** Descends into terms to find all wildcards in this pattern */
function getWildcardsInPattern(
  builtins: Map<string, BUILT_IN_PRED>,
  arities: Map<string, { args: number; value: boolean }>,
  term: ParsedPattern,
): SourceLocation[] {
  switch (term.type) {
    case 'bool':
    case 'int':
    case 'string':
    case 'trivial':
    case 'var':
      return [];
    case 'wildcard':
      return [term.loc];
    case 'const': {
      if (builtins.has(term.name) || arities.has(term.name)) {
        return [];
      }
      return getWildcardsInPatterns(builtins, arities, term.args);
    }
  }
}

/** Descends into terms to find all variables that will be bound by matching these patterns */
function getNewlyBoundVarsInPatterns(
  builtins: Map<string, BUILT_IN_PRED>,
  arities: Map<string, { args: number; value: boolean }>,
  previouslyGroundVars: Map<string, SourceLocation>,
  terms: ParsedPattern[],
): [string, SourceLocation][] {
  return (<[string, SourceLocation][]>[]).concat(
    ...terms.map((term) =>
      getNewlyBoundVarsInPattern(builtins, arities, previouslyGroundVars, term),
    ),
  );
}

/** Descends into terms to find all variables that will be bound by matching this pattern */
function getNewlyBoundVarsInPattern(
  builtins: Map<string, BUILT_IN_PRED>,
  arities: Map<string, { args: number; value: boolean }>,
  previouslyGroundVars: Map<string, SourceLocation>,
  term: ParsedPattern,
): [string, SourceLocation][] {
  switch (term.type) {
    case 'bool':
    case 'int':
    case 'string':
    case 'trivial':
    case 'wildcard':
      return [];
    case 'var':
      return previouslyGroundVars.has(term.name) ? [] : [[term.name, term.loc]];
    case 'const': {
      if (builtins.has(term.name) || arities.has(term.name)) {
        return [];
      }
      return getNewlyBoundVarsInPatterns(builtins, arities, previouslyGroundVars, term.args);
    }
  }
}

function checkBuiltin(
  builtinModes: (builtin: BUILT_IN_PRED) => (mode: BuiltinMode) => boolean,
  builtins: Map<string, BUILT_IN_PRED>,
  arities: Map<string, { args: number; value: boolean }>,
  previouslyGroundVars: Map<string, SourceLocation>,
  builtin: BUILT_IN_PRED,
  args: ParsedPattern[],
  value: null | ParsedPattern,
  loc: SourceLocation,
) {
  const argsMode = args.map<'input' | 'wildcards' | 'output'>((arg) => {
    const wildcards = getWildcardsInPattern(builtins, arities, arg);
    const newlyBound = getNewlyBoundVarsInPattern(builtins, arities, previouslyGroundVars, arg);
    if (wildcards.length === 0 && newlyBound.length === 0) return 'input';
    if (newlyBound.length === 0) return 'wildcards';
    return 'output';
  });
  const valueMode: 'input' | 'output' =
    value === null
      ? 'input'
      : theseVarsGroundThisPattern(previouslyGroundVars, value)
        ? 'input'
        : 'output';
  if (builtinModes(builtin)({ args: argsMode, value: valueMode })) return [];

  const argsNotGround = argsMode
    .map<number | null>((arg, index) => (arg === 'input' ? null : index + 1))
    .filter((x): x is number => x !== null);
  const generallyWhere =
    argsNotGround.length === 0
      ? 'the output contains'
      : `the argument${argsNotGround.length === 1 ? '' : 's'} in position${argsNotGround.length === 1 ? '' : 's'} ${argsNotGround.length === 1 ? argsNotGround[0] : argsNotGround.length === 2 ? `${argsNotGround[0]} and ${argsNotGround[1]}` : `${argsNotGround.slice(0, argsNotGround.length - 1).join(', ')}, and ${argsNotGround[argsNotGround.length - 1]}`}${valueMode === 'input' ? '' : ', as well as the output,'} ${argsNotGround.length === 1 && valueMode === 'input' ? 'contains' : 'contain'}`;
  return [
    mkErr(
      `The built-in relation ${builtin} was given ${argsMode.length} argument${argsMode.length === 1 ? '' : 's'}, and ${generallyWhere} variables not bound by previous premises. This builtin does not support that mode of operation.`,
      loc,
    ),
  ];
}

export function check(
  builtinModes: (builtin: BUILT_IN_PRED) => (mode: BuiltinMode) => boolean,
  program: ParsedTopLevel[],
): {
  errors: Issue[];
  builtins: Map<string, BUILT_IN_PRED>;
  arities: Map<string, { args: number; value: boolean }>;
} {
  const builtins = new Map<string, BUILT_IN_PRED>(
    program
      .filter((decl): decl is ParsedBuiltin => decl.type === 'Builtin')
      .map<[string, BUILT_IN_PRED]>(({ name, builtin }) => [name, builtin]),
  );

  const decls = program.filter((decl): decl is ParsedDeclaration => decl.type !== 'Builtin');
  const arities = checkPropositionArity(builtins, decls);
  if (arities.issues.length > 0) {
    return { errors: arities.issues, builtins: builtins, arities: arities.arities };
  }

  const errors: Issue[] = [];

  checkDecl: for (const decl of decls) {
    const wildcardsInDeclIssues = checkForUniqueWildcardsInDecl(decl);
    errors.push(...wildcardsInDeclIssues);
    if (wildcardsInDeclIssues.length > 0) continue;
    const groundVars = new Map();

    /* For each premise: call checkBuiltin if applicable, call checkRelationsAndBuiltinsInPatterns,
     * and then register any new variables as bound. */
    for (const premise of decl.premises) {
      // There are many different configurations where we need to check the properties
      // of builtins: consolidating the arguments to checkBuiltin makes this much simpler
      // eslint-disable-next-line no-inner-declarations
      function checkBuiltinHelper(
        builtin: BUILT_IN_PRED,
        args: ParsedPattern[],
        value: null | ParsedPattern,
      ) {
        errors.push(
          ...checkBuiltin(
            builtinModes,
            builtins,
            arities.arities,
            groundVars,
            builtin,
            args,
            value,
            premise.loc,
          ),
        );
      }

      switch (premise.type) {
        case 'Proposition': {
          const builtin = builtins.get(premise.name);
          if (builtin === undefined) break;
          if (premise.value === null) {
            errors.push(
              mkErr(
                `The built-in relation ${builtin} needs to be given a value. If you don't care what the value is, you can just say '${premise.name} ${premise.args.map((arg) => termToString(arg, true) + ' ').join('')}is _'.`,
                premise.loc,
              ),
            );
            break;
          }
          checkBuiltinHelper(builtin, premise.args, premise.value);
          break;
        }

        case 'Geq':
          checkBuiltinHelper('CHECK_GEQ', [premise.a, premise.b], null);
          break;
        case 'Gt':
          checkBuiltinHelper('CHECK_GT', [premise.a, premise.b], null);
          break;
        case 'Leq':
          checkBuiltinHelper('CHECK_LEQ', [premise.a, premise.b], null);
          break;
        case 'Lt':
          checkBuiltinHelper('CHECK_LT', [premise.a, premise.b], null);
          break;
        case 'Inequality':
          checkBuiltinHelper('NOT_EQUAL', [premise.a, premise.b], null);
          break;
        case 'Equality':
          checkBuiltinHelper('EQUAL', [premise.a, premise.b], null);
          break;
      }

      /* Check relations and built-ins */
      let patterns: ParsedPattern[];
      switch (premise.type) {
        case 'Proposition': {
          patterns = premise.value === null ? premise.args : [...premise.args, premise.value];
          break;
        }
        case 'Equality':
        case 'Inequality':
        case 'Geq':
        case 'Gt':
        case 'Leq':
        case 'Lt': {
          patterns = [premise.a, premise.b];
          break;
        }
      }
      errors.push(
        ...checkRelationsAndBuiltinsInPatterns(
          builtinModes,
          builtins,
          arities.arities,
          groundVars,
          patterns,
        ),
      );

      /* Add newly bound variables */
      for (const [v, loc] of getNewlyBoundVarsInPatterns(
        builtins,
        arities.arities,
        groundVars,
        patterns,
      )) {
        groundVars.set(v, loc);
      }
    }

    /* Check conclusion */
    switch (decl.type) {
      case 'Demand':
      case 'Forbid':
        break;
      case 'Rule': {
        let patterns: ParsedPattern[];
        if (builtins.has(decl.conclusion.name)) {
          errors.push(
            mkErr(
              `You can't use a rule to extend the built-in relation ${builtins.get(decl.conclusion.name)}.`,
              decl.conclusion.loc,
            ),
          );
          continue checkDecl;
        }

        switch (decl.conclusion.type) {
          case 'datalog':
            patterns = decl.conclusion.args;
            break;
          case 'closed':
          case 'open':
            patterns = [...decl.conclusion.args, ...decl.conclusion.choices];
        }

        errors.push(
          ...checkRelationsAndBuiltinsInPatterns(
            builtinModes,
            builtins,
            arities.arities,
            groundVars,
            patterns,
          ),
        );

        errors.push(
          ...getNewlyBoundVarsInPatterns(builtins, arities.arities, groundVars, patterns).map(
            ([varName, loc]) =>
              mkErr(
                `The variable '${varName}' can't be used in the conclusion of a rule without being used somewhere in a premise.`,
                loc,
              ),
          ),
        );

        errors.push(
          ...getWildcardsInPatterns(builtins, arities.arities, patterns).map((loc) =>
            mkErr(`Wildcards can't be used in the conclusion of a rule.`, loc),
          ),
        );
      }
    }
  }

  return { errors, builtins, arities: arities.arities };
}
