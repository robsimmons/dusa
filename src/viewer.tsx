import React from 'react';
import { dinnikTokenizer } from './datalog/parser/dinnik-tokenizer';
import { parse } from './datalog/parser/dinnik-parser';
import { Issue, parseWithStreamParser } from './datalog/parsing/parser';
import { DinnikViewError, DinnikViewErrorProps } from './view/errors';
import { Declaration, check } from './datalog/syntax';
import { SourceLocation } from './datalog/parsing/source-location';
import { AppToWorker, WorkerToApp } from './worker';
import { Database, Fact, Program } from './datalog/engine';
import { compile } from './datalog/compile';
import { DinnikViewResults, DinnikViewResultsProps } from './view/results';

interface DinnikViewerProps {
  program: null | string;
  programModified: boolean;
  getProgram: () => void;
}

type WorkerStatus =
  | { type: 'unloaded' }
  | { type: 'ready' }
  | { type: 'running' }
  | { type: 'done' }
  | { type: 'error'; msg: string }
  | { type: 'waiting for response'; id: number };

function useWorker() {
  const worker = React.useRef<Worker | null>(null);
  const uniqueWorkerId = React.useRef(0);
  const [cycles, setCycles] = React.useState(0);
  const status = React.useRef<WorkerStatus>({ type: 'unloaded' });
  const [solutions, setSolutions] = React.useState<Fact[][]>([]);
  const msgQueue = React.useRef(Promise.resolve());
  const msgResolver = React.useRef<null | ((value: void | PromiseLike<void>) => void)>(null);
  const msgId = React.useRef(0);

  React.useEffect(() => {
    const thisWorker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    thisWorker.onmessage = (message: MessageEvent<WorkerToApp>) => {
      console.log(message);
      setCycles(message.data.count);
      switch (message.data.type) {
        case 'response': {
          if (status.current.type !== 'waiting for response') {
            console.error(
              `Dinnik manager received 'response' from worker while unexpectedly in state ${status.current.type}`,
            );
          } else if (status.current.id !== message.data.id) {
            console.error(
              `Dinnik manager received 'response' with id ${message.data.id}, but id ${status.current.id} was expected`,
            );
          }

          switch (message.data.value) {
            case 'stop':
              status.current = { type: 'ready' };
              msgResolver.current?.();
              break;
            case 'reset':
              status.current = { type: 'ready' };
              msgResolver.current?.();
              break;
            case 'load':
              status.current = { type: 'ready' };
              setTimeout(() => msgResolver.current?.(), 2000);
              break;
            case 'start':
              status.current = { type: 'running' };
              msgResolver.current?.();
              break;
          }
          break;
        }
        case 'done': {
          status.current = { type: 'done' };
          break;
        }
        case 'count': {
          break;
        }
        case 'saturated': {
          const newFacts = message.data.facts;
          setSolutions((facts) => [...facts, newFacts]);
          if (message.data.last) {
            status.current = { type: 'done' };
          } else {
            status.current = { type: 'ready' };
          }
          break;
        }
      }
    };
    uniqueWorkerId.current += 1;
    worker.current = thisWorker;
    return () => {
      console.log('terminating worker');
      thisWorker.terminate();
    };
  }, []);

  if (worker === null) return null;
  return {
    key: `worker${uniqueWorkerId.current}`,
    cycles,
    status: status.current,
    solutions,
    load: (program: Program, db: Database) => {
      console.log('A');
      console.log(msgQueue.current);
      msgQueue.current = msgQueue.current.then(() => {
        console.log('B');
        console.log(msgQueue.current);
        return new Promise((resolve) => {
          msgResolver.current = resolve;
          status.current = { type: 'waiting for response', id: msgId.current };
          const msg: AppToWorker = { type: 'load', program, db, id: msgId.current++ };
          worker.current!.postMessage(msg);
        });
      });
      return msgQueue.current;
    },

    start: () => {
      msgQueue.current = msgQueue.current.then(() => {
        return new Promise((resolve) => {
          msgResolver.current = resolve;
          status.current = { type: 'waiting for response', id: msgId.current };
          const msg: AppToWorker = { type: 'start', id: msgId.current++ };
          worker.current!.postMessage(msg);
        });
      });
      return msgQueue.current;
    },

    pause: () => {
      msgQueue.current = msgQueue.current.then(() => {
        return new Promise((resolve) => {
          msgResolver.current = resolve;
          status.current = { type: 'waiting for response', id: msgId.current };
          const msg: AppToWorker = { type: 'stop', id: msgId.current++ };
          worker.current!.postMessage(msg);
        });
      });
      return msgQueue.current;
    },
  };
}

export default function DinnikViewer(props: DinnikViewerProps) {
  const [state, setState] = React.useState<null | DinnikViewErrorProps | DinnikViewResultsProps>(
    null,
  );
  const worker = useWorker();

  React.useEffect(() => {
    if (!props.program || !worker) {
      setState(null);
      return;
    }

    const tokens = parseWithStreamParser(dinnikTokenizer, props.program);
    if (tokens.issues.length > 0) {
      setState({ type: 'ViewError', issues: tokens.issues });
      return;
    }
    const parseResult = parse(tokens.document);
    let issues: { msg: string; loc?: SourceLocation }[] = parseResult.filter(
      (decl): decl is Issue => decl.type === 'Issue',
    );
    if (issues.length > 0) {
      setState({ type: 'ViewError', issues });
      return;
    }
    const decls = parseResult.filter((decl): decl is Declaration => decl.type !== 'Issue');
    issues = check(decls).map((msg) => ({ msg }));
    if (issues.length > 0) {
      setState({ type: 'ViewError', issues });
      return;
    }

    const { program, initialDb } = compile(decls);
    worker.load(program, initialDb).then(() => {
      console.log('Initialized!');
      setState({ type: 'ViewResults', state: 'paused', results: [] });
    });
  }, [props.program, worker?.key]);

  const { statusClass, statusMessage } =
    state === null || worker === null
      ? { statusClass: 'loading', statusMessage: 'program not loaded' }
      : state.type === 'ViewError'
      ? {
          statusClass: 'error',
          statusMessage: `unable to load program, ${state.issues.length} issue${
            state.issues.length === 1 ? '' : 's'
          }`,
        }
      : worker.status.type === 'done'
      ? { statusClass: 'ok', statusMessage: 'all solutions found' }
      : worker.status.type === 'error'
      ? { statusClass: 'error', statusMessage: 'error encountered' }
      : { statusClass: 'loading', statusMessage: 'unkown' };

  return (
    <div className="dk-view">
      <div className={`dk-view-header dk-view-status-${statusClass}`}>
        <button className="dk-load-button">
          <span className="fa-solid fa-right-to-bracket" />
        </button>
        {state && state.type === 'ViewResults' && state.state === 'paused' && (
          <button
            className="dk-load-button"
            onClick={() => {
              worker?.start().then(() => {
                setState({ ...state, state: 'running' });
              });
            }}
          >
            <span className="fa-solid fa-play" />
          </button>
        )}
        {state && state.type === 'ViewResults' && state.state === 'running' && (
          <button className="dk-load-button">
            <span className="fa-solid fa-pause" />
          </button>
        )}
        <div className="dk-view-stats">
          <span>
            {worker && (
              <>
                <span className="fa-solid fa-worm" />
                {worker.cycles}
              </>
            )}
          </span>
        </div>
        <div className="dk-view-status">{statusMessage}</div>
      </div>
      {state === null || worker === null ? null : state.type === 'ViewError' ? (
        <DinnikViewError {...state} />
      ) : state.type === 'ViewResults' ? (
        <DinnikViewResults {...state} results={worker.solutions} />
      ) : (
        <div>impossible</div>
      )}
    </div>
  );
}
