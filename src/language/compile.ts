import { binarize, binarizedProgramToString } from './binarize.js';
import { BUILT_IN_PRED } from './dusa-builtins.js';
import { flattenDecls, flatProgramToString } from './flatten.js';
import { IndexedProgram, indexedProgramToString, indexize } from './indexize.js';
import { ParsedDeclaration, ParsedTopLevel } from './syntax.js';

export function indexToRuleName(index: number): string {
  if (index >= 26) {
    return `${indexToRuleName(Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`;
  }
  return String.fromCharCode(97 + index);
}

/** Compiles a *checked* program */
export function compile(
  builtins: Map<string, BUILT_IN_PRED>,
  arities: Map<string, { args: number; value: boolean }>,
  program: ParsedTopLevel[],
  debug = false,
): IndexedProgram {
  const decls = program.filter((x): x is ParsedDeclaration => x.type !== 'Builtin');

  const flattened = flattenDecls(
    new Map([
      ...[...builtins.entries()].map<[string, BUILT_IN_PRED]>(([name, builtin]) => [name, builtin]),
      ...[...arities.keys()].map<[string, undefined]>((name) => [name, undefined]),
    ]),
    decls,
  );

  const nameMap = new Map();
  function nextName(str: string) {
    const count = nameMap.get(str);
    if (count === undefined) {
      nameMap.set(str, 2);
      return `${str}-1`;
    } else {
      nameMap.set(str, count + 1);
      return `${str}-${count}`;
    }
  }
  const named = flattened.map((decl) => ({
    decl,
    name: decl.type === 'Rule' ? nextName(decl.conclusion.name) : nextName(decl.type),
  }));

  if (debug) {
    console.log(`Form 1: flattened program
${flatProgramToString(named)}`);
  }

  const binarized = binarize(named);
  if (debug) {
    console.log(`\nForm 2: Binarized program
${binarizedProgramToString(binarized)}`);
  }

  const indexed = indexize(binarized);
  if (debug) {
    console.log(`\nForm 3: Index-aware program
${indexedProgramToString(indexed)}`);
  }

  return indexed;
}
