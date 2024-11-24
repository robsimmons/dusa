import { Pattern } from '../bytecode.js';
import { Data, HashCons } from '../datastructures/data.js';
import { CPattern } from './program.js';

export function match(data: HashCons, mutableSubst: Data[], pattern: Pattern, term: Data): boolean {
  if (pattern.type === 'var') {
    if (pattern.ref === mutableSubst.length) {
      mutableSubst.push(term);
      return true;
    } else {
      return mutableSubst[pattern.ref] === term;
    }
  }

  const view = data.expose(term);
  switch (pattern.type) {
    case 'trivial':
      return view.type === 'trivial';
    case 'int':
    case 'string':
    case 'bool':
      return view.type === pattern.type && view.value === pattern.value;
    case 'const':
      return (
        view.type === pattern.type &&
        view.name === pattern.name &&
        view.args.length === pattern.args.length &&
        view.args.every((subTerm, i) => match(data, mutableSubst, pattern.args[i], subTerm))
      );
  }
}

export function apply(
  data: HashCons,
  subst: Data[],
  pattern: CPattern,
  passed: Data[] = [],
  passedOffset: number = 0,
  introduced: Data[] = [],
  introducedOffset: number = 0,
): Data {
  switch (pattern.type) {
    case 'var':
      return subst[pattern.ref];
    case 'intro':
      return introduced[pattern.ref + introducedOffset];
    case 'pass':
      return passed[pattern.ref + passedOffset];
    case 'trivial':
    case 'bool':
    case 'string':
    case 'int':
      return data.hide(pattern);
    case 'const':
      return data.hide({
        type: 'const',
        name: pattern.name,
        args: pattern.args.map((arg) =>
          apply(data, subst, arg, passed, passedOffset, introduced, introducedOffset),
        ),
      });
  }
}
