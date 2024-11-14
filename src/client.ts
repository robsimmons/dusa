import { ProgramN as BytecodeProgramN } from './bytecode.js';
import { DusaSolution } from './client-old.js';
import { Data } from './datastructures/data.js';
import { Database } from './datastructures/database.js';
import { ChoiceTree, ChoiceZipper } from './engine/choiceengine.js';
import { createSearchState, SearchState } from './engine/forwardengine.js';
import { ingestBytecodeProgram, Program as InternalProgram } from './engine/program.js';
import { check } from './language/check.js';
import { compile } from './language/compile.js';
import { parse } from './language/dusa-parser.js';
import { Issue } from './parsing/parser.js';
import { dataToTerm, InputTerm, Term, termToData } from './termoutput.js';

export type { Issue, BytecodeProgramN };

export class DusaError extends Error {
  issues: Issue[];
  constructor(issues: Issue[]) {
    super();
    this.issues = issues;
  }
}

export class DusaRuntimeError extends Error {
  constructor(msg: string) {
    super(msg);
  }
}

export class Dusa {
  private prog: InternalProgram;
  private state: SearchState | null;
  private defaultIterator: DusaInterator;

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
    this.defaultIterator = new DusaIteratorImpl();
  }

  /** Ensures that the database  */
  invalidate() {

  }
}

export interface DusaSolution {
  get(name: string, ...args: InputTerm[]): Term | undefined;
  has(name: string, ...args: InputTerm[]): boolean;
}

class DusaSolutionImpl implements DusaSolution {
  private db: Database;
  private prog: InternalProgram;
  constructor(prog: InternalProgram, db: Database) {
    this.prog = prog;
    this.db = db;
  }

  get(name: string, ...args: InputTerm[]) {
    const arity = this.prog.arities[name];
    if (!arity) return undefined;
    if (!arity.value) {
      throw new DusaRuntimeError(
        `Predicate ${name} is a datalog predicate, use has() instead of get()`,
      );
    }
    if (arity.args !== args.length) {
      throw new DusaRuntimeError(
        `Predicate ${name} takes ${arity.args} argument${arity.args === 1 ? '' : 's'}, given ${args.length} here`,
      );
    }
    const constraint = this.db.get(
      name,
      args.map((arg) => termToData(this.prog.data, arg)),
    );
    if (constraint === null) return undefined;
    return dataToTerm(this.prog.data, (constraint as { just: Data }).just);
  }

  has(name: string, ...args: InputTerm[]) {
    const arity = this.prog.arities[name];
    if (!arity) return false;
    if (arity.args !== args.length) {
      throw new DusaRuntimeError(
        `Predicate ${name} takes ${arity.args} argument${arity.args === 1 ? '' : 's'}, given ${args.length} here`,
      );
    }
    return (
      this.db.get(
        name,
        args.map((arg) => termToData(this.prog.data, arg)),
      ) !== null
    );
  }
}

export interface DusaIterator extends Iterator<DusaSolution> {}

class DusaIteratorImpl implements Iterator<DusaSolution> {
  private parent: Dusa;
  private state: null | { path: ChoiceZipper; tree: ChoiceTree | null };

  constructor(parent: Dusa) {
    this.parent = parent;
    this.state = null;
  }

  

  next(): IteratorResult<DusaSolution> {
    return { done: true, value: undefined };
  }
}
