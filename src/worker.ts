import { Database, Fact, Program, step } from './datalog/engine';

export interface WorkerStats {
  cycles: number;
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

let cycleCount = 0;
let dbStack: Database[] = [];
let CYCLE_STEP = 10000;
let program: Program | null = null;
let queuedFacts: Fact[] | null = null;

function post(message: WorkerToApp) {
  postMessage(message);
}

function cycle(): boolean {
  const limit = cycleCount + CYCLE_STEP + Math.random() * CYCLE_STEP;
  while (cycleCount < limit) {
    const db = dbStack.pop()!;
    if (!db) return false;

    // Check for saturation
    if (db.queue.length === 0) {
      if (Object.values(db.factValues).every(({ type }) => type === 'is')) {
        // We've found a proper solution here
        queuedFacts = ([] as Fact[]).concat(
          ...Object.entries(db.facts).map(([name, argses]) =>
            argses.map<Fact>((args) => ({ type: 'Fact', name, args: args })),
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
    dbStack.push(...newDbs);
  }

  return true;
}

let liveLoopHandle: null | number = null;
function liveLoop() {
  if (cycle()) {
    liveLoopHandle = setTimeout(liveLoop);
  } else {
    liveLoopHandle = null;
  }
}

function stats(): WorkerStats {
  return { cycles: cycleCount };
}

onmessage = (event: MessageEvent<AppToWorker>) => {
  // What state are we actually in?
  let state: 'paused' | 'done' | 'saturated' | 'running' =
    liveLoopHandle !== null
      ? 'running'
      : dbStack.length === 0
      ? 'done'
      : queuedFacts !== null
      ? 'saturated'
      : 'paused';

  // Pause
  if (liveLoopHandle !== null) {
    clearTimeout(liveLoopHandle);
    liveLoopHandle = null;
  }

  // Picking up where we left off
  function resume() {
    switch (state) {
      case 'paused':
        return post({ type: 'paused', stats: stats() });
      case 'done':
        return post({ type: 'done', stats: stats() });
      case 'running':
        liveLoopHandle = setTimeout(liveLoop);
        return post({ type: 'running', stats: stats() });
      case 'saturated':
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

  switch (event.data.type) {
    case 'load':
      cycleCount = 0;
      dbStack = [event.data.db];
      program = event.data.program;
      queuedFacts = null;
      return post({ type: 'paused', stats: stats() });
    case 'start':
      if (state === 'paused') {
        state = 'running';
      }
      return resume();
    case 'stop':
      if (state === 'running') {
        state = 'paused';
      }
      return resume();
    case 'reset':
      cycleCount = 0;
      dbStack = [];
      program = null;
      queuedFacts = null;
      return post({ type: 'reset', stats: stats() });
    case 'status':
      return resume();
  }
};

post({ stats: stats(), type: 'hello' });
