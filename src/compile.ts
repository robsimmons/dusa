import { Program, ProgramN } from './bytecode.js';
import { Issue } from './client.js';
import { check as checkImpl } from './language/check.js';
import { compile as compileImpl } from './language/compile.js';
import { parse } from './language/dusa-parser.js';
import { bytecodeToJSON } from './serialize.js';

export class DusaCompileError extends Error {
  issues: Issue[];
  constructor(issues: Issue[]) {
    super();
    this.issues = issues;
  }
}

export function check(source: string): Issue[] | null {
  const parsed = parse(source);
  if (parsed.errors !== null) return parsed.errors;
  const { errors } = checkImpl(parsed.document);
  if (errors.length !== 0) return errors;
  return null;
}

export function compileBig(source: string): Program {
  const parsed = parse(source);
  if (parsed.errors !== null) {
    throw new DusaCompileError(parsed.errors);
  }
  const { errors, arities, builtins, lazy } = checkImpl(parsed.document);
  if (errors.length !== 0) {
    throw new DusaCompileError(errors);
  }

  return compileImpl(builtins, arities, lazy, parsed.document);
}

export function compile(source: string): ProgramN<string | number> {
  return bytecodeToJSON(compileBig(source));
}
