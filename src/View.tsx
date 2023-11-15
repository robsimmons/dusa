import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from '@radix-ui/react-icons';
import { WorkerQuery, WorkerStats } from './worker';
import { ICON_SIZE } from './constants';

interface Props {
  status: 'done' | 'running' | 'paused';
  stats: WorkerStats;
  query: null | WorkerQuery;
  setSolution: (index: number | null) => void;
}

export default function View(props: Props) {
  const reportedSolutionNumber = (props.query?.solution ?? props.stats.solutions - 1) + 1;

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
        </div>
      </div>

      <div id="explorer-view-data">
        <div style={{ color: 'var(--oksolar-text-red)' }}>{props.stats.error}</div>
        {props.query !== null && (
          <ul>
            {props.query.value.map((fact, i) => (
              <li key={i}>{fact}</li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
