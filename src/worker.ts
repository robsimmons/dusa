import { Database, Fact, Program, step } from './datalog/engine';

export interface WorkerStats {
  cycles: number;
  deadEnds: number;
}

export type WorkerToApp =
  | { stats: WorkerStats; type: 'hello' }
  | { stats: WorkerStats; type: 'saturated'; facts: Fact[]; last: boolean }
  | { stats: WorkerStats; type: 'paused' }
  | { stats: WorkerStats; type: 'running' }
  | { stats: WorkerStats; type: 'done' }
  | { stats: WorkerStats; type: 'error'; message: string }
  | { stats: WorkerStats; type: 'reset' };

export type AppToWorker =
  | { type: 'status' }
  | { type: 'stop' }
  | { type: 'load'; program: Program; db: Database }
  | { type: 'start' }
  | { type: 'reset' };

const CYCLE_LIMIT = 10000;
const TIME_LIMIT = 500;
let cycleCount = 0;
let deadEndCount = 0;
let dbStack: Database[] = [];
let program: Program | null = null;
let queuedFacts: Fact[] | null = null;

function stats(): WorkerStats {
  return { cycles: cycleCount, deadEnds: deadEndCount };
}

function post(message: WorkerToApp) {
  postMessage(message);
}

function cycle(): boolean {
  const limit = cycleCount + CYCLE_LIMIT + Math.random() * CYCLE_LIMIT;
  const start = performance.now();
  while (cycleCount < limit && start + TIME_LIMIT > performance.now()) {
    const db = dbStack.pop()!;
    if (!db) return false;

    // Check for saturation
    if (db.queue.length === 0) {
      if (Object.values(db.factValues).every(({ type }) => type === 'is')) {
        // We've found a proper solution here
        queuedFacts = ([] as Fact[]).concat(
          ...Object.entries(db.facts).map(([name, argses]) =>
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
      // Throw this solution away, it has 'is not' constraints
      continue;
    }

    // Take a step
    cycleCount += 1;
    const newDbs = step(program!, db);
    if (newDbs.length === 0) {
      deadEndCount += 1;
    } else {
      dbStack.push(...newDbs);
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
      return post({ type: 'paused', stats: stats() });
    }

    case 'done': {
      return post({ type: 'done', stats: stats() });
    }

    case 'running': {
      liveLoopHandle = setTimeout(liveLoop);
      return post({ type: 'running', stats: stats() });
    }

    case 'saturated': {
      const msg: WorkerToApp = {
        type: 'saturated',
        facts: queuedFacts!,
        last: dbStack.length === 0,
        stats: stats(),
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
      : dbStack.length === 0
      ? 'done'
      : 'paused';

  // Pause
  if (liveLoopHandle !== null) {
    clearTimeout(liveLoopHandle);
    liveLoopHandle = null;
  }

  switch (event.data.type) {
    case 'load':
      cycleCount = 0;
      dbStack = [event.data.db];
      program = event.data.program;
      queuedFacts = null;
      console.log(event.data);
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
      cycleCount = 0;
      dbStack = [];
      program = null;
      queuedFacts = null;
      return post({ type: 'reset', stats: stats() });
    case 'status':
      return resume(state);
  }
};

post({ stats: stats(), type: 'hello' });
