import { Data } from '../datastructures/data.js';
import {
  ChoiceTree,
  ChoiceTreeNode,
  factToString,
  pathToString,
  stepTreeRandomDFS,
} from '../engine/choiceengine.js';
import { Database, listFacts, makeInitialDb } from '../engine/forwardengine.js';
import { ParsedDeclaration } from '../language/syntax.js';
import { IndexedProgram } from '../language/indexize.js';
import { compile } from '../language/compile.js';

export type WorkerQuery = {
  type: 'list';
  solution: number | null;
  value: string[];
};

export interface WorkerStats {
  cycles: number;
  deadEnds: number;
  solutions: number;
  error: string | null;
}

export type WorkerToApp =
  | { stats: WorkerStats; type: 'hello' }
  | { stats: WorkerStats; type: 'paused'; query: null | WorkerQuery }
  | { stats: WorkerStats; type: 'running'; query: null | WorkerQuery }
  | { stats: WorkerStats; type: 'done'; query: null | WorkerQuery }
  | { stats: WorkerStats; type: 'reset' };

export type AppToWorker =
  | { type: 'status' }
  | { type: 'setsolution'; solution: number | null }
  | { type: 'stop' }
  | { type: 'load'; program: ParsedDeclaration[] }
  | { type: 'start' }
  | { type: 'reset' };

const DEBUG_TRANSFORM = true;
const DEBUG_EXECUTION = false;
const CYCLE_LIMIT = 10000;
const TIME_LIMIT = 500;
let program: IndexedProgram | null = null;
let solutions: Database[] = [];
let setSolution: number | null = null;

function newStats(): WorkerStats {
  return {
    cycles: 0,
    deadEnds: 0,
    solutions: 0,
    error: null,
  };
}
let stats: WorkerStats = newStats();

function post(message: WorkerToApp): true {
  postMessage(message);
  return true;
}

let tree: null | ChoiceTree = null;
let path: [ChoiceTreeNode, Data | 'defer'][] = [];

function cycle(): null | number {
  const limit = stats.cycles + CYCLE_LIMIT + Math.random() * CYCLE_LIMIT;
  const start = performance.now();
  try {
    while (stats.cycles < limit && start + TIME_LIMIT > performance.now()) {
      if (tree === null) return null;
      if (DEBUG_EXECUTION) {
        console.log(pathToString(tree, path));
      }
      const result = stepTreeRandomDFS(program!, tree, path, stats);
      tree = result.tree;
      path = result.tree === null ? path : result.path;

      if (result.solution) {
        solutions.push(result.solution);
        stats.solutions += 1;
        return 0;
      }
    }
  } catch (e) {
    stats.error = `${e}`;
    console.log(e);
    return null;
  }

  return 0;
}

let liveLoopHandle: null | ReturnType<typeof setTimeout> = null;
function liveLoop() {
  let nextTimeout: null | number = null;
  if ((nextTimeout = cycle()) !== null) {
    liveLoopHandle = setTimeout(liveLoop, nextTimeout);
  } else {
    liveLoopHandle = null;
  }
}

function resolveQuery(index: number): WorkerQuery {
  return {
    type: 'list',
    solution: setSolution,
    value: [...listFacts(solutions[index])]
      .map(({ name, args, value }) => factToString({ name, args, value }))
      .sort(),
  };
}

// Picking up where you left off
function resume(state: 'paused' | 'done' | 'running') {
  const query =
    solutions.length === 0
      ? null
      : setSolution === null
        ? resolveQuery(solutions.length - 1)
        : resolveQuery(setSolution);

  switch (state) {
    case 'paused': {
      return post({ type: 'paused', stats, query });
    }

    case 'done': {
      return post({ type: 'done', stats, query });
    }

    case 'running': {
      liveLoopHandle = setTimeout(liveLoop);
      return post({ type: 'running', stats, query });
    }
  }
}

onmessage = (event: MessageEvent<AppToWorker>): true => {
  // What state are we actually in?
  const state: 'paused' | 'done' | 'running' =
    liveLoopHandle !== null ? 'running' : tree === null || stats.error !== null ? 'done' : 'paused';

  // Pause
  if (liveLoopHandle !== null) {
    clearTimeout(liveLoopHandle);
    liveLoopHandle = null;
  }

  switch (event.data.type) {
    case 'load': {
      stats = newStats();
      path = [];
      program = compile(event.data.program, DEBUG_TRANSFORM);
      try {
        tree = { type: 'leaf', db: makeInitialDb(program) };
        return resume('running');
      } catch (e) {
        stats.error = `${e}`;
        console.log(e);
        return resume('done');
      }
    }
    case 'start':
      if (state === 'paused') {
        return resume('running');
      }
      return resume(state);
    case 'stop':
      if (state === 'running') {
        return resume('paused');
      }
      return resume(state);
    case 'reset':
      stats = newStats();
      solutions = [];
      setSolution = null;
      tree = null;
      path = [];
      program = null;
      return post({ type: 'reset', stats });
    case 'status':
      return resume(state);
    case 'setsolution':
      setSolution = event.data.solution;
      return resume(state);
  }
};

post({ stats, type: 'hello' });
