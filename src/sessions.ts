import { parse } from './datalog/dusa-parser';
import { Fact } from './datalog/engine';
import { SourceLocation } from './datalog/parsing/source-location';
import { CHARACTER_CREATION_EXAMPLE, CKY_PARSING_EXAMPLE } from './examples';
import { Declaration, check } from './datalog/syntax';
import { compile } from './datalog/compile';
import { AppToWorker, WorkerStats, WorkerToApp } from './worker';

type SessionData =
  | {
      status: 'unconnected';
      text: string;
      worker: null;
    }
  | {
      status: 'error';
      text: string;
      textLoaded: string;
      worker: Worker;
      facts?: string[][];
      stats?: WorkerStats;
      issues: { msg: string; loc?: SourceLocation }[];
      errorMessage: string;
    }
  | {
      status: 'paused';
      text: string;
      textLoaded: string;
      worker: Worker;
      facts: string[][];
      stats: WorkerStats | null;
    }
  | {
      status: 'running' | 'done';
      text: string;
      textLoaded: string;
      worker: Worker;
      facts: string[][];
      stats: WorkerStats;
    };

export type Session =
  | {
      status: 'unconnected';
      text: string;
    }
  | {
      status: 'error';
      text: string;
      textModified: boolean;
      facts?: string[][];
      stats?: WorkerStats;
      issues: { msg: string; loc?: SourceLocation }[];
      errorMessage: string;
    }
  | {
      status: 'paused';
      text: string;
      textModified: boolean;
      facts: string[][];
      stats: WorkerStats | null;
    }
  | {
      status: 'running' | 'done';
      text: string;
      textModified: boolean;
      facts: string[][];
      stats: WorkerStats;
    };

class SessionTabs {
  private sessionList: string[];
  private activeSession: string;
  private sessionData: { [key: string]: SessionData };
  private lock: Promise<void> = Promise.resolve();
  private resolver: null | ((value: WorkerToApp) => void) = null;

  private static LS_SESSION_LIST = 'dinnik-sessions';
  private static LS_SESSION_ACTIVE = 'dinnik-active-session';
  private static LS_SESSION_TEXT(uuid: string) {
    return `dinnik-session-${uuid}`;
  }

  static tabs = new SessionTabs();

  private constructor() {
    if (localStorage.getItem(SessionTabs.LS_SESSION_LIST) === null) {
      const uuid1 = crypto.randomUUID();
      const uuid2 = crypto.randomUUID();
      localStorage.setItem(SessionTabs.LS_SESSION_TEXT(uuid1), CHARACTER_CREATION_EXAMPLE);
      localStorage.setItem(SessionTabs.LS_SESSION_TEXT(uuid2), CKY_PARSING_EXAMPLE);
      localStorage.setItem(SessionTabs.LS_SESSION_LIST, `${uuid1},${uuid2}`);
    }
    this.sessionList = localStorage.getItem(SessionTabs.LS_SESSION_LIST)!.split(',');
    this.activeSession = localStorage.getItem(SessionTabs.LS_SESSION_ACTIVE) ?? this.sessionList[0];
    if (!this.sessionList.some((sessionKey) => sessionKey == this.activeSession)) {
      this.activeSession = this.sessionList[0];
    }

    this.sessionData = {};
    for (const sessionKey of this.sessionList) {
      const text = localStorage.getItem(SessionTabs.LS_SESSION_TEXT(sessionKey));
      if (text !== null) {
        this.sessionData[sessionKey] = {
          status: 'unconnected',
          text,
          worker: null,
        };
      }
    }
  }

  get list() {
    return this.sessionList;
  }

  add(): Promise<void> {
    const uuid = crypto.randomUUID();
    this.list = [...this.list, uuid];
    this.sessionData[uuid] = {
      status: 'unconnected',
      text: '',
      worker: null,
    };
    return this.setActiveKey(uuid);
  }

  set list(list: string[]) {
    for (const key of this.sessionList) {
      if (!list.some((newKey) => newKey === key)) {
        localStorage.removeItem(SessionTabs.LS_SESSION_TEXT(key));
        if (this.sessionData[key].worker) {
          this.sessionData[key].worker?.terminate();
        }
        delete this.sessionData[key];
      }
    }
    this.sessionList = list;
    localStorage.setItem(SessionTabs.LS_SESSION_LIST, list.join(','));
  }

  get activeKey() {
    return this.activeSession;
  }

  setActiveKey(key: string): Promise<void> {
    this.lock = this.lock
      .then(() => {
        const activeSession = this.activeSession;
        const session = this.sessionData[activeSession];
        if (session.status === 'running') {
          return this.messageWorker(session.worker, { type: 'stop' }).then((msg) => {
            this.handleMessageResponse(activeSession, msg);
          });
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        this.activeSession = key;
        localStorage.setItem(SessionTabs.LS_SESSION_ACTIVE, key);
      });
    return this.lock;
  }

  get activeText() {
    return this.sessionData[this.activeSession]?.text || '';
  }

  get session(): Session {
    const session = this.sessionData[this.activeSession];
    return session.status === 'unconnected'
      ? session
      : { ...session, textModified: session.text !== session.textLoaded };
  }

  set activeText(text: string) {
    localStorage.setItem(SessionTabs.LS_SESSION_TEXT(this.activeSession), text);
    const session = this.sessionData[this.activeSession];
    if (!session) {
      this.sessionData[this.activeSession] = {
        status: 'unconnected',
        text,
        worker: null,
      };
    }
    session.text = text;
  }

  get tabInfo() {
    return this.sessionList.map((sessionKey) => {
      let title = null;
      const sessionText = this.sessionData[sessionKey]?.text;
      if (sessionText?.startsWith('# ')) {
        const newLineIndex = sessionText.indexOf('\n');
        title = newLineIndex === -1 ? sessionText.slice(2) : sessionText.slice(2, newLineIndex);
      }
      return { key: sessionKey, title };
    });
  }

  private makeWorker(key: string): Promise<Worker> {
    return new Promise((resolver) => {
      console.log(`session ${key}: initializing worker`);
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (message: MessageEvent<WorkerToApp>) => {
        // Initial message only
        if (message.data.type === 'hello') {
          console.log(`session ${key}: worker initialized`);
          return resolver(worker);
        }

        // All subsequent messages
        if (this.resolver === null) {
          console.error(
            `Message '${message.data.type}' received for ${key} while no resolver was active`,
          );
          return;
        }
        this.resolver(message.data);
        this.resolver = null;
      };
    });
  }

  private resetWorker(key: string): Promise<Worker> {
    console.log(`session ${key}: resetting worker`);
    const worker = this.sessionData[key].worker;
    if (worker !== null) {
      return this.messageWorker(worker, { type: 'reset' }).then(() => worker);
    }

    return this.makeWorker(key).then((worker) => worker);
  }

  private messageWorker(worker: Worker, message: AppToWorker): Promise<WorkerToApp> {
    return new Promise((resolver) => {
      if (this.resolver !== null) {
        throw new Error(`in flight resolver not null as expected!`);
      }
      this.resolver = resolver;
      worker.postMessage(message);
    });
  }

  private handleMessageResponse(activeSession: string, msg: WorkerToApp) {
    const session = this.sessionData[activeSession];
    function reportUnexpected() {
      console.error(`Received message ${msg.type} unexpectedly in state ${session.status}`);
    }

    switch (msg.type) {
      case 'error':
        if (session.status !== 'running') {
          reportUnexpected();
        } else {
          this.sessionData[activeSession] = {
            status: 'error',
            text: session.text,
            textLoaded: session.textLoaded,
            worker: session.worker,
            errorMessage: 'error during execution',
            issues: [{ msg: msg.message }],
            stats: msg.stats,
          };
        }
        break;

      case 'done':
        if (session.status !== 'running') {
          reportUnexpected();
        } else {
          this.sessionData[activeSession] = {
            status: 'done',
            text: session.text,
            textLoaded: session.textLoaded,
            worker: session.worker,
            facts: session.facts,
            stats: msg.stats,
          };
        }
        break;

      case 'paused':
        if (session.status !== 'running') {
          reportUnexpected();
        } else {
          this.sessionData[activeSession] = {
            status: 'paused',
            text: session.text,
            textLoaded: session.textLoaded,
            worker: session.worker,
            facts: session.facts,
            stats: msg.stats,
          };
        }
        break;

      case 'saturated':
        if (session.status !== 'running') {
          reportUnexpected();
        } else {
          this.sessionData[activeSession] = {
            status: msg.last ? 'done' : 'paused',
            text: session.text,
            textLoaded: session.textLoaded,
            worker: session.worker,
            facts: [...session.facts, msg.facts],
            stats: msg.stats,
          };
        }
        break;

      case 'running':
        if (session.status !== 'running' && session.status !== 'paused') {
          reportUnexpected();
        } else {
          this.sessionData[activeSession] = {
            status: 'running',
            text: session.text,
            textLoaded: session.textLoaded,
            worker: session.worker,
            facts: session.facts,
            stats: msg.stats,
          };
        }
    }
  }

  queryProgram() {
    let didQuery = false;
    this.lock = this.lock.then(() => {
      const activeSession = this.activeSession;
      const session = this.sessionData[this.activeSession];
      if (session.status === 'running') {
        return this.messageWorker(session.worker, { type: 'status' }).then((msg) => {
          didQuery = true;
          this.handleMessageResponse(activeSession, msg);
        });
      } else {
        return Promise.resolve();
      }
    });
    return this.lock.then(() => didQuery);
  }

  runProgram() {
    this.lock = this.lock.then(() => {
      const activeSession = this.activeSession;
      const session = this.sessionData[this.activeSession];
      if (session.status === 'paused') {
        return this.messageWorker(session.worker, { type: 'start' }).then((msg) => {
          this.handleMessageResponse(activeSession, msg);
        });
      } else {
        return Promise.resolve();
      }
    });
    return this.lock;
  }

  suspendProgram() {
    this.lock = this.lock.then(() => {
      const activeSession = this.activeSession;
      const session = this.sessionData[activeSession];
      if (session.status === 'running') {
        return this.messageWorker(session.worker, { type: 'stop' }).then((msg) => {
          this.handleMessageResponse(activeSession, msg);
        });
      } else {
        return Promise.resolve();
      }
    });
    return this.lock;
  }

  loadProgram() {
    this.lock = this.lock
      .then(() => {
        const activeSession = this.activeSession;
        const text = this.sessionData[activeSession].text;
        return this.resetWorker(activeSession).then((worker) => ({ worker, activeSession, text }));
      })
      .then(({ worker, activeSession, text }) => {
        const ast = parse(text);
        let decls: Declaration[] | null = null;
        let issues: { msg: string; loc?: SourceLocation }[] = [];
        if (ast.errors !== null) {
          issues = ast.errors;
        } else {
          const result = check(ast.document);
          if (result.errors !== null) {
            issues = result.errors;
          } else {
            decls = result.decls;
          }
        }

        if (issues.length > 0 || decls === null) {
          this.sessionData[activeSession] = {
            status: 'error',
            text,
            textLoaded: text,
            worker,
            issues,
            errorMessage: `unable to load program: ${issues.length} error${
              issues.length === 1 ? '' : 's'
            }`,
          };
          return Promise.resolve();
        }

        const program = compile(decls);

        return this.messageWorker(worker, { type: 'load', program }).then(({ stats }) => {
          this.sessionData[activeSession] = {
            status: 'paused',
            text,
            textLoaded: text,
            worker,
            facts: [],
            stats,
          };
        });
      });
    return this.lock;
  }
}

export const sessionManager = SessionTabs.tabs;
