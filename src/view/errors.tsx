import { SourceLocation } from '../datalog/parsing/source-location';

export interface DinnikViewErrorProps {
  type: 'ViewError';
  issues: { loc?: SourceLocation; msg: string }[];
}

export function DinnikViewError(props: DinnikViewErrorProps) {
    console.log(props);
  return (
    <div className="dk-view-errors">
      <div>
        Cannot load program, {props.issues.length} error{props.issues.length === 1 ? '' : 's'}
      </div>
      <ul>
        {props.issues.map((issue, i) => (
          <li className="dk-error" key={i}>
            {issue.loc && `Line ${issue.loc.start.line}: `}
            {issue.msg}
          </li>
        ))}
      </ul>
    </div>
  );
}
