import { Fact, factToString } from '../datalog/engine';

export interface DinnikViewResultsProps {
  type: 'ViewResults';
  results: Fact[][];
  state: 'running' | 'paused' | 'done';
}

export function DinnikViewResults(props: DinnikViewResultsProps) {
  return (
    <div>
      {props.results.length === 0 ? (
        <div>No results found</div>
      ) : (
        <>
          <div>Result #{props.results.length}</div>
          <ul>
            {props.results[props.results.length - 1].map((result, i) => (
              <li key={i}>{factToString(result)}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
