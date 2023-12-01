import { binarize, binarizedProgramToString } from './binarize.js';
import { flatProgramToString, flattenAndName } from './flatten.js';
import { IndexedProgram, indexedProgramToString, indexize } from './indexize.js';
import { Declaration, ParsedDeclaration, declToString } from './syntax.js';

export function indexToRuleName(index: number): string {
  if (index >= 26) {
    return `${indexToRuleName(Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`;
  }
  return String.fromCharCode(97 + index);
}

/** Compiles a *checked* program */
export function compile(decls: ParsedDeclaration[], debug = false): IndexedProgram {
  const flattened = flattenAndName(decls);
  if (debug) {
    console.log(`Form 1: flattened program
${flatProgramToString(flattened)}`);
  }

  const binarized = binarize(flattened);
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
