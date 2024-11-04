import { Pattern } from '../bytecode.js';
import { Data, HashCons } from '../datastructures/data.js';

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

export function apply(data: HashCons, subst: Data[], pattern: Pattern): Data {
  switch (pattern.type) {
    case 'var':
      return subst[pattern.ref];
    case 'trivial':
    case 'bool':
    case 'string':
    case 'int':
      return data.hide(pattern);
    case 'const':
      return data.hide({
        type: 'const',
        name: pattern.name,
        args: pattern.args.map((arg) => apply(data, subst, arg)),
      });
  }
}
