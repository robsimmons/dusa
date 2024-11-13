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
    }
  | {
      type: 'run';
      inName: string;
      inVars: number;
      instructions: InstructionN<N>[];
      conclusion: ConclusionN<N>;
    }
  | {
      type: 'run_for_failure';
      inName: string;
      inVars: number;
      instructions: InstructionN<N>[];
      conclusion: ConclusionN<N>;
    };

export interface ProgramN<N> {
  seeds: string[];
  forbids: string[];
  demands: string[];
  rules: RuleN<N>[];
}

/**
 * Computed premises are expanded out into a little stack-based, non-branching
 * "bytecode" programs. The virtual machine has a operational stack, and instead
 * of registers or memory the there is a memory initialized to `inVars` that can be
 * have new values written once (`store`) and accessed randomly (`var`).
 *
 * Many instructions are run primarily because they might fail, which means the rule
 * won't fire if it's a `run` rule, and means that the rule **will** fire if it's a
 * 'run_for_failure' rule.
 */
export type InstructionN<N> =
  | { type: 'store' } // S,[t] |-> S -- stores [t] in the next memory location
  | { type: 'load'; ref: number } // S |-> S,[t] -- reads [t] from memory location `ref`
  | { type: 'build'; const: string; arity: number } // S,[t1],[t2],...,[tk] |-> S,[c t1...tk]
  | { type: 'explode'; const: string; arity: number } // S,[c t1...tk)] |-> S,[tk],...,[t1] -- fails if the top of the stack is not a constructed term with constructor `const` and arity `arity`
  | {
      type: 'const';
      const:
        | { type: 'trivial' }
        | { type: 'int'; value: N }
        | { type: 'bool'; value: boolean }
        | { type: 'string'; value: string };
    } // S |-> S,[t]
  | { type: 'equal' } // S,[s],[t] |-> S -- fails if `t != s`
  | { type: 'dup' } // S,[t] |-> S,[t],[t]
  | { type: 'gt' } // S,[n],[m] |-> S -- fails if n or m are not both integers or both strings, or if n <= m
  | { type: 'geq' } // S,[n],[m] |-> S -- fails if n or m are not both integers or both strings, or if n < m
  | { type: 'i_add' } // S,[n],[m] |-> S,[n+m] -- fails if n and m are not both integers
  | { type: 'i_sub' } // S,[n],[m] |-> S,[n-m] -- fails if n and m are not both integers
  | { type: 'i_mul' } // S,[n],[m] |-> S,[n*m] -- fails if n and m are not both integers
  | { type: 's_concat' } // S,[s],[t] |-> S,[s++t] -- fails if s and t are not both strings
  | { type: 's_starts' } // S,[t++s],[t] |-> S,[s] -- fails if the first string does not have t as a prefix
  | { type: 's_ends' }; // S,[s++t],[t] |-> S,[s] -- fails if the first string does not have t as a postfix

export type Pattern = PatternN<bigint>;
export type Instruction = InstructionN<bigint>;
export type Conclusion = ConclusionN<bigint>;
export type Rule = RuleN<bigint>;
export type Program = ProgramN<bigint>;
