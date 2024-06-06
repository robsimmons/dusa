import { Data, expose, hide } from '../datastructures/data.js';
import { Pattern } from '../language/terms.js';

export type Substitution = { [varName: string]: Data };

export function match(
  substitution: Substitution,
  pattern: Pattern,
  data: Data,
): null | Substitution {
  const dv = expose(data);
  switch (pattern.type) {
    case 'trivial':
      if (pattern.type !== dv.type) return null;
      return substitution;
    case 'int':
      if (dv.type !== 'int') return null;
      if (BigInt(pattern.value) !== dv.value) return null;
      return substitution;
    case 'string':
    case 'bool':
      if (pattern.type !== dv.type) return null;
      if (pattern.value !== dv.value) return null;
      return substitution;

    case 'const':
      if (dv.type !== 'const' || pattern.name !== dv.name || pattern.args.length !== dv.args.length)
        return null;
      for (let i = 0; i < pattern.args.length; i++) {
        const candidate = match(substitution, pattern.args[i], dv.args[i]);
        if (candidate === null) return null;
        substitution = candidate;
      }
      return substitution;

    case 'wildcard':
      return substitution;

    case 'var':
      if (substitution[pattern.name] !== undefined) {
        return equal(substitution[pattern.name], data) ? substitution : null;
      }
      return { [pattern.name]: data, ...substitution };
  }
}

export function apply(substitution: Substitution, pattern: Pattern): Data {
  switch (pattern.type) {
    case 'trivial':
    case 'bool':
    case 'string': {
      return hide(pattern);
    }
    case 'int':
      return hide({ type: 'int', value: BigInt(pattern.value) });

    case 'const': {
      return hide({
        type: 'const',
        name: pattern.name,
        args: pattern.args.map((arg) => apply(substitution, arg)),
      });
    }

    case 'wildcard': {
      throw new Error(`Cannot match apply a substitution to a pattern containing the wildcard '_'`);
    }

    case 'var': {
      const result = substitution[pattern.name];
      if (result == null) {
        throw new Error(
          `Free variable '${pattern.name}' not assigned to in grounding substitution`,
        );
      }
      return result;
    }
  }
}

export function equal(t: Data, s: Data): boolean {
  return t === s;
}
