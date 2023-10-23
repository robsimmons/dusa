import React from 'react';
import { Fact } from './datalog/engine';
import { AppToWorker, WorkerToApp } from './worker';
import { SourceLocation } from './datalog/parsing/source-location';
import { Issue, parseWithStreamParser } from './datalog/parsing/parser';
import { dinnikTokenizer } from './datalog/parser/dinnik-tokenizer';
import { parse } from './datalog/parser/dinnik-parser';
import { Declaration } from './datalog/syntax';
import { compile } from './datalog/compile';

export interface WorkerStats {
  cycles: number;
}

export type DinnikWorker =
  | { type: 'unready' }
  | {
      type: 'unloaded';
      load(program: string): Promise<void>;
    }
  | {
      type: 'running';
      facts: Fact[][];
      stats: WorkerStats;
      stop(): Promise<void>;
      reset(): Promise<void>;
      reload(program: string): Promise<void>;
    }
  | {
      type: 'paused';
      facts: Fact[][];
      stats: WorkerStats;
      go(): Promise<void>;
      reset(): Promise<void>;
      reload(program: string): Promise<void>;
    }
  | {
      type: 'done';
      facts: Fact[][];
      stats: WorkerStats;
      reset(): Promise<void>;
      reload(program: string): Promise<void>;
    }
  | {
      type: 'error';
      facts: Fact[][];
      stats: WorkerStats;
      msg: string;
      errors: { msg: string; loc?: SourceLocation }[];
      reset(): Promise<void>;
      reload(program: string): Promise<void>;
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

  const [status_, setStatus_] = React.useState<DinnikWorker>({ type: 'unready' });
  const status = React.useRef(status_);
  function setStatus(s: DinnikWorker) {
    setStatus_(s);
    status.current = s;
  }

  const handleLoad = React.useCallback((source: string): Promise<void> => {
    if (worker.current === null) throw new Error('No worker');
    promise.current = promise.current.then(() => {
      function setStatusError(issues: Issue[]) {
        setStatus({
          type: 'error',
          msg: `unable to load program: ${issues.length} error${issues.length === 1 ? '' : 's'}`,
          facts: facts.current,
          stats: { cycles: 0 },
          errors: issues,
          reset: handleReset,
          reload: handleReload,
        });
        return Promise.resolve();
      }

      const tokens = parseWithStreamParser(dinnikTokenizer, source);
      if (tokens.issues.length > 0) return setStatusError(tokens.issues);

      const parseResult = parse(tokens.document);
      const parseIssues = parseResult.filter((decl): decl is Issue => decl.type === 'Issue');
      if (parseIssues.length > 0) return setStatusError(parseIssues);

      const { program, initialDb } = compile(
        parseResult.filter((decl): decl is Declaration => decl.type !== 'Issue'),
      );

      return new Promise((resolve) => {
        resolver.current = resolve;
        post.current({ type: 'load', program, db: initialDb });
      });
    });
    return promise.current;
  }, []);

  const handleReload = React.useCallback((source: string): Promise<void> => {
    return handleReset().then(() => handleLoad(source));
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
    promise.current = promise.current
      .then(() => {
        return new Promise((resolve) => {
          resolver.current = resolve;
          post.current({ type: 'reset' });
        });
      })
      .then(() => {
        facts.current = [];
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
    worker.current = thisWorker;
    thisWorker.onmessage = (message: MessageEvent<WorkerToApp>) => {
      switch (message.data.type) {
        case 'hello': {
          if (status.current.type !== 'unready') {
            console.error(
              `Received 'hello' message while unexpectedly in state '${status.current.type}'`,
            );
            handleReset();
          } else {
            setStatus({
              type: 'unloaded',
              load: handleLoad,
            });
          }
          break;
        }

        case 'count': {
          if (status.current.type === 'unloaded' || status.current.type === 'unready') {
            console.error(
              `Got 'count' message in manager while state is '${status.current.type}.'`,
            );
          } else {
            setStatus({ ...status.current, stats: { cycles: message.data.count } });
          }
          break;
        }

        case 'done': {
          setStatus({
            type: 'done',
            facts: facts.current,
            stats: { cycles: message.data.count },
            reset: handleReset,
            reload: handleReload,
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
              reload: handleReload,
            });
          } else {
            setStatus({
              type: 'paused',
              facts: facts.current,
              stats: { cycles: message.data.count },
              reset: handleReset,
              go: handleGo,
              reload: handleReload,
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
                reload: handleReload,
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
                reset: handleReset,
                reload: handleReload,
              });
              break;

            case 'stop':
              setStatus({
                type: 'paused',
                facts: facts.current,
                stats: { cycles: message.data.count },
                go: handleGo,
                reset: handleReset,
                reload: handleReload,
              });
          }
        }
      }
    };

    return () => {
      thisWorker.terminate();
    };
  }, []);

  return status_;
}
