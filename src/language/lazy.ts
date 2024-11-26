import { FlatDeclaration, FlatPremise } from './flatten.js';

function toLazyPred(str: string) {
  return `$lazy$demand$${str}`;
}

function transformLazyDecl(lazy: Set<string>, decl: FlatDeclaration): FlatDeclaration[] {
  const premises: FlatPremise[] = [...decl.premises];
  if (decl.type === 'Rule' && lazy.has(decl.conclusion.name)) {
    premises.unshift({
      type: 'fact',
      name: toLazyPred(decl.conclusion.name),
      value: null,
      args: decl.conclusion.args,
      loc: decl.loc,
    });
  }

  const result: FlatDeclaration[] = [{ ...decl, premises }];

  for (const [i, prem] of premises.entries()) {
    if (prem.type === 'fact' && lazy.has(prem.name)) {
      result.push({
        type: 'Rule',
        premises: premises.slice(0, i),
        conclusion: { type: 'datalog', name: toLazyPred(prem.name), args: prem.args },
      });
    }
  }
  return result;
}

export function transformLazy(lazy: Set<string>, decls: FlatDeclaration[]): FlatDeclaration[] {
  return decls.flatMap((decl) => transformLazyDecl(lazy, decl));
}
