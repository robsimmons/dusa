import { DOCUMENT } from 'sketchzone';
import React from 'react';
import { parse } from '../language/dusa-parser.js';
import { check } from '../language/check.js';
import type { WorkerStats, AppToWorker, WorkerToApp } from './worker.js';
import type { Issue } from '../client.js';
import type { Fact, Term } from '../termoutput.js';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
  PauseIcon,
  PlayIcon,
} from '@radix-ui/react-icons';
import { escapeString } from '../datastructures/data.js';
import { builtinModes } from '../language/dusa-builtins.js';
import { ParsedDeclaration } from '../language/syntax.js';
import { compile } from '../language/compile.js';

interface Props {
  doc: DOCUMENT;
  visible: boolean;
}

const ICON_SIZE = '24px';

function Term({ term }: { term: Term }) {
  if (term === null) return '()';
  if (typeof term === 'string') return `"${escapeString(term)}"`;
  if (typeof term === 'bigint') return `${term}`;
  if (typeof term === 'boolean') return `#${term}`;
  if (term.name === null) return `#${term.value}`;
  if (!term.args) return term.name;
  return (
    <>
      ({term.name}
      {term.args.map((arg, i) => (
        <span key={i}>
          {' '}
          <Term term={arg} />
        </span>
      ))}
      )
    </>
  );
}

function Solution({ facts }: { facts: Fact[] }) {
  return (
    <ul>
      {facts.map((fact, i) => (
        <li key={i}>
          {fact.name}
          {fact.args.map((term, i) => (
            <span key={i}>
              {' '}
              <Term key={i} term={term} />
            </span>
          ))}
          {fact.value !== null && (
            <>
              {' '}
              is <Term term={fact.value} />
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Inspector({ doc, visible }: Props) {
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const worker = React.useRef<Worker>();
  const post = React.useCallback(
    (message: AppToWorker) => worker.current!.postMessage(message),
    [worker],
  );
  const [stats, setStats] = React.useState<WorkerStats>({ cycles: 0, deadEnds: 0 });

  // solutionIndex === solutions.length means we're "following" the latest state
  const [solutionIndex, setSolutionIndex] = React.useState<number | null>(null);
  const [solutions, setSolutions] = React.useState<Fact[][]>([]);
  const [state, setState] = React.useState<'running' | 'paused' | 'done'>('running');

  React.useEffect(() => {
    const ast = parse(doc);
    if (ast.errors !== null) {
      setIssues(ast.errors);
      return;
    }
    const checkResult = check(builtinModes, ast.document);

    if (checkResult.errors.length > 0) {
      setIssues(checkResult.errors);
      return;
    }

    worker.current = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.current.onmessage = (message: MessageEvent<WorkerToApp>) => {
      switch (message.data.type) {
        case 'stats': {
          setStats(message.data.stats);
          return;
        }
        case 'solution': {
          const newSolution = message.data.facts;
          // Note: this is quadratic in the number of solutions
          // but will be annoying to do correctly
          setSolutions((solns) => solns.concat([newSolution]));
          return;
        }
        case 'done': {
          setState('done');
          return;
        }
        case 'error': {
          const msg = message.data.msg;
          setIssues((issues) => issues.concat([{ type: 'Issue', msg, severity: 'error' }]));
        }
      }
    };

    const compiledProgram = compile(checkResult.builtins, checkResult.arities, ast.document, true);
    post({
      type: 'load',
      program: compiledProgram,
    });
    post({ type: 'start' });
    return () => {
      worker.current!.terminate();
    };
  }, [post, doc]);

  React.useEffect(() => {
    if (!worker.current) {
      return;
    } else if (!visible) {
      post({ type: 'stop' });
      setState('paused');
    }
  }, [post, visible]);

  return issues.length > 0 ? (
    <div id="inspector-error">
      <div>
        Unable to load program: {issues.length} error{issues.length > 1 && 's'}
      </div>
      <ul>
        {issues.map(({ loc, msg }, i) => (
          <li key={i}>
            {loc && `Line ${loc.start.line}: `}
            {msg}
          </li>
        ))}
      </ul>
    </div>
  ) : (
    <div id="inspector-root" className="zone1">
      <div id="inspector-head">
        <button
          disabled={solutions.length <= 1 || solutionIndex === 0}
          onClick={() => {
            if (solutions.length === 0) return;
            setSolutionIndex(0);
          }}
        >
          <DoubleArrowLeftIcon height={ICON_SIZE} width={ICON_SIZE} />
        </button>
        <button
          disabled={solutions.length <= 1 || solutionIndex === 0}
          onClick={() => {
            if (solutions.length === 0 || solutionIndex === 0) return;
            if (solutionIndex === null) setSolutionIndex(solutions.length - 2);
            else setSolutionIndex(solutionIndex - 1);
          }}
        >
          <ChevronLeftIcon height={ICON_SIZE} width={ICON_SIZE} />
        </button>
        <div className="status-text">
          {solutions.length === 0
            ? state === 'done'
              ? 'no solutions'
              : 'no solutions yet'
            : solutionIndex === null
              ? `${solutions.length} of ${solutions.length}${state === 'done' ? '' : '+'}`
              : `${solutionIndex + 1} of ${solutions.length}${state === 'done' ? '' : '+'}`}
        </div>
        <button
          disabled={
            solutions.length <= 1 ||
            solutionIndex === null ||
            solutionIndex === solutions.length - 1
          }
          onClick={() => {
            if (solutionIndex === null || solutions.length === solutionIndex + 1) return;
            setSolutionIndex(solutionIndex + 1);
          }}
        >
          <ChevronRightIcon height={ICON_SIZE} width={ICON_SIZE} />
        </button>
        <button
          disabled={solutions.length <= 1 || solutionIndex === null}
          onClick={() => {
            setSolutionIndex(null);
          }}
        >
          <DoubleArrowRightIcon height={ICON_SIZE} width={ICON_SIZE} />
        </button>
      </div>
      <div id="inspector-body">
        {solutions.length > 0 &&
          (solutionIndex === null ? (
            <Solution facts={solutions[solutions.length - 1]} />
          ) : (
            <Solution facts={solutions[solutionIndex]} />
          ))}
      </div>
      <div id="inspector-foot">
        <button
          className={state === 'running' ? '' : 'hidden'}
          onClick={() => {
            post({ type: 'stop' });
            setState('paused');
          }}
        >
          <PauseIcon width={ICON_SIZE} height={ICON_SIZE} /> Pause
        </button>
        <button
          className={state === 'paused' ? '' : 'hidden'}
          onClick={() => {
            post({ type: 'start' });
            setState('running');
          }}
        >
          <PlayIcon width={ICON_SIZE} height={ICON_SIZE} /> Resume
        </button>
        <div className="status-text">
          {state === 'done' ? 'done' : state === 'paused' ? 'paused' : 'running'}, {stats.cycles}{' '}
          cycle{stats.cycles !== 1 && 's'}
        </div>
      </div>
    </div>
  );
}
