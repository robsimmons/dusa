import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
  ImageIcon,
  ListBulletIcon,
} from '@radix-ui/react-icons';
import { WorkerQuery, WorkerStats } from './worker.js';
import { ICON_SIZE } from './constants.js';
import { Fact, Term } from '../termoutput.js';
import React from 'react';
import { escapeString } from '../datastructures/data.js';
import cssColorNames from './cssColorNames.json';

interface Props {
  status: 'done' | 'running' | 'paused';
  stats: WorkerStats;
  query: null | WorkerQuery;
  setSolution: (index: number | null) => void;
}

function TermViewer(props: { term: Term; depth: number }) {
  const [show, setShow] = React.useState(props.depth > 0);
  if (typeof props.term !== 'object' || show) {
    if (props.term === null) return '()';
    if (typeof props.term === 'string') return `"${escapeString(props.term)}"`;
    if (typeof props.term === 'bigint') return `${props.term}`;
    if (typeof props.term === 'boolean') return `#${props.term}`;
    if (props.term.name === null) return `#${props.term.value}`;
    if (!props.term.args) return props.term.name;
    return (
      <>
        ({props.term.name}
        {props.term.args.map((arg, i) => (
          <span key={i}>
            {' '}
            <TermViewer term={arg} depth={props.depth - 1} />
          </span>
        ))}
        )
      </>
    );
  } else {
    return <button onClick={() => setShow(true)}>more...</button>;
  }
}

const CSS_COLOR_NAMES: { [id: string]: string } = {
  ...cssColorNames,
};

function termToCSSColor(term: Term): string | null {
  if (term === null) return 'var(--oksolar-text)';
  if (typeof term === 'object' && term.name !== null) {
    if (term.args) {
      if (!term.args.every((arg) => typeof arg === 'bigint')) return null;
      const args = term.args as bigint[];
      if (term.name === 'rgb' && args.length === 3) {
        return `rgb(${args[0]} ${args[1]} ${args[2]})`;
      }
      if (term.name === 'rgb' && args.length === 4) {
        return `rgb(${args[0]} ${args[1]} ${args[2]} / ${args[3]}%)`;
      }
      if (term.name === 'oklch' && args.length === 3) {
        return `oklch(${args[0]}% ${Number(args[1]) / 100} ${args[2]})`;
      }
      if (term.name === 'oklch' && args.length === 4) {
        return `oklch(${args[0]}% ${Number(args[1]) / 100} ${args[2]} / ${args[3]}%)`;
      }
      return null;
    } else {
      return CSS_COLOR_NAMES[term.name] ?? null;
    }
  }
  if (typeof term === 'string') {
    if (term.match(/^#[0-9a-fA-F]+$/) && [4, 5, 7, 8].includes(term.length)) {
      return term;
    }
    return CSS_COLOR_NAMES[term] ?? null;
  }
  return null;
}

const MAX_PIXEL = 20;
const CANVAS_WIDTH = 400;
function P5(props: { facts: Fact[] }) {
  const cref = React.useRef<HTMLCanvasElement | null>(null);
  React.useEffect(() => {
    if (!cref.current) return;
    const ctx = cref.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cref.current.width, cref.current.height);

    const lines = props.facts
      .map(({ name, args, value }) => {
        if (name !== 'line') return null;
        if (args.length !== 4) return null;
        if (!args.every((arg) => typeof arg === 'bigint')) return null;
        return { args: args.map(Number), color: termToCSSColor(value) };
      })
      .filter(
        (x): x is { args: [number, number, number, number]; color: string | null } => x !== null,
      );
    const squares = props.facts
      .map(({ name, args, value }) => {
        if (name !== 'square') return null;
        if (args.length !== 3) return null;
        if (!args.every((arg) => typeof arg === 'bigint')) return null;
        return { args: args.map(Number), color: termToCSSColor(value) };
      })
      .filter((x): x is { args: [number, number, number]; color: string | null } => x !== null);

    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    for (const line of lines) {
      minX = Math.min(minX, line.args[0], line.args[2]);
      maxX = Math.max(maxX, line.args[0], line.args[2]);
      minY = Math.min(minY, line.args[1], line.args[3]);
      maxY = Math.max(maxY, line.args[1], line.args[3]);
    }
    for (const square of squares) {
      minX = Math.min(minX, square.args[0]);
      maxX = Math.max(maxX, square.args[0] + square.args[2]);
      minY = Math.min(minY, square.args[1]);
      maxY = Math.max(maxY, square.args[1] + square.args[2]);
    }

    const width = maxX - minX;
    const pixelSize =
      width >= CANVAS_WIDTH
        ? 1
        : width * MAX_PIXEL <= CANVAS_WIDTH
          ? MAX_PIXEL
          : Math.floor(CANVAS_WIDTH / width);

    for (const { args, color } of squares) {
      ctx.fillStyle = color ?? 'magenta';
      ctx.fillRect(
        (args[0] - minX) * pixelSize,
        (args[1] - minY) * pixelSize,
        args[2] * pixelSize,
        args[2] * pixelSize,
      );
    }
    for (const { args, color } of lines) {
      ctx.beginPath();
      ctx.strokeStyle = color ?? 'magenta';
      ctx.moveTo((args[0] - minX) * pixelSize, (args[1] - minY) * pixelSize);
      ctx.lineTo((args[2] - minX) * pixelSize, (args[3] - minY) * pixelSize);
      ctx.stroke();
      ctx.closePath();
    }
  }, [props.facts, cref]);

  return <canvas ref={cref} width="400" height="1200" />;
}

export default function SolutionViewer(props: Props) {
  const reportedSolutionNumber = (props.query?.solution ?? props.stats.solutions - 1) + 1;
  const [showImage, setShowImage] = React.useState<null | boolean>(null);

  if (showImage === null && props.query) {
    if (
      props.query.value.some(
        ({ name, args }) =>
          (name === 'square' &&
            args.length === 3 &&
            args.every((arg) => typeof arg === 'bigint')) ||
          (name === 'line' && args.length === 4 && args.every((arg) => typeof arg === 'bigint')),
      )
    ) {
      setShowImage(true);
    }
  }

  return (
    <>
      <div id="explorer-view-header">
        <div className="explorer-view-header">
          <button
            disabled={props.stats.solutions < 2 || reportedSolutionNumber === 1}
            onClick={() => props.setSolution(0)}
          >
            <DoubleArrowLeftIcon width={ICON_SIZE} height={ICON_SIZE} />
          </button>
          <button
            disabled={props.stats.solutions < 2 || reportedSolutionNumber === 1}
            onClick={() => props.setSolution(reportedSolutionNumber - 2)}
          >
            <ChevronLeftIcon width={ICON_SIZE} height={ICON_SIZE} />
          </button>
          <div className="status">
            {props.query === null && (
              <>
                {props.status === 'done' && 'no solutions'}
                {props.status !== 'done' && 'no solutions yet'}
              </>
            )}
            {props.query !== null && (
              <>
                {props.status === 'done' && `${reportedSolutionNumber} of ${props.stats.solutions}`}
                {props.status !== 'done' && (
                  <>
                    {props.query.solution === null && `${reportedSolutionNumber} of ?`}
                    {props.query.solution !== null &&
                      `${reportedSolutionNumber} of ${props.stats.solutions}+`}
                  </>
                )}
              </>
            )}
          </div>
          <button
            disabled={
              props.query?.solution == null || props.query.solution + 1 === props.stats.solutions
            }
            onClick={() => props.setSolution(reportedSolutionNumber)}
          >
            <ChevronRightIcon width={ICON_SIZE} height={ICON_SIZE} />
          </button>
          <button
            disabled={
              props.query?.solution == null ||
              (props.status === 'done' && props.query.solution + 1 === props.stats.solutions)
            }
            onClick={() => props.setSolution(null)}
          >
            <DoubleArrowRightIcon width={ICON_SIZE} height={ICON_SIZE} />
          </button>
          {showImage === false && (
            <button
              className="switch-mode"
              title="Switch to image view mode"
              onClick={() => setShowImage(true)}
            >
              <ImageIcon width={ICON_SIZE} height={ICON_SIZE} />
            </button>
          )}
          {showImage === true && (
            <button
              className="switch-mode"
              title="Switch to fact-list view mode"
              onClick={() => setShowImage(false)}
            >
              <ListBulletIcon width={ICON_SIZE} height={ICON_SIZE} />
            </button>
          )}
        </div>
      </div>

      <div id="explorer-view-data">
        <div style={{ color: 'var(--oksolar-text-red)' }}>{props.stats.error}</div>
        {props.query !== null && !showImage && (
          <ul>
            {props.query.value.map((fact, i) => (
              <li key={i}>
                {fact.name}{' '}
                {fact.args.map((arg, j) => (
                  <span key={j}>
                    <TermViewer term={arg} depth={4} />{' '}
                  </span>
                ))}
                {fact.value !== null && (
                  <>
                    is <TermViewer term={fact.value} depth={4} />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {props.query !== null && showImage === true && <P5 facts={props.query.value} />}
      </div>
    </>
  );
}
