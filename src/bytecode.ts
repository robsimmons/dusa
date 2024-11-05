export type PatternN<N> =
  | { type: 'trivial' }
  | { type: 'int'; value: N }
  | { type: 'bool'; value: boolean }
  | { type: 'string'; value: string }
  | { type: 'const'; name: string; args: PatternN<N>[] }
  | { type: 'var'; ref: number };

export type ConclusionN<N> =
  | { type: 'intermediate'; name: string; vars: number[] }
  | { type: 'datalog'; name: string; args: PatternN<N>[] }
  | { type: 'open'; name: string; args: PatternN<N>[]; choices: PatternN<N>[] }
  | { type: 'closed'; name: string; args: PatternN<N>[]; choices: PatternN<N>[] };

export type RuleN<N> =
  | {
      type: 'unary';
      premise: { name: string; args: PatternN<N>[] };
      conclusion: ConclusionN<N>;
    }
  | {
      type: 'join';
      inName: string;
      inVars: number;
      premise: { name: string; args: number };
      shared: number;
      conclusion: ConclusionN<N>;
    };

export interface ProgramN<N> {
  seeds: string[];
  forbids: string[];
  demands: string[];
  rules: RuleN<N>[];
}

export type Pattern = PatternN<bigint>;
export type Conclusion = ConclusionN<bigint>;
export type Rule = RuleN<bigint>;
export type Program = ProgramN<bigint>;
