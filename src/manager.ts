import React from 'react';
import { Database, Fact, Program } from './datalog/engine';
import { AppToWorker, WorkerToApp } from './worker';

export interface WorkerStats {
  cycles: number;
}

export type DinnikWorker =
  | { type: 'unready' }
  | {
      type: 'unloaded';
      load(program: Program, db: Database): Promise<void>;
    }
  | {
      type: 'running';
      facts: Fact[][];
      stats: WorkerStats;
      stop(): Promise<void>;
    }
  | {
      type: 'paused';
      facts: Fact[][];
      stats: WorkerStats;
      go(): Promise<void>;
      reset(): Promise<void>;
    }
  | {
      type: 'done';
      facts: Fact[][];
      stats: WorkerStats;
      reset(): Promise<void>;
    }
  | {
      type: 'error';
      facts: Fact[][];
      stats: WorkerStats;
      msg: string;
      reset(): Promise<void>;
    };

export function useDinnikWorker() {
  const worker = React.useRef<Worker | null>(null);
  const post = React.useRef<(msg: AppToWorker) => void>(() => {});
  const facts = React.useRef<Fact[][]>([]);

  // To force there to be only one in-flight request to the worker at a time,
  // we have a promise that is waiting iff there is an in-flight request
  const promise = React.useRef<Promise<void>>(Promise.resolve());
  // resolver is null iff promise is fulfilled
  const resolver = React.useRef<null | ((value: void | PromiseLike<void>) => void)>(null);

  const [status, setStatus] = React.useState<DinnikWorker>({ type: 'unready' });

  const handleLoad = React.useCallback((program: Program, db: Database): Promise<void> => {
    if (worker.current === null) throw new Error('No worker');
    promise.current = promise.current.then(() => {
      return new Promise((resolve) => {
        resolver.current = resolve;
        post.current({ type: 'load', program, db });
      });
    });
    return promise.current;
  }, []);

  const handleGo = React.useCallback(() => {
    if (worker.current === null) throw new Error('No worker');
    promise.current = promise.current.then(() => {
      return new Promise((resolve) => {
        resolver.current = resolve;
        post.current({ type: 'start' });
      });
    });
    return promise.current;
  }, []);

  const handleReset = React.useCallback(() => {
    if (worker.current === null) throw new Error('No worker');
    promise.current = promise.current.then(() => {
      return new Promise((resolve) => {
        resolver.current = resolve;
        post.current({ type: 'reset' });
      });
    });
    return promise.current;
  }, []);

  const handleStop = React.useCallback(() => {
    if (worker.current === null) throw new Error('No worker');
    promise.current = promise.current.then(() => {
      return new Promise((resolve) => {
        resolver.current = resolve;
        post.current({ type: 'stop' });
      });
    });
    return promise.current;
  }, []);

  React.useEffect(() => {
    const thisWorker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    post.current = (msg) => thisWorker.postMessage(msg);
    thisWorker.onmessage = (message: MessageEvent<WorkerToApp>) => {
      switch (message.data.type) {
        case 'hello': {
          if (status.type !== 'unready') {
            console.error(`Received 'hello' message while unexpectedly in state '${status.type}'`);
          }
          setStatus({
            type: 'unloaded',
            load: handleLoad,
          });
          break;
        }

        case 'count': {
          setStatus((value) =>
            value.type === 'unloaded' || value.type === 'unready'
              ? value
              : { ...value, stats: { cycles: message.data.count } },
          );
          break;
        }

        case 'done': {
          setStatus({
            type: 'done',
            facts: facts.current,
            stats: { cycles: message.data.count },
            reset: handleReset,
          });
          break;
        }

        case 'saturated': {
          facts.current = [...facts.current, message.data.facts];
          if (message.data.last) {
            setStatus({
              type: 'done',
              facts: facts.current,
              stats: { cycles: message.data.count },
              reset: handleReset,
            });
          } else {
            setStatus({
              type: 'paused',
              facts: facts.current,
              stats: { cycles: message.data.count },
              reset: handleReset,
              go: handleGo,
            });
          }
          break;
        }

        case 'response': {
          if (resolver.current === null) throw new Error('No resolver');
          resolver.current();
          resolver.current = null;
          switch (message.data.value) {
            case 'load':
              setStatus({
                type: 'paused',
                facts: [],
                stats: { cycles: 0 },
                go: handleGo,
                reset: handleReset,
              });
              break;

            case 'reset':
              setStatus({
                type: 'unloaded',
                load: handleLoad,
              });
              break;

            case 'start':
              setStatus({
                type: 'running',
                facts: facts.current,
                stats: { cycles: message.data.count },
                stop: handleStop,
              });
              break;

            case 'stop':
              setStatus({
                type: 'paused',
                facts: facts.current,
                stats: { cycles: message.data.count },
                go: handleGo,
                reset: handleReset,
              });
          }
        }
      }
    };

    return () => {
      thisWorker.terminate();
    };
  });

  return status;
}
