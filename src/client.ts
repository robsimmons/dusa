import { Data } from './datastructures/data';
import {
  ChoiceTree,
  ChoiceTreeNode,
  Stats,
  pathToString,
  stepTreeRandomDFS,
} from './engine/choiceengine';
import { makeInitialDb } from './engine/forwardengine';
import { compile } from './langauge/compile';
import { parse } from './langauge/dusa-parser';
import { IndexedProgram } from './langauge/indexize';
import { check } from './langauge/syntax';
import { Issue } from './parsing/parser';

export type { Issue, Stats };
export type { SourcePosition, SourceLocation } from './parsing/source-location';

export class DusaError extends Error {
  issues: Issue[];
  constructor(issues: Issue[]) {
    super();
    this.issues = issues;
  }
}

export class Dusa {
  private program: IndexedProgram;
  private debug: boolean;

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
  }

  run() {
    let tree: null | ChoiceTree = { type: 'leaf', db: makeInitialDb(this.program) };
    let path: [ChoiceTreeNode, Data | 'defer'][] = [];
    const stats: Stats = { cycles: 0, deadEnds: 0 };
    for (;;) {
      if (tree === null) return null;
      if (this.debug) {
        console.log(pathToString(tree, path));
      }

      const result = stepTreeRandomDFS(this.program, tree, path, stats);
      tree = result.tree;
      path = result.tree === null ? path : result.path;

      if (result.solution) {
        return stats;
      }
    }
  }
}
