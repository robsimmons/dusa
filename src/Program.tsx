import { factToString } from './datalog/engine';
import { Session } from './sessions';

interface Props {
  session: Session;
  load: () => void;
  run: () => void;
  pause: () => void;
}

export default function Program({ load, run, pause, session }: Props) {
  if (session.status === 'unconnected') {
    return (
      <>
        <div className="dk-view-header">
          <button
            title="Load program"
            onClick={(event) => {
              event.preventDefault();
              load();
            }}
          >
            <span className="fa-solid fa-right-to-bracket" />
          </button>
          <span className="dk-view-status">program not loaded</span>
        </div>
      </>
    );
  }

  const loadButton = (
    <button
      title="Reset and reoad program"
      onClick={(event) => {
        event.preventDefault();
        load();
      }}
    >
      <span className="fa-solid fa-right-to-bracket" />
    </button>
  );

  const reloadBar = session.textModified ? (
    <div className="dk-view-edit-warning">
      The program has been modified!{' '}
      <a
        href=""
        onClick={(event) => {
          event.preventDefault();
          load();
        }}
      >
        Reload
      </a>
    </div>
  ) : (
    <div></div>
  );

  const stats = (
    <div className="dk-view-status">
      {session.status === 'error' ? (
        session.errorMessage
      ) : session.stats === null ? (
        'ready'
      ) : (
        <span>
          <span className="fa-solid fa-worm" /> {session.stats.cycles} step
          {session.stats.cycles !== 1 && 's'} <span className="fa-solid fa-lightbulb" />{' '}
          {session.facts.length} solution{session.facts.length !== 1 && 's'}{' '}
          {session.stats.deadEnds > 0 && (
            <>
              <span className="fa-solid fa-broom" /> {session.stats.deadEnds} backtrack
              {session.stats.deadEnds !== 1 && 's'}
            </>
          )}
        </span>
      )}
    </div>
  );

  if (session.status === 'error') {
    return (
      <>
        <div className="dk-view-header">
          {loadButton}
          {stats}
        </div>
        {reloadBar}
        <div className="dk-view-errors">
          <div className="dk-view-scroller">
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
      </>
    );
  }

  return (
    <>
      <div className="dk-view-header">
        {loadButton}
        {session.status === 'paused' && (
          <button title="Search for more solutions" onClick={() => run()}>
            <span className="fa-solid fa-play" />
          </button>
        )}
        {session.status === 'running' && (
          <button title="Pause searching for solutions" onClick={() => pause()}>
            <span className="fa-solid fa-pause" />
          </button>
        )}
        {stats}
      </div>
      {reloadBar}
      {session.facts.length > 0 && (
        /* TODO: make dk-scroller end --dk-medium-padding above the bottom */
        <div className="dk-view-solutions">
          <div className="dk-view-scroller">
            <div>Result #{session.facts.length}</div>
            <ul>
              {session.facts[session.facts.length - 1]
                .map((fact) => factToString(fact))
                .sort()
                .map((fact, i) => (
                  <li key={i}>{fact}</li>
                ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
