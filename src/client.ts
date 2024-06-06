import { Data, TRIVIAL, getRef, hide } from './datastructures/data.js';
import {
  ChoiceTree,
  ChoiceTreeNode,
  Stats,
  pathToString,
  stepTreeRandomDFS,
} from './engine/choiceengine.js';
import {
  Database,
  get,
  insertFact,
  listFacts,
  lookup,
  makeInitialDb,
  stepDb,
} from './engine/forwardengine.js';
import { check } from './language/check.js';
import { compile } from './language/compile.js';
import { builtinModes } from './language/dusa-builtins.js';
import { parse } from './language/dusa-parser.js';
import { IndexedProgram } from './language/indexize.js';
import { Issue } from './parsing/parser.js';

import {
  Fact,
  InputFact,
  InputTerm,
  JsonData,
  Term,
  dataToTerm,
  termToData,
} from './termoutput.js';
export type { Term, Fact, InputTerm, InputFact, JsonData } from './termoutput.js';
export { dataToTerm, termToData } from './termoutput.js';

export type { Issue, Stats };
export type { SourcePosition, SourceLocation } from './parsing/source-location.js';

export { DANGER_RESET_DATA } from './datastructures/data.js';

function loadJson(json: JsonData, facts: [Data, Data, Data][]): Data {
  if (
    json === null ||
    typeof json === 'number' ||
    typeof json === 'string' ||
    typeof json === 'bigint'
  ) {
    return termToData(json);
  }
  const ref = getRef();
  if (Array.isArray(json)) {
    for (const [index, value] of json.entries()) {
      const dataValue = loadJson(value, facts);
      facts.push([ref, hide({ type: 'int', value: BigInt(index) }), dataValue]);
    }
  } else if (typeof json === 'object') {
    for (const [field, value] of Object.entries(json)) {
      const dataValue = loadJson(value, facts);
      facts.push([ref, hide({ type: 'string', value: field }), dataValue]);
    }
  } else {
    throw new DusaError([
      {
        type: 'Issue',
        msg: `Could not load ${typeof json} as JSON data triples`,
        severity: 'error',
      },
    ]);
  }
  return ref;
}

export class DusaError extends Error {
  issues: Issue[];
  constructor(issues: Issue[]) {
    super();
    this.issues = issues;
  }
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

  lookup(name: string, ...args: InputTerm[]): IterableIterator<Term[]> {
    function* map(iter: IterableIterator<{ args: Data[]; value: Data }>) {
      for (const { args, value } of iter) {
        yield [...args.map(dataToTerm), dataToTerm(value)];
      }
    }
    return map(lookup(this.db, name, args.map(termToData)));
  }

  get(name: string, ...args: InputTerm[]): Term | undefined {
    const value = get(this.db, name, args.map(termToData));
    if (value === undefined) return undefined;
    return dataToTerm(value);
  }

  has(name: string, ...args: InputTerm[]): boolean {
    const value = get(this.db, name, args.map(termToData));
    return value !== undefined;
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
  private arities: Map<string, { args: number; value: boolean }>;
  private db: Database;
  private stats: Stats;
  private cachedSolution: DusaSolution | null = null;

  private advanceDb() {
    let db: Database | null = this.db;
    while (db.queue.length > 0 && (db = stepDb(this.program, db)) !== null) {
      this.db = db;
    }
  }

  constructor(source: string, debug = false) {
    const parsed = parse(source);
    if (parsed.errors !== null) {
      throw new DusaError(parsed.errors);
    }

    const { errors, arities, builtins } = check(builtinModes, parsed.document);
    if (errors.length !== 0) {
      throw new DusaError(errors);
    }

    this.debug = debug;
    this.arities = arities;
    this.program = compile(builtins, arities, parsed.document, debug);
    this.db = makeInitialDb(this.program);
    this.stats = { cycles: 0, deadEnds: 0 };
  }

  private checkPredicateForm(pred: string, arity: { args: number; value: boolean }) {
    const expected = this.arities.get(pred);
    if (!pred.match(/^[a-z][A-Za-z0-9]*$/)) {
      throw new DusaError([
        {
          type: 'Issue',
          msg: `Asserted predicates must start with a lowercase letter and include only alphanumeric characters, '${pred}' does not.`,
          severity: 'error',
        },
      ]);
    }
    if (expected === undefined) {
      this.arities.set(pred, arity);
    } else if (arity.args !== expected.args) {
      throw new DusaError([
        {
          type: 'Issue',
          msg: `Predicate ${pred} should have ${expected} argument${
            expected.args === 1 ? '' : 's'
          }, but the asserted fact has ${arity}`,
          severity: 'error',
        },
      ]);
    } else if (arity.value !== expected.value) {
      throw new DusaError([
        {
          type: 'Issue',
          msg: `Predicate ${pred} should ${expected.value ? '' : 'not '}have a value, but the asserted fact ${arity.value ? 'has' : 'does not have'} one.`,
          severity: 'error',
        },
      ]);
    }
  }

  /**
   * Add new facts to the database. These will affect the results of any
   * subsequent solutions.
   */
  assert(...facts: InputFact[]) {
    this.cachedSolution = null;
    this.db = { ...this.db };
    for (const { name, args, value } of facts) {
      this.checkPredicateForm(name, { args: args?.length ?? 0, value: value !== undefined });
      insertFact(
        name,
        args?.map(termToData) ?? [],
        value === undefined ? TRIVIAL : termToData(value),
        this.db,
      );
    }
  }

  /**
   * Insert the structure of a JSON object into the database. If no two-place
   * predicate is provided, these facts will be added with the special built-in
   * predicate `->`, which is represented with (left-associative) infix notation
   * in Dusa.
   */
  load(json: JsonData, pred?: string): Term {
    this.cachedSolution = null;
    this.db = { ...this.db };

    if (pred !== undefined) {
      this.checkPredicateForm(pred, { args: 2, value: true });
    }
    const usedPred = pred ?? '->';
    const triples: [Data, Data, Data][] = [];
    const rep = loadJson(json, triples);
    for (const [obj, key, value] of triples) {
      insertFact(usedPred, [obj, key], value, this.db);
    }
    return dataToTerm(rep);
  }

  get solutions(): IterableIterator<DusaSolution> {
    this.advanceDb();
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
          severity: 'error',
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
