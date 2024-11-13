import { ProgramN as BytecodeProgramN } from './bytecode.js';
import { createSearchState, SearchState } from './engine/forwardengine.js';
import { ingestBytecodeProgram, Program as InternalProgram } from './engine/program.js';
import { check } from './language/check.js';
import { compile } from './language/compile.js';
import { parse } from './language/dusa-parser.js';
import { Issue } from './parsing/parser.js';

export type { Issue, BytecodeProgramN };

export class DusaError extends Error {
  issues: Issue[];
  constructor(issues: Issue[]) {
    super();
    this.issues = issues;
  }
}

export class Dusa {
  private prog: InternalProgram;
  private state: SearchState;

  constructor(source: string | BytecodeProgramN<bigint | string | number>) {
    let bytecodeProgram: BytecodeProgramN<bigint | string | number>;
    if (typeof source === 'string') {
      const parsed = parse(source);
      if (parsed.errors !== null) {
        throw new DusaError(parsed.errors);
      }
      const { errors, arities, builtins } = check(parsed.document);
      if (errors.length !== 0) {
        throw new DusaError(errors);
      }

      bytecodeProgram = compile(builtins, arities, parsed.document);
    } else {
      bytecodeProgram = source;
    }

    this.prog = ingestBytecodeProgram(bytecodeProgram);
    this.state = createSearchState(this.prog);
  }

  /** Push as far as possible with just the forward engine */
  private advance() {}
}

export class DusaIterator implements Iterator<> {}
