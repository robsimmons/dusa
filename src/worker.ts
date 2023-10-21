import {
  Database,
  Fact,
  InternalConclusion,
  InternalPartialRule,
  Program,
  step,
} from './datalog/engine';

export type WorkerToApp =
  | { count: number; type: 'saturated'; facts: Fact[]; last: boolean }
  | { count: number; type: 'count' }
  | { count: number; type: 'done' };

export type AppToWorker =
  | { type: 'stop' }
  | { type: 'reset' }
  | { type: 'load'; program: Program }
  | { type: 'start' };

let cycleCount = 0;
let dbStack: Database[];
let CYCLE_STEP = 10000;
let rules: { [name: string]: InternalPartialRule } = {};
let conclusions: { [name: string]: InternalConclusion } = {};

function post(message: WorkerToApp) {
  postMessage(message);
}

function cycle(): WorkerToApp {
  const limit = cycleCount + CYCLE_STEP + Math.random() * CYCLE_STEP;
  while (cycleCount < limit) {
    const db = dbStack.pop()!;
    if (!db) return { type: 'done', count: cycleCount };

    // Check for saturation
    if (db.queue.length === 0) {
      const facts = Object.entries(db.facts).map(([name, argses]) =>
        argses.map<Fact>((args) => ({ type: 'Fact', name, args: args })),
      );

      return {
        type: 'saturated',
        count: cycleCount,
        facts: ([] as Fact[]).concat(...facts),
        last: dbStack.length === 0,
      };
    }

    // Take a step
    cycleCount += 1;
    const newDbs = step(rules, conclusions, db);
    dbStack.push(...newDbs);
  }

  return { type: 'count', count: cycleCount };
}

let liveLoopHandle: null | number = null;
function liveLoop() {
  const message = cycle();
  post(message);
  if (message.type === 'count') {
    liveLoopHandle = setTimeout(liveLoop, 1);
  } else {
    liveLoopHandle === null;
  }
}

onmessage = (event) => {
  const data: AppToWorker = event.data;
  switch (data.type) {
    case 'load':
      if (liveLoopHandle !== null) {
        clearTimeout(liveLoopHandle);
      }
      cycleCount = 0;
      dbStack = [data.program.db];
      rules = data.program.rules;
      conclusions = data.program.conclusions;
      break;
    case 'start':
      liveLoopHandle = setTimeout(liveLoop, 1);
      break;
    case 'stop':
      if (liveLoopHandle !== null) {
        clearTimeout(liveLoopHandle);
      }
      break;
    case 'reset':
      if (liveLoopHandle !== null) {
        clearTimeout(liveLoopHandle);
      }
      cycleCount = 0;
      dbStack = [];
      rules = {};
      conclusions = {};
      break;
  }
};
