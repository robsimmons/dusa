import { useDinnikWorker } from './manager';
import { factToString } from './datalog/engine';

interface DinnikViewerProps {
  programModified: boolean;
  getProgram: () => string;
}

export default function DinnikViewer(props: DinnikViewerProps) {
  const worker = useDinnikWorker();

  if (worker.type === 'unready') {
    return <div className="dk-view"></div>;
  }

  if (worker.type === 'unloaded') {
    return (
      <div className="dk-view">
        <div className={`dk-view-header dk-view-status-unloaded'}`}>
          <button
            className="dk-load-button"
            title="Load program"
            onClick={() => worker.load(props.getProgram())}
          >
            <span className="fa-solid fa-right-to-bracket" />
          </button>
          <div className="dk-view-status">program not loaded</div>
        </div>
      </div>
    );
  }

  const loadButton = (
    <button
      className="dk-load-button"
      title="Load program"
      onClick={() => worker.reload(props.getProgram())}
    >
      <span className="fa-solid fa-right-to-bracket" />
    </button>
  );

  if (worker.type === 'error') {
    return (
      <div className="dk-view">
        <div className="dk-view-header dk-view-status-error">
          {loadButton}
          <div className="dk-view-status">{worker.msg}</div>
        </div>
        <div className="dk-view-errors">
          <ul>
            {worker.errors.map((error, i) => (
              <li className="dk-error" key={i}>
                {error.loc && `Line ${error.loc.start.line}: `}
                {error.msg}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="dk-view">
      <div className="dk-view-header dk-view-status-ok">
        {loadButton}
        {worker.type === 'paused' && (
          <button className="dk-load-button" title="Unload program" onClick={worker.go}>
            <span className="fa-solid fa-play"></span>
          </button>
        )}
        {worker.type === 'running' && (
          <button className="dk-load-button" title="Unload program" onClick={worker.stop}>
            <span className="fa-solid fa-pause"></span>
          </button>
        )}
        <div className="dk-view-status">
          <div>
            <span className="fa-solid fa-worm" /> {worker.stats.cycles} step
            {worker.stats.cycles !== 1 && 's'} <span className="fa-solid fa-lightbulb" />{' '}
            {worker.facts.length} solution
            {worker.facts.length !== 1 && 's'}
            {worker.type === 'done' && ' (finished)'}
            {worker.type === 'paused' && ' (paused)'}
          </div>
        </div>
      </div>
      {worker.facts.length > 0 && (
        <div className="dk-view-solutions">
          <div>Result #{worker.facts.length}</div>
          <ul>
            {worker.facts[worker.facts.length - 1].map((result, i) => (
              <li key={i}>{factToString(result)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

}
