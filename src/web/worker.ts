import { ParsedDeclaration } from '../language/syntax.js';
import { Fact as OutputFact, dataToTerm } from '../termoutput.js';
import { compile } from '../language/compile.js';
import { listFacts, makeInitialDb } from '../engine/forwardengine.js';
import {
  ChoiceTree,
  ChoiceTreeNode,
  pathToString,
  stepTreeRandomDFS,
} from '../engine/choiceengine.js';
import { Data, compareData } from '../datastructures/data.js';
import { IndexedProgram } from '../language/indexize.js';

export type WorkerQuery = {
  type: 'list';
  solution: number | null;
  value: OutputFact[];
};

export interface WorkerStats {
  cycles: number;
  deadEnds: number;
}

export type WorkerToApp =
  | { type: 'error'; msg: string }
  | { type: 'stats'; stats: WorkerStats }
  | { type: 'solution'; facts: OutputFact[] }
  | { type: 'done' };

export type AppToWorker =
  | { type: 'load'; program: ParsedDeclaration[] }
  | { type: 'stop' }
  | { type: 'start' };

const DEBUG_TRANSFORM = true;
const DEBUG_EXECUTION = false;
const CYCLE_LIMIT = 500;
const STATS_UPDATE = 250;

let state: 'uninitialized' | 'in-progress' | 'error' | 'done' = 'uninitialized';
let program: IndexedProgram;
let tree: ChoiceTree;
let path: [ChoiceTreeNode, Data | 'defer'][] = [];
const stats: WorkerStats = {
  cycles: 0,
  deadEnds: 0,
};

function post(message: WorkerToApp): true {
  postMessage(message);
  return true;
}

let lastStatsTime = Date.now();
let loopHandle: null | ReturnType<typeof setTimeout> = null;
function loop(): true {
  if (state === 'uninitialized') {
    post({ type: 'error', msg: 'Called loop() on an uninitialized program' });
    state = 'error';
    return true;
  }
  if (state === 'error' || state === 'done') return true;

  if (Date.now() - lastStatsTime > STATS_UPDATE) {
    post({ type: 'stats', stats });
    lastStatsTime = Date.now();
  }

  for (let i = 0; i < CYCLE_LIMIT + Math.random() * CYCLE_LIMIT; i++) {
    try {
      if (DEBUG_EXECUTION) {
        console.log(pathToString(tree, path));
      }
      const result = stepTreeRandomDFS(program, tree, path, stats);

      if (result.solution) {
        post({ type: 'stats', stats });
        post({
          type: 'solution',
          facts: [...listFacts(result.solution)]
            .sort((a, b) => {
              if (a.name > b.name) return 1;
              if (a.name < b.name) return -1;
              if (a.args.length < b.args.length) return 1;
              if (a.args.length > b.args.length) return -1;
              for (let i = 0; i < a.args.length; i++) {
                const c = compareData(a.args[i], b.args[i]);
                if (c !== 0) return c;
              }
              return compareData(a.value, b.value);
            })
            .map(({ name, args, value }) => ({
              name,
              args: args.map(dataToTerm),
              value: dataToTerm(value),
            })),
        });
      }

      if (result.tree === null) {
        post({ type: 'stats', stats });
        post({ type: 'done' });
        state = 'done';
        return true;
      } else {
        tree = result.tree;
        path = result.tree === null ? path : result.path;
      }
    } catch (e) {
      post({ type: 'error', msg: `${e}` });
      state = 'error';
      return true;
    }
  }
  loopHandle = setTimeout(loop);
  return true;
}

onmessage = (event: MessageEvent<AppToWorker>): true => {
  if (state === 'error' || state === 'done') return true;

  if (state === 'uninitialized') {
    if (event.data.type !== 'load') {
      post({
        type: 'error',
        msg: `A 'load' message must be first, received '${event.data.type}' instead.`,
      });
      state = 'error';
      return true;
    } else {
      try {
        program = compile(event.data.program, DEBUG_TRANSFORM);
        tree = { type: 'leaf', db: makeInitialDb(program) };
        loopHandle = setTimeout(loop);
        state = 'in-progress';
        return true;
      } catch (e) {
        console.error(e);
        post({ type: 'error', msg: `${e}` });
        state = 'error';
        return true;
      }
    }
  }

  // state === 'in-progress'
  switch (event.data.type) {
    case 'load': {
      post({
        type: 'error',
        msg: `A 'load' message must be first, received '${event.data.type}' instead.`,
      });
      state = 'error';
      return true;
    }
    case 'start': {
      if (loopHandle === null) {
        loopHandle = setTimeout(loop);
      }
      return true;
    }
    case 'stop': {
      if (loopHandle !== null) {
        clearTimeout(loopHandle);
        loopHandle = null;
        post({ type: 'stats', stats });
      }
      return true;
    }
  }
};
