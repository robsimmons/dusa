import { Dusa, DusaIterator, BigFact as OutputFact, BytecodeProgram } from '../client.js';

export type WorkerQuery = {
  type: 'list';
  solution: number | null;
  value: OutputFact[];
};

export interface WorkerStats {
  deductions: number;
  rejected: number;
  choices: number;
}

export type WorkerToAppMsg =
  | { type: 'error'; msg: string }
  | { type: 'stats'; stats: WorkerStats }
  | { type: 'solution'; facts: OutputFact[] }
  | { type: 'done' };

export type AppToWorkerMsg =
  | { type: 'load'; program: BytecodeProgram }
  | { type: 'stop' }
  | { type: 'start' };

const CYCLE_LIMIT = 5000;
const STATS_UPDATE = 100;

let state: 'uninitialized' | 'in-progress' | 'error' | 'done' = 'uninitialized';

let dusa: DusaIterator;

function post(message: WorkerToAppMsg): true {
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
    post({ type: 'stats', stats: dusa.stats() });
    lastStatsTime = Date.now();
  }

  try {
    const readyToReport = dusa.advance(CYCLE_LIMIT + Math.random() * CYCLE_LIMIT);
    if (readyToReport) {
      const next = dusa.next();
      if (next.done) {
        post({ type: 'stats', stats: dusa.stats() });
        post({ type: 'done' });
        state = 'done';
        return true;
      } else {
        post({ type: 'solution', facts: next.value.factsBig() });
      }
    }
  } catch (e) {
    console.log(e);
    post({ type: 'error', msg: `${e}` });
    state = 'error';
    return true;
  }
  loopHandle = setTimeout(loop);
  return true;
}

onmessage = (event: MessageEvent<AppToWorkerMsg>): true => {
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
        dusa = new Dusa(event.data.program)[Symbol.iterator]();
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
        msg: `A 'load' message can only be received as the first message.`,
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
        post({ type: 'stats', stats: dusa.stats() });
      }
      return true;
    }
  }
};
