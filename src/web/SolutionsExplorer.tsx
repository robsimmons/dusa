import {
  EnterIcon,
  MagnifyingGlassIcon,
  PauseIcon,
  PlayIcon,
  ReaderIcon,
} from '@radix-ui/react-icons';
import { Session } from './sessions.js';
import { ICON_SIZE } from './constants.js';
import SolutionViewer from './SolutionViewer.js';

interface Props {
  session: Session;
  load: () => void;
  run: () => void;
  pause: () => void;
  setSolution: (index: number | null) => void;
}

export default function SolutionsExplorer({ load, run, pause, setSolution, session }: Props) {
  const shouldReload =
    session.status !== 'unconnected' && session.status !== 'load-error' && session.textModified;

  return (
    <>
      <div id="explorer-header">
        <button
          id="explorer-load-program"
          title="Load program"
          className={shouldReload ? 'urgent' : ''}
          onClick={(event) => {
            event.preventDefault();
            document.getElementById('session')!.className = 'mobile-view-explorer';
            load();
          }}
        >
          <EnterIcon width={ICON_SIZE} height={ICON_SIZE} />{' '}
          {session.status === 'unconnected' || session.status === 'load-error'
            ? 'load program'
            : shouldReload
              ? 'program changed! reload?'
              : 'reload'}
        </button>
        <button
          id="explorer-view-code"
          title="View code"
          onClick={(event) => {
            event.preventDefault();
            pause();
            document.getElementById('session')!.className = 'mobile-view-editor';
          }}
        >
          <ReaderIcon width={ICON_SIZE} height={ICON_SIZE} /> view program
        </button>
        {session.status !== 'unconnected' && session.status !== 'load-error' && (
          <button
            id="explorer-explore-solutions"
            title="Explore solutions (without reloading)"
            onClick={(event) => {
              event.preventDefault();
              document.getElementById('session')!.className = 'mobile-view-explorer';
            }}
          >
            <MagnifyingGlassIcon width={ICON_SIZE} height={ICON_SIZE} /> explore
          </button>
        )}
        {session.status === 'paused' && (
          <button title="Search for more solutions" className="control" onClick={() => run()}>
            <PlayIcon width={ICON_SIZE} height={ICON_SIZE} /> resume
          </button>
        )}
        {session.status === 'running' && (
          <button title="Pause searching for solutions" className="control" onClick={() => pause()}>
            <PauseIcon width={ICON_SIZE} height={ICON_SIZE} /> pause
          </button>
        )}
        <div id="explorer-status">
          {session.status === 'unconnected' || session.status === 'load-error' ? null : (
            <>
              <span className="basic-status">
                {session.status === 'done' && session.stats.error
                  ? 'done with errors'
                  : session.status}
              </span>
              <span className="extended-status">
                {session.stats.cycles > 0 && (
                  <>
                    , {session.stats.cycles} step{session.stats.cycles !== 1 && 's'}
                  </>
                )}
                {session.stats.deadEnds > 0 && (
                  <>
                    , {session.stats.deadEnds} backtrack{session.stats.deadEnds !== 1 && 's'}
                  </>
                )}
              </span>
            </>
          )}
        </div>
      </div>
      {session.status === 'load-error' && (
        <div id="explorer-view" className="errors">
          <div className="dk-view-scroller">
            {session.errorMessage}
            <ul>
              {' '}
              {session.issues.map((issue, i) => (
                <li className="dk-error" key={i}>
                  {issue.loc && `Line ${issue.loc.start.line}: `}
                  {issue.msg}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {session.status !== 'load-error' && session.status !== 'unconnected' && (
        <div id="explorer-view">
          <SolutionViewer
            status={session.status}
            stats={session.stats}
            query={session.query}
            setSolution={setSolution}
          />
        </div>
      )}
    </>
  );
}
