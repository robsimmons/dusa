import { binarize, binarizedProgramToString } from './binarize.js';
import { IndexedProgram, indexedProgramToString, indexize } from './indexize.js';
import { Declaration, declToString } from './syntax.js';

export function indexToRuleName(index: number): string {
  if (index >= 26) {
    return `${indexToRuleName(Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`;
  }
  return String.fromCharCode(97 + index);
}

/** Compiles a *checked* program */
export function compile(decls: Declaration[], debug = false): IndexedProgram {
  const named = decls.map<[string, Declaration]>((decl, i) => [indexToRuleName(i), decl]);
  if (debug) {
    console.log(`Form 1: checked program with named declarations
${named.map(([name, decl]) => `${name}: ${declToString(decl)}`).join('\n')}`);
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
