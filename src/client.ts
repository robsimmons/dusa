import { Data, TRIV_DATA, expose, hide } from './datastructures/data';
import {
  ChoiceTree,
  ChoiceTreeNode,
  Stats,
  pathToString,
  stepTreeRandomDFS,
} from './engine/choiceengine';
import { Database, insertFact, listFacts, lookup, makeInitialDb } from './engine/forwardengine';
import { compile } from './langauge/compile';
import { parse } from './langauge/dusa-parser';
import { IndexedProgram } from './langauge/indexize';
import { check } from './langauge/syntax';
import { Issue } from './parsing/parser';

export type { Issue, Stats };
export type { SourcePosition, SourceLocation } from './parsing/source-location';

export type Term =
  | null // Trivial type ()
  | bigint // Natural numbers and integers
  | string // Strings
  | { name: string } // Constants
  | { name: string; args: [Term, ...Term[]] };
export interface Fact {
  name: string;
  args: Term[];
  value: Term;
}
export type InputTerm = null | number | bigint | string | { name: string; args?: InputTerm[] };
export interface InputFact {
  name: string;
  args: InputTerm[];
  value?: InputTerm;
}

export class DusaError extends Error {
  issues: Issue[];
  constructor(issues: Issue[]) {
    super();
    this.issues = issues;
  }
}

function dataToTerm(d: Data): Term {
  const view = expose(d);
  if (view.type === 'triv') return null;
  if (view.type === 'int') return view.value;
  if (view.type === 'string') return view.value;
  if (view.args.length === 0) return { name: view.name };
  const args = view.args.map(dataToTerm) as [Term, ...Term[]];
  return { name: view.name, args };
}

function termToData(tm: InputTerm): Data {
  if (tm === null) return TRIV_DATA;
  if (typeof tm === 'string') return hide({ type: 'string', value: tm });
  if (typeof tm === 'bigint') return hide({ type: 'int', value: tm });
  if (typeof tm === 'object') {
    return hide({ type: 'const', name: tm.name, args: tm.args?.map(termToData) ?? [] });
  }
  return hide({ type: 'int', value: BigInt(tm) });
}

export class DusaSolution {
  private db: Database;
  constructor(db: Database) {
    this.db = db;
  }

  get facts(): IterableIterator<Fact> {
    function* map(iter: IterableIterator<{ name: string; args: Data[]; value: Data }>) {
      for (const { name, args, value } of iter) {
        yield { name, args: args.map(dataToTerm), value: dataToTerm(value) };
      }
    }
    return map(listFacts(this.db));
  }

  lookup(name: string, ...args: InputTerm[]): IterableIterator<{ args: Term[]; value: Term }> {
    function* map(iter: IterableIterator<{ args: Data[]; value: Data }>) {
      for (const { args, value } of iter) {
        yield { args: args.map(dataToTerm), value: dataToTerm(value) };
      }
    }
    return map(lookup(this.db, name, args.map(termToData)));
  }
}

function* solutionGenerator(
  program: IndexedProgram,
  db: Database | null,
  stats: Stats,
  debug: boolean,
) {
  let tree: null | ChoiceTree = db === null ? null : { type: 'leaf', db: db };
  let path: [ChoiceTreeNode, Data | 'defer'][] = [];
  while (tree !== null) {
    if (debug) console.log(pathToString(tree, path));
    const result = stepTreeRandomDFS(program, tree, path, stats);
    tree = result.tree;
    path = result.tree === null ? path : result.path;
    if (result.solution) {
      yield new DusaSolution(result.solution);
    }
  }
}

export class Dusa {
  private program: IndexedProgram;
  private debug: boolean;
  private db: Database;
  private stats: Stats;
  private cachedSolution: DusaSolution | null = null;

  constructor(source: string, debug = false) {
    const parsed = parse(source);
    if (parsed.errors !== null) {
      throw new DusaError(parsed.errors);
    }

    const checked = check(parsed.document);
    if (checked.errors !== null) {
      throw checked.errors;
    }

    this.debug = debug;
    this.program = compile(checked.decls, debug);
    this.db = makeInitialDb(this.program);
    this.stats = { cycles: 0, deadEnds: 0 };
  }

  assert(...facts: InputFact[]) {
    this.cachedSolution = null;
    this.db = { ...this.db };
    for (const { name, args, value } of facts) {
      insertFact(
        name,
        args.map(termToData),
        value === undefined ? TRIV_DATA : termToData(value),
        this.db,
      );
    }
  }

  get solutions(): IterableIterator<DusaSolution> {
    return solutionGenerator(this.program, this.db, this.stats, this.debug);
  }

  get solution() {
    if (this.cachedSolution) return this.cachedSolution;
    const iterator = this.solutions;
    const result = iterator.next();
    if (result.done) return null;
    if (!iterator.next().done) {
      throw new DusaError([
        {
          type: 'Issue',
          msg: "Cannot use 'solution' getter on programs with multiple solutions. Use sample() instead.",
        },
      ]);
    }
    this.cachedSolution = result.value;
    return result.value;
  }

  sample() {
    const result = this.solutions.next();
    if (result.done) return null;
    return result.value;
  }
}
