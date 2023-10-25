import { compile } from './datalog/compile';
import { Fact } from './datalog/engine';
import { parse } from './datalog/parser/dinnik-parser';
import { dinnikTokenizer } from './datalog/parser/dinnik-tokenizer';
import { Issue, parseWithStreamParser } from './datalog/parsing/parser';
import { SourceLocation } from './datalog/parsing/source-location';
import { Declaration, check } from './datalog/syntax';
import { AppToWorker, WorkerToApp } from './worker';

export interface DinnikWorkerSession {
  worker: Worker;
  facts: Fact[][];
  issues: { msg: string; loc?: SourceLocation }[];
  errorMessage: string;
  status: 'unconnected' | 'unloaded' | 'running' | 'paused' | 'done' | 'error';
  stats: { cycles: number };
}

/**
 * Global state
 */
const sessions: { [id: string]: DinnikWorkerSession } = {};

/**
 * Message queue
 */
let inFlightQueue: Promise<void> = Promise.resolve();
let inFlightResolver: null | {
  id: string;
  expecting: string;
  resolver: (value: void | PromiseLike<void>) => void;
} = null;

export async function terminateWorker(id: string) {
  const session = sessions[id];
  if (!session) throw new Error(`Can't terminate nonexistant session ${id}`);
  return inFlightQueue.then(() => {
    sessions[id].worker.terminate();
    delete sessions[id];
  });
}

export function messageToWorker(id: string, msg: AppToWorker) {
  //console.log(`Preparing app --${msg.type}--> Worker ${id} [[${performance.now()}]]`);

  const session = sessions[id];
  if (!session) throw new Error(`Can't send to nonexistant session ${id}`);
  if (session.status === 'unconnected')
    throw new Error(`Can't send to unconnected session ${session}`);

  inFlightQueue = inFlightQueue.then(
    () =>
      new Promise((resolver) => {
        if (inFlightResolver !== null) {
          throw new Error(
            `inFlightResolver not null as expected, expecting '${inFlightResolver.expecting}' for ${inFlightResolver.id}`,
          );
        }
        inFlightResolver = { id, resolver, expecting: msg.type };
        //console.log(`Sending app --${msg.type}--> Worker ${id} [[${performance.now()}]]`);
        session.worker.postMessage(msg);
      }),
  );

  return inFlightQueue;
}

export function loadProgram(id: string, source: string) {
  const session = sessions[id];
  if (!session) throw new Error(`Can't load to nonexistant session ${id}`);
  session.issues = [];
  session.errorMessage = '';
  session.facts = [];

  const err = (issues: Issue[]) => {
    sessions[id].issues = issues;
    sessions[id].errorMessage = `unable to load program: ${issues.length} error${
      issues.length === 1 ? '' : 's'
    }`;
    return Promise.resolve();
  };

  const tokens = parseWithStreamParser(dinnikTokenizer, source);
  if (tokens.issues.length > 0) return err(tokens.issues);

  const parseResult = parse(tokens.document);
  const parseIssues = parseResult.filter((decl): decl is Issue => decl.type === 'Issue');
  if (parseIssues.length > 0) return err(parseIssues);

  const decls = parseResult.filter((decl): decl is Declaration => decl.type !== 'Issue');
  const declIssues = check(decls);
  if (declIssues.length > 0) return err(parseIssues);

  const { program, initialDb } = compile(decls);
  return messageToWorker(id, { type: 'load', program, db: initialDb });
}

export function getWorker(id: string): Promise<DinnikWorkerSession> {
  if (sessions[id]) return Promise.resolve(sessions[id]);

  inFlightQueue = inFlightQueue.then(
    () =>
      new Promise((resolver) => {
        if (inFlightResolver !== null) {
          throw new Error(
            `inFlightResolver not null as expected, expecting '${inFlightResolver.expecting}' for ${inFlightResolver.id}`,
          );
        }
        inFlightResolver = { id, resolver, expecting: 'hello' };
        sessions[id] = {
          worker: new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
          facts: [],
          issues: [],
          errorMessage: '',
          status: 'unconnected',
          stats: { cycles: 0 },
        };
        sessions[id].worker.onmessage = (message: MessageEvent<WorkerToApp>) => {
          //console.log(`Worker ${id} --${message.data.type}--> App [[${performance.now()}]]`);
          if (inFlightResolver === null) {
            console.error(
              `Message '${message.data.type}' received for ${id} while no resolver was active`,
            );
            return;
          } else if (inFlightResolver.id !== id) {
            console.error(
              `Message '${message.data.type}' received for ${id} but ${inFlightResolver.id} was expecting a response to '${inFlightResolver.expecting}'`,
            );
            return;
          }
          const expecting = inFlightResolver.expecting;
          function ok(okResponses: string[]) {
            if (!okResponses.some((okResponse) => expecting === okResponse)) {
              console.error(
                `Message '${message.data.type}' unexpectedly recieved by ${id} win response to '${expecting}'`,
              );
              return false;
            }
            return true;
          }

          switch (message.data.type) {
            case 'hello':
              if (ok(['hello'])) sessions[id].status = 'unloaded';
              break;

            case 'reset':
              if (ok(['reset'])) {
                sessions[id].status = 'unloaded';
                sessions[id].facts = [];
                sessions[id].errorMessage = '';
                sessions[id].issues = [];
                sessions[id].stats = { cycles: 0 };
              }
              break;

            case 'done':
            case 'paused':
            case 'running':
              if (ok(['status', 'stop', 'load', 'start'])) {
                sessions[id].status = message.data.type;
                sessions[id].stats = message.data.stats;
              }
              break;

            case 'error':
              if (ok(['status', 'stop', 'load', 'start'])) {
                sessions[id].status = 'error';
                sessions[id].stats = message.data.stats;
                sessions[id].errorMessage = 'error encountered in execution';
                sessions[id].issues = [{ msg: message.data.message }];
              }
              break;

            case 'saturated':
              if (ok(['status', 'stop', 'load', 'start'])) {
                sessions[id].status = message.data.last ? 'done' : 'paused';
                sessions[id].stats = message.data.stats;
                sessions[id].facts = [...sessions[id].facts, message.data.facts];
              }
              break;
          }

          inFlightResolver.resolver();
          inFlightResolver = null;
        };
      }),
  );

  return inFlightQueue.then(() => sessions[id]);
}
