import { Pattern } from './terms.js';
import { Pattern as Shape } from '../bytecode.js';


export function patternsToShapes(
  patterns: Pattern[],
  varsKnown: string[] = [],
): {
  shapes: Shape[];
  varsKnown: string[];
} {
  varsKnown = [...varsKnown];

  function traverse(term: Pattern): Shape {
    if (
      term.type === 'bool' ||
      term.type === 'int' ||
      term.type === 'string' ||
      term.type === 'trivial'
    )
      return term;
    if (term.type === 'const') {
      return { type: 'const', name: term.name, args: term.args.map((arg) => traverse(arg)) };
    }
    if (term.type === 'wildcard') {
      const index = varsKnown.length;
      varsKnown.push(`#anon#${index}`);
      return { type: 'var', ref: index };
    }

    let index = varsKnown.indexOf(term.name);
    if (index === -1) {
      index = varsKnown.length;
      varsKnown.push(term.name);
    }
    return { type: 'var', ref: index };
  }

  return { shapes: patterns.map(traverse), varsKnown };
}

export function shapesToPatterns(args: Shape[]) {
  function traverse(term: Shape): Pattern {
    if (
      term.type === 'bool' ||
      term.type === 'int' ||
      term.type === 'string' ||
      term.type === 'trivial'
    )
      return term;
    if (term.type === 'const') {
      return { type: 'const', name: term.name, args: term.args.map((arg) => traverse(arg)) };
    }
    return { type: 'var', name: `#${term.ref}` };
  }

  return args.map((arg) => traverse(arg));
}

export function shapesEqual(term1: Shape, term2: Shape): boolean {
  if (term1.type === 'trivial') return term2.type === 'trivial';
  if (term1.type === 'bool') return term2.type === 'bool' && term1.value === term2.value;
  if (term1.type === 'int') return term2.type === 'int' && term1.value === term2.value;
  if (term1.type === 'string') return term2.type === 'string' && term1.value === term2.value;
  if (term1.type === 'var') return term2.type === 'var' && term1.ref === term2.ref;
  return (
    term2.type === 'const' &&
    term1.name === term2.name &&
    term1.args.length === term2.args.length &&
    term1.args.every((subterm1, i) => shapesEqual(subterm1, term2.args[i]))
  );
}
