import { ProgramN as BytecodeProgramN } from './bytecode.js';
import { Data, HashCons } from './datastructures/data.js';
import { Database } from './datastructures/database.js';
import {
  ascendToRoot,
  ChoiceTree,
  ChoiceZipper,
  collapseTreeUp,
  step,
  StepResult,
  stepState,
} from './engine/choiceengine.js';
import { assertConclusion, createSearchState, SearchState } from './engine/forwardengine.js';
import { ingestBytecodeProgram, Program as InternalProgram } from './engine/program.js';
import { check } from './language/check.js';
import { compile } from './language/compile.js';
import { parse } from './language/dusa-parser.js';
import { Issue } from './parsing/parser.js';
import { bytecodeToJSON } from './serialize.js';
import {
  compareTerms,
  dataToTerm,
  Fact,
  InputFact,
  InputTerm,
  Term,
  termToData,
} from './termoutput.js';

export type { ProgramN as BytecodeProgramN } from './bytecode.js';
export type { Issue } from './parsing/parser.js';
export type { InputFact, InputTerm, Fact, Term } from './termoutput.js';
export { compareTerm, compareTerms, termToString } from './termoutput.js';
export { termToJson } from './serialize.js';

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
  private cachedSolution: null | 'conflict' | DusaSolution = null;

  get relations(): string[] {
    return [...Object.keys(this.prog.arities)];
  }

  get solution() {
    if (this.cachedSolution === null) {
      const solution = this[Symbol.iterator]().next();
      if (!solution.done) {
        this.cachedSolution = solution.value;
      } else {
        this.cachedSolution = 'conflict';
      }
    }
    if (this.cachedSolution === 'conflict') return null;
    return this.cachedSolution;
  }

  [Symbol.iterator]() {
    return new DusaIteratorImpl(this.prog, this.state);
  }

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

  private inputFact(fact: InputFact): { name: string; args: Data[]; value: Data | null } {
    const nArgs = fact.args?.length ?? 0;
    const hasValue = !!fact.value;

    let arity = this.prog.arities[fact.name];
    if (!arity) {
      if (!fact.name.match(/^[a-z][A-Za-z0-9]*$/)) {
        throw new DusaRuntimeError(
          `Asserted predicates must start with a lowercase letter and include only alphanumeric characters, '${fact.name}' does not.`,
        );
      }
      arity = { args: nArgs, value: hasValue };
      this.prog.arities[fact.name] = arity;
    }

    if (nArgs !== arity.args) {
      throw new DusaRuntimeError(
        `Predicate ${fact.name} should have ${arity.args} argument${
          arity.args === 1 ? '' : 's'
        }, but the asserted fact has ${nArgs}`,
      );
    }
    if (hasValue !== arity.value) {
      throw new DusaRuntimeError(
        `Predicate ${fact.name} should ${arity.value ? '' : 'not '}have a value, but the asserted fact ${hasValue ? 'has' : 'does not have'} one.`,
      );
    }

    return {
      name: fact.name,
      args: (fact.args ?? []).map((arg) => termToData(this.prog.data, arg)),
      value: fact.value ? termToData(this.prog.data, fact.value) : null,
    };
  }

  assert(...facts: InputFact[]) {
    if (this.state === null) return;
    this.state = { ...this.state };
    this.cachedSolution = null;
    let conflict = null;
    for (const fact of facts) {
      const { name, args, value } = this.inputFact(fact);
      if (value === null) {
        conflict ??= assertConclusion(this.prog, this.state, args, [], 0, [], 0, {
          type: 'datalog',
          name,
          args: args.map((_, i) => ({ type: 'var', ref: i })),
        });
      } else {
        conflict ??= assertConclusion(this.prog, this.state, args, [value], 0, [], 0, {
          type: 'closed',
          name,
          args: args.map((_, i) => ({ type: 'var', ref: i })),
          choices: [{ type: 'pass', ref: 0 }],
        });
      }
    }
    if (conflict !== null) {
      this.state = null;
    }
  }

  static compile(source: string): BytecodeProgramN<number | string> {
    const parsed = parse(source);
    if (parsed.errors !== null) {
      throw new DusaError(parsed.errors);
    }
    const { errors, arities, builtins } = check(parsed.document);
    if (errors.length !== 0) {
      throw new DusaError(errors);
    }

    const bytecodeProgram = compile(builtins, arities, parsed.document);
    return bytecodeToJSON(bytecodeProgram);
  }
}

export interface DusaSolution {
  get(name: string, ...args: InputTerm[]): Term | undefined;
  has(name: string, ...args: InputTerm[]): boolean;
  lookup(name: string, ...args: InputTerm[]): Generator<Term[]>;
  facts(): Fact[];
}

class DusaSolutionImpl implements DusaSolution {
  private solution: Database;
  private prog: InternalProgram;
  constructor(prog: InternalProgram, solution: Database) {
    this.prog = prog;
    this.solution = solution;
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
    const constraint = this.solution.get(
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
      this.solution.get(
        name,
        args.map((arg) => termToData(this.prog.data, arg)),
      ) !== null
    );
  }

  lookup(name: string, ...args: InputTerm[]) {
    function* loop(
      data: HashCons,
      arity: undefined | { args: number; value: boolean },
      solution: Database,
    ) {
      if (!arity) return;
      const depth = (arity.value ? arity.args + 1 : arity.args) - args.length;
      for (const result of solution.visit(
        name,
        args.map((arg) => termToData(data, arg)),
        args.length,
        depth,
      )) {
        yield result.map((arg) => dataToTerm(data, arg));
      }
    }
    return loop(this.prog.data, this.prog.arities[name], this.solution);
  }

  facts(): Fact[] {
    return [...Object.entries(this.prog.arities)]
      .toSorted((a, b) => (a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0))
      .flatMap(([pred, arity]): Fact[] => {
        const rows = [...this.lookup(pred)].toSorted(compareTerms);
        if (arity.value) {
          return rows.map((args) => {
            const value = args.pop()!;
            return { name: pred, args, value };
          });
        } else {
          return rows.map((args) => ({ name: pred, args, value: null }));
        }
      });
  }
}

export interface DusaIterator extends Iterator<DusaSolution> {
  /**
   * Takes at most `limit` steps of the choice engine's `step` function,
   * stopping early if a solution is reached or if no more steps can be taken.
   *
   * Returns true iff next() can return without doing any work.
   */
  advance(limit?: number): boolean;

  /**
   * Information about the progress towards solutions.
   */
  stats(): { deductions: number; rejected: number; choices: number; nonPos: number };
}

class DusaIteratorImpl implements Iterator<DusaSolution> {
  private state:
    | { type: 'parent'; state: SearchState }
    | { type: 'tree'; path: ChoiceZipper; tree: ChoiceTree | null };
  private stagedSolution: Database | null = null;
  private prog: InternalProgram;
  private nNonPos: number = 0;
  private stats_ = { deductions: 0, rejected: 0, choices: 0, models: 0 };

  constructor(prog: InternalProgram, state: SearchState | null) {
    this.prog = prog;
    if (state === null) {
      this.state = { type: 'tree', path: null, tree: null };
    } else {
      this.state = { type: 'parent', state };
    }
  }

  stats() {
    return {
      deductions: this.stats_.deductions,
      rejected: this.stats_.rejected + this.nNonPos,
      choices: this.stats_.choices,
      nonPos: this.nNonPos,
    };
  }

  stepState(
    prog: InternalProgram,
    state: SearchState,
    limit: number,
  ):
    | { result: 'must_branch'; stepsTaken: number }
    | { result: 'is_model'; stepsTaken: number }
    | { result: 'conflict'; stepsTaken: number }
    | { result: 'not_finished' } {
    for (let i = 0; i < limit; i++) {
      switch (stepState(prog, state)) {
        case StepResult.DEFERRED:
          return { result: 'must_branch', stepsTaken: i };
        case StepResult.IS_MODEL:
          return { result: 'is_model', stepsTaken: i };
        case StepResult.STEPPED:
          this.stats_.deductions += 1;
          break;
        default: {
          return { result: 'conflict', stepsTaken: i };
        }
      }
    }
    return { result: 'not_finished' };
  }

  advance(limit: number = Infinity) {
    if (this.stagedSolution !== null) return true;

    if (this.state.type === 'parent') {
      const advanceResult = this.stepState(this.prog, this.state.state, limit);
      switch (advanceResult.result) {
        case 'is_model':
          this.stats_.models += 1;
          this.stagedSolution = this.state.state.explored;
          this.state = { type: 'tree', path: null, tree: null };
          return true;
        case 'conflict': {
          this.stats_.rejected += 1;
          this.state = { type: 'tree', path: null, tree: null };
          return true;
        }
        case 'not_finished': {
          return false;
        }
        case 'must_branch': {
          limit = limit - advanceResult.stepsTaken;
          this.state = {
            type: 'tree',
            path: null,
            tree: { type: 'leaf', state: this.state.state },
          };
        }
      }
    }

    for (let i = 0; i < limit; i++) {
      if (this.state.path === null && this.state.tree === null) {
        return true; // Ready to produce with done = true
      }
      const stepResult = step(this.prog, this.state.path, this.state.tree, this.stats_);
      this.state.path = stepResult[0];
      this.state.tree = stepResult[1];
      this.stagedSolution = stepResult[2];
      if (this.stagedSolution !== null) {
        if (this.stagedSolution.size.neg === 0) {
          return true; // Ready to produce with done = false
        } else {
          this.stagedSolution = null;
          this.nNonPos += 1;
        }
      }

      if (this.stagedSolution === null && this.state.tree === null) {
        // With some probability, go ahead and return to the root
        // (intended to bump out of bad solution spaces)
        if (Math.random() < 0.01) {
          const [path, tree] = collapseTreeUp(this.state.path);
          if (path !== null && tree !== null) {
            this.state.path = null;
            this.state.tree = ascendToRoot(path, tree);
          } else {
            this.state.path = path;
            this.state.tree = tree;
          }
        }
      }
    }

    return false;
  }

  next(): IteratorResult<DusaSolution> {
    this.advance();
    if (this.state.type === 'parent') throw new Error('next/advance invariant');

    if (this.stagedSolution) {
      const value = new DusaSolutionImpl(this.prog, this.stagedSolution);
      if (this.state.tree !== null) throw new Error('choice engine invariant');
      const [path, tree] = collapseTreeUp(this.state.path);
      if (path !== null && tree !== null) {
        this.state.path = null;
        this.state.tree = ascendToRoot(path, tree);
      } else {
        this.state.path = path;
        this.state.tree = tree;
      }
      this.stagedSolution = null;
      return { done: false, value };
    } else {
      return { done: true, value: undefined };
    }
  }
}
