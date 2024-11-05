export type Pattern =
  | { type: 'trivial' }
  | { type: 'int'; value: bigint }
  | { type: 'bool'; value: boolean }
  | { type: 'string'; value: string }
  | { type: 'const'; name: string; args: Pattern[] }
  | { type: 'var'; ref: number };

export type Conclusion =
  | { type: 'intermediate'; name: string; vars: number[] }
  | { type: 'datalog'; name: string; args: Pattern[] }
  | { type: 'open'; name: string; args: Pattern[]; values: Pattern[] }
  | { type: 'closed'; name: string; args: Pattern[]; values: Pattern[] };

export type Rule =
  | {
      type: 'unary';
      premise: { name: string; args: Pattern[] };
      conclusion: Conclusion;
    }
  | {
      type: 'join';
      inName: string;
      inVars: number;
      premise: { name: string; args: number };
      shared: number;
      conclusion: Conclusion;
    };

export interface Program {
  seeds: string[];
  forbids: string[];
  demands: string[];
  rules: Rule[];
}
