import { Data, expose } from './datastructures/data';
import {
  ChoiceTree,
  ChoiceTreeNode,
  Stats,
  pathToString,
  stepTreeRandomDFS,
} from './engine/choiceengine';
import { Database, makeInitialDb } from './engine/forwardengine';
import { compile } from './langauge/compile';
import { parse } from './langauge/dusa-parser';
import { IndexedProgram } from './langauge/indexize';
import { check } from './langauge/syntax';
import { Issue } from './parsing/parser';

export type { Issue, Stats };
export type { SourcePosition, SourceLocation } from './parsing/source-location';

export type Term = null | bigint | string | { name: string; args?: [Term, ...Term[]] };
export interface Fact {
  name: string;
  args: Term[];
  value: Term;
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

export class Dusa {
  private program: IndexedProgram;
  private debug: boolean;
  private db: Database;

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
  }

  run(): null | Fact[] {
    let tree: null | ChoiceTree = { type: 'leaf', db: this.db };
    let path: [ChoiceTreeNode, Data | 'defer'][] = [];
    const stats: Stats = { cycles: 0, deadEnds: 0 };
    let branched = false;

    for (;;) {
      if (tree === null) return null;
      if (this.debug) {
        console.log(pathToString(tree, path));
      }

      const result = stepTreeRandomDFS(this.program, tree, path, stats);
      tree = result.tree;
      path = result.tree === null ? path : result.path;

      // If we haven't yet made any branching choices, go ahead and update
      // the underlying database.
      branched ||= path.length > 0 || tree === null || tree.type !== 'leaf';
      if (!branched && tree?.type === 'leaf') {
        this.db = tree.db;
      }

      if (result.solution) {
        return result.solution.factValues
          .entries()
          .map(([name, args, value]): null | Fact => {
            if (value.type === 'is not') return null;
            return { name, args: args.map(dataToTerm), value: dataToTerm(value.value) };
          })
          .filter((x): x is Fact => x !== null);
      }
    }
  }
}
