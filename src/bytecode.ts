export enum Builtin {
  BOOLEAN_FALSE = 0,
  BOOLEAN_TRUE = 1,
  NAT_ZERO = 2,
  NAT_SUCC = 3,
  INT_PLUS = 4,
  INT_MINUS = 5,
  INT_TIMES = 6,
  STRING_CONCAT = 7,
  CHECK_GT = 8,
  CHECK_GEQ = 9,
  CHECK_LT = 10,
  CHECK_LEQ = 11,
  EQUAL = 12,
  NOT_EQUAL = 13,
}

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
    }
  | {
      type: 'builtin';
      inName: string;
      inVars: number;
      premise: { name: Builtin; args: Pattern[] };
      conclusion: Conclusion;
    };

export interface Program {
  seeds: string[];
  forbids: string[];
  demands: string[];
  rules: Rule[];
}
