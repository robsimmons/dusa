import { Data } from './datalog/data';
import {
  ChoiceTree,
  ChoiceTreeNode,
  CompiledProgram,
  Fact,
  Program,
  factToString,
  makeInitialDb,
  stepTreeRandomDFS,
} from './datalog/engine';

export interface WorkerStats {
  cycles: number;
  deadEnds: number;
}

export type WorkerToApp =
  | { stats: WorkerStats; type: 'hello' }
  | { stats: WorkerStats; type: 'saturated'; facts: string[]; last: boolean }
  | { stats: WorkerStats; type: 'paused' }
  | { stats: WorkerStats; type: 'running' }
  | { stats: WorkerStats; type: 'done' }
  | { stats: WorkerStats; type: 'error'; message: string }
  | { stats: WorkerStats; type: 'reset' };

export type AppToWorker =
  | { type: 'status' }
  | { type: 'stop' }
  | { type: 'load'; program: CompiledProgram }
  | { type: 'start' }
  | { type: 'reset' };

const CYCLE_LIMIT = 10000;
const TIME_LIMIT = 500;
let program: Program | null = null;
let queuedFacts: Fact[] | null = null;

let stats: WorkerStats = { cycles: 0, deadEnds: 0 };

function post(message: WorkerToApp) {
  postMessage(message);
}

let tree: null | ChoiceTree = null;
let path: [ChoiceTreeNode, Data | 'defer'][] = [];

function cycle(): boolean {
  const limit = stats.cycles + CYCLE_LIMIT + Math.random() * CYCLE_LIMIT;
  const start = performance.now();
  while (stats.cycles < limit && start + TIME_LIMIT > performance.now()) {
    if (tree === null) return false;
    // console.log(pathToString(tree, path));
    const result = stepTreeRandomDFS(program!, tree, path, stats);
    tree = result.tree;
    path = result.tree === null ? path : result.path;

    if (result.solution) {
      queuedFacts = ([] as Fact[]).concat(
        ...Object.entries(result.solution.facts).map(([name, argses]) =>
          argses.map<Fact>(([args, value]) => ({
            type: 'Fact',
            name,
            args,
            value,
          })),
        ),
      );
      return false;
    }
  }

  return true;
}

let liveLoopHandle: null | ReturnType<typeof setTimeout> = null;
function liveLoop() {
  if (cycle()) {
    liveLoopHandle = setTimeout(liveLoop);
  } else {
    liveLoopHandle = null;
  }
}

// Picking up where you left off
function resume(state: 'paused' | 'done' | 'saturated' | 'running') {
  switch (state) {
    case 'paused': {
      return post({ type: 'paused', stats });
    }

    case 'done': {
      return post({ type: 'done', stats });
    }

    case 'running': {
      liveLoopHandle = setTimeout(liveLoop);
      return post({ type: 'running', stats });
    }

    case 'saturated': {
      const msg: WorkerToApp = {
        type: 'saturated',
        facts: queuedFacts!.map(factToString),
        last: tree === null,
        stats,
      };
      queuedFacts = null;
      return post(msg);
    }
  }
}

onmessage = (event: MessageEvent<AppToWorker>) => {
  // What state are we actually in?
  const state: 'paused' | 'done' | 'saturated' | 'running' =
    liveLoopHandle !== null
      ? 'running'
      : queuedFacts !== null
      ? 'saturated'
      : tree === null
      ? 'done'
      : 'paused';

  // Pause
  if (liveLoopHandle !== null) {
    clearTimeout(liveLoopHandle);
    liveLoopHandle = null;
  }

  switch (event.data.type) {
    case 'load':
      stats = { cycles: 0, deadEnds: 0 };
      tree = { type: 'leaf', db: makeInitialDb(event.data.program) };
      path = [];
      program = event.data.program.program;
      queuedFacts = null;
      return resume('paused');
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
      stats = { cycles: 0, deadEnds: 0 };
      tree = null;
      path = [];
      program = null;
      queuedFacts = null;
      return post({ type: 'reset', stats });
    case 'status':
      return resume(state);
  }
};

post({ stats, type: 'hello' });
