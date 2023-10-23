import { Database, Fact, Program, step } from './datalog/engine';

export type WorkerToApp =
  | { count: number; type: 'hello' }
  | { count: number; type: 'saturated'; facts: Fact[]; last: boolean }
  | { count: number; type: 'count' }
  | { count: number; type: 'done' }
  | { count: number; type: 'response'; value: 'stop' | 'reset' | 'load' | 'start' };

export type AppToWorker =
  | { type: 'stop' }
  | { type: 'reset' }
  | { type: 'load'; program: Program; db: Database }
  | { type: 'start' };

let cycleCount = 0;
let dbStack: Database[] = [];
let CYCLE_STEP = 10000;
let program: Program | null = null;

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
    const newDbs = step(program!, db);
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

onmessage = (event: MessageEvent<AppToWorker>) => {
  switch (event.data.type) {
    case 'load':
      if (liveLoopHandle !== null) {
        clearTimeout(liveLoopHandle);
      }
      cycleCount = 0;
      dbStack = [event.data.db];
      program = event.data.program;
      return post({
        count: cycleCount,
        type: 'response',
        value: event.data.type,
        id: event.data.id,
      });
    case 'start':
      liveLoopHandle = setTimeout(liveLoop, 1);
      return post({
        count: cycleCount,
        type: 'response',
        value: event.data.type,
        id: event.data.id,
      });
    case 'stop':
      if (liveLoopHandle !== null) {
        clearTimeout(liveLoopHandle);
      }
      return post({
        count: cycleCount,
        type: 'response',
        value: event.data.type,
        id: event.data.id,
      });
    case 'reset':
      if (liveLoopHandle !== null) {
        clearTimeout(liveLoopHandle);
      }
      cycleCount = 0;
      dbStack = [];
      program = null;
      return post({
        count: cycleCount,
        type: 'response',
        value: event.data.type,
        id: event.data.id,
      });
  }
};

post({ count: cycleCount, type: 'hello' });
