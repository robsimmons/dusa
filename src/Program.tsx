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

  if (session.status === 'error') {
    return (
      <>
        <div className="dk-view-header">
          {loadButton}
          <div className="dk-view-status">{session.errorMessage}</div>
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
            <span className="fa-solid fa-play" />
          </button>
        )}
        {session.status}
        {session.facts.length}
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
