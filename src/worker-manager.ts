import { Fact } from './datalog/engine';
import { SourceLocation } from './datalog/parsing/source-location';

export interface DinnikWorkerSession {
  worker: Worker;
  facts: Fact[][];
  issues: { msg: string; loc?: SourceLocation }[];
  errorMessage: string;
  status: 'unconnected' | 'unloaded' | 'running' | 'paused' | 'done' | 'error';
  stats: { cycles: number };
}
