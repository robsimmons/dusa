import React, { useCallback } from 'react';
import { Fact } from './datalog/engine';
import { SourceLocation } from './datalog/parsing/source-location';
import { WorkerStats } from './worker';
import { getWorker, loadProgram, messageToWorker } from './worker-manager';

const POLL_INTERVAL = 40;

export type DinnikWorkerStatus =
  | { status: 'unready' }
  | {
      status: 'unloaded';
      load(program: string): Promise<void>;
    }
  | {
      status: 'running';
      facts: Fact[][];
      stats: WorkerStats;
      stop(): Promise<void>;
      reset(): Promise<void>;
      reload(program: string): Promise<void>;
    }
  | {
      status: 'paused';
      facts: Fact[][];
      stats: WorkerStats;
      go(): Promise<void>;
      reset(): Promise<void>;
      reload(program: string): Promise<void>;
    }
  | {
      status: 'done';
      facts: Fact[][];
      stats: WorkerStats;
      reset(): Promise<void>;
      reload(program: string): Promise<void>;
    }
  | {
      status: 'error';
      facts: Fact[][];
      stats: WorkerStats;
      msg: string;
      errors: { msg: string; loc?: SourceLocation }[];
      reset(): Promise<void>;
      reload(program: string): Promise<void>;
    };

export function useDinnikWorker(id: string) {
  const [result, setResult] = React.useState<DinnikWorkerStatus>({ status: 'unready' });

  const setResultFromSession: () => void = useCallback(() => {
    const stop = () => messageToWorker(id, { type: 'stop' }).then(setResultFromSession);
    const go = () => messageToWorker(id, { type: 'start' }).then(setResultFromSession);
    const reset = () => messageToWorker(id, { type: 'stop' }).then(setResultFromSession);
    const load = (program: string) => loadProgram(id, program).then(setResultFromSession);
    const reload = (program: string) =>
      messageToWorker(id, { type: 'reset' })
        .then(() => loadProgram(id, program))
        .then(setResultFromSession);

    getWorker(id).then((session) => {
      switch (session.status) {
        case 'unconnected':
          return setResult({ status: 'unready' });
        case 'unloaded':
          return setResult({ status: 'unloaded', load });
        case 'running':
          return setResult({
            status: 'running',
            facts: session.facts,
            stats: session.stats,
            stop,
            reset,
            reload,
          });
        case 'done':
          return setResult({
            status: 'done',
            facts: session.facts,
            stats: session.stats,
            reset,
            reload,
          });
        case 'error':
          return setResult({
            status: 'error',
            facts: session.facts,
            stats: session.stats,
            errors: session.issues,
            msg: session.errorMessage,
            reset,
            reload,
          });
        case 'paused':
          return setResult({
            status: 'paused',
            facts: session.facts,
            stats: session.stats,
            reset,
            reload,
            go,
          });
      }
    });
  }, [id, setResult]);

  const timeoutRef = React.useRef<number | null>(null);
  const pollWorker = React.useCallback(() => {
    timeoutRef.current = null;
    messageToWorker(id, { type: 'status' })
      .then(setResultFromSession)
      .then(() => {
        timeoutRef.current = setTimeout(pollWorker, POLL_INTERVAL);
      });
  }, [id, setResultFromSession]);

  React.useEffect(() => {
    setResultFromSession();
  }, [id, setResultFromSession]);

  React.useEffect(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (result.status === 'running') {
      timeoutRef.current = setTimeout(pollWorker, POLL_INTERVAL);
    }
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [id, result.status, timeoutRef]);

  return result;
}
