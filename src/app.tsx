import React from 'react';

import './styles.css';
import { Declaration, checkDecl, declToString } from './datalog/syntax';
import { aspLike, characters, edges, ints, mapgen, nats } from './examples';
import { AppToWorker, WorkerToApp } from './worker';
import { compile } from './datalog/compile';
import { Fact, factToString } from './datalog/engine';

const exampleKeys = ['edges', 'asp', 'ints', 'nats', 'character', 'mapgen'] as const;
type EXAMPLE_KEY = (typeof exampleKeys)[number];

const examples: { [key in EXAMPLE_KEY]: [string, Declaration[]] } = {
  edges: ['Graph connectivity', edges],
  asp: ['ASP-like example', aspLike],
  ints: ['Using integers', ints],
  nats: ['Using natural numbers', nats],
  character: ['Character creation', characters],
  mapgen: ['Map generation', mapgen(5, 9)],
};

export default function App() {
  const [worker, setWorker] = React.useState<null | Worker>(null);
  const [selection, setSelection] = React.useState<EXAMPLE_KEY | null>(null);
  const [text, setText] = React.useState<string>('');
  const [cycles, setCycles] = React.useState(0);
  const [error, setError] = React.useState<string | null>('');
  const [workerState, setWorkerState] = React.useState<null | 'running' | 'stopped'>(null);
  const [facts, setFacts] = React.useState<null | Fact[][]>(null);

  const selectionRef = React.useRef(selection);
  React.useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  React.useEffect(() => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (message) => {
      const data: WorkerToApp = message.data;
      setCycles(data.count);
      switch (data.type) {
        case 'saturated':
          setFacts((facts) => [...(facts === null ? [] : facts), data.facts]);
          switch (selectionRef.current) {
            case 'mapgen':
              if (data.last || data.facts.some((fact) => fact.name === 'complete')) {
                setWorkerState(data.last ? null : 'stopped');
              } else {
                const message: AppToWorker = { type: 'start' };
                worker.postMessage(message);
              }
              break;
            default:
              setWorkerState(data.last ? null : 'stopped');
          }
          break;
        case 'count':
          break;
        case 'done':
          setWorkerState(null);
          break;
      }
    };
    setWorker(worker);
  }, []);

  React.useEffect(() => {
    if (!worker) return;

    let data: AppToWorker;
    setCycles(0);
    setFacts(null);
    if (selection === null) {
      setError(null);
      data = { type: 'reset' };
      setWorkerState(null);
    } else {
      const [_, decls] = examples[selection];
      try {
        for (const decl of decls) checkDecl(decl);
        const program = compile(decls);
        setError(null);
        data = { type: 'load', program };
        setWorkerState('stopped');
      } catch (err) {
        setError(`${err}`);
        data = { type: 'reset' };
        setWorkerState(null);
      }
    }
    worker.postMessage(data);
  }, [selection]);

  return (
    <>
      <main>
        <select
          onChange={(event) => {
            const program = examples[event.target.value as EXAMPLE_KEY]?.[1] ?? null;
            setSelection(event.target.value as EXAMPLE_KEY);
            setText(program.map(declToString).join('\n'));
          }}
          value={selection === null ? '(none)' : selection}
        >
          {<option value="(none)">(select one)</option>}
          {exampleKeys.map((key) => (
            <option key={key} value={key}>
              {examples[key][0]}
            </option>
          ))}
        </select>
        {error}
        <pre>{text}</pre>
        <button
          disabled={error !== null || workerState === null}
          onClick={() => {
            if (workerState === 'running') {
              worker!.postMessage({ type: 'stop' });
              setWorkerState('stopped');
            } else {
              worker!.postMessage({ type: 'start' });
              setWorkerState('running');
            }
          }}
        >
          {workerState === 'running' ? 'Stop' : 'Go'}
        </button>{' '}
        {cycles}
        {facts !== null && (
          <div>
            Solution {facts.length} of {facts.length} discovered
            {workerState === null ? '. All solutions found.' : ' so far.'}
          </div>
        )}
        <ul>
          {facts !== null &&
            facts[facts.length - 1].map((fact, i) => <li key={i}>{factToString(fact)}</li>)}
        </ul>
      </main>
    </>
  );
}
