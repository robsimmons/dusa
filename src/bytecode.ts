/**
 * Predicates in a bytecode program have two namespaces: the namespace of
 * intermediates, which correspond to partially applied premises, is separate
 * from the namespace of 'standard' facts. The Dusa bytecode compiler creates
 * new 'standard' predicates; these are marked with a `$` to indicate that an
 * implementation may want to hide these from the user. Intermediates
 * predicates should almost always be hidden from the user.
 *
 * A program is made of `seeds` (unequivocally true premise-free normal
 * facts), `forbids` (intermediate predicates that cannot hold in a valid
 * solution), `demands` (intermediate predicates that must hold in a valid
 * solution), and rules.
 *
 * The Dusa implementation uses JavaScript BigInt values to represent
 * integers, but these are not particularly well supported: the default JSON
 * encoders and decoders, in particular, do not support them. Therefore, all
 * our definitions are parameterized over the type of integer representation;
 * we can define functions that map between `Program = ProgramN<bigint>`,
 * which the implementation uses internally, and various
 * serialization-friendly options, like ProgramN<string> or ProgramN<number>
 * or ProgramN<number | string>
 */
export interface ProgramN<Int> {
  seeds: string[];
  forbids: string[];
  demands: string[];
  rules: RuleN<Int>[];
  arities: { [pred: string]: { args: number; value: boolean } };
}

/**
 * When scanning a rule or pattern left to right, the first occurrence of
 * variables must occur numeric order without gaps: the first variable seen
 * is 0, the second is 1, and so on. In these comments we'll write this as
 * `X0`, `X1`, `X2`, etc.
 */
export type PatternN<Int> =
  | { type: 'trivial' }
  | { type: 'int'; value: Int }
  | { type: 'bool'; value: boolean }
  | { type: 'string'; value: string }
  | { type: 'const'; name: string; args: PatternN<Int>[] }
  | { type: 'var'; ref: number };

/** A conclusion can come in several forms:
 *
 * - intermediate: `a-3-2 X1 X9 X0 X0 :- ...`
 * - datalog: `p (f X0 X3) (X3 X1) :- ...`
 * - open: `q 3 (f X0) is? { 9, X2, "c" } :- ...`
 * - closed: `q X2 X2 is { tt, ff, X1 } :- ...`
 *
 * Note that the variables above can occur in any order: all variables in a
 * conclusion must have had their first occurrence in a premise.
 */
export type ConclusionN<Int> =
  | { type: 'intermediate'; name: string; vars: number[] }
  | { type: 'datalog'; name: string; args: PatternN<Int>[] }
  | { type: 'open'; name: string; args: PatternN<Int>[]; choices: PatternN<Int>[] }
  | { type: 'closed'; name: string; args: PatternN<Int>[]; choices: PatternN<Int>[] };

/**
 * A unary rule has the form
 *
 * ```
 * H :- p X0 (f X1 X0) X2.
 * ```
 *
 * with the first occurrence of a variable always taking the smallest possible
 * integer value.
 */
export interface UnaryRuleN<Int> {
  type: 'unary';
  premise: { name: string; args: PatternN<Int>[] };
  conclusion: ConclusionN<Int>;
}

/**
 * A join rule has two premises. The variables for the
 * first, intermediate, premise are numbered `0...inVars`,
 * and the variables for the second premise share the first
 * `shared` arguments in common with the first premise and then
 * are sequentially numbered with the lowest possible numbers.
 *
 * That means that the variable pattern for a rule like this:
 *
 * ```
 * H :- inter X0 X1 X2 X3, p X0 X1 X4
 * ```
 *
 * Can be captured just by saying `shared === 2`, `inVars === 4`,
 * and `premise.args === 3`.
 *
 * In a join rule, we may not list all the arguments of the normal
 * premise. If a normal premise has facts of the form `foo 3 1 is "hi"`,
 * then it may appear in a join rule as
 *
 * ```
 * H :- inter X0 X1 X2 X3, foo (shared:0, inVars:4, premise.args:0)
 * H :- inter X0 X1 X2 X3, foo X0 (shared:1, inVars:4, premise.args:1)
 * H :- inter X0 X1 X2 X3, foo X4 X5 (shared:0, inVars:4, premise.args:2)
 * H :- inter X0 X1 X2 X3, foo X0 X4 X5 (shared:1, inVars:4, premise.args:3)
 * ```
 */
export interface JoinRuleN<Int> {
  type: 'join';
  inName: string;
  inVars: number;
  premise: { name: string; args: number };
  shared: number;
  conclusion: ConclusionN<Int>;
}

/**
 * The allowable value(s) for the second premise of a RunRule are determined
 * by running a little stack-machine program (see the definition of
 * InstructionN)
 */
export interface RunRuleN<Int> {
  type: 'run';
  inName: string;
  inVars: number;
  instructions: InstructionN<Int>[];
  conclusion: ConclusionN<Int>;
}

/**
 * To implement premises like `X !== a _`, we need to be able to have a
 * run-rule that works via negation-as-failure.
 */
export interface RunForFailureRuleN<Int> {
  type: 'run_for_failure';
  inName: string;
  inVars: number;
  instructions: InstructionN<Int>[];
  conclusion: ConclusionN<Int>;
}

export type RuleN<Int> = UnaryRuleN<Int> | JoinRuleN<Int> | RunRuleN<Int> | RunForFailureRuleN<Int>;

/**
 * Built-in premises are expanded out into a little stack-based, non-branching
 * programs. The virtual machine has a operational stack, and instead of
 * registers or memory the there is a memory initialized to `inVars` that can
 * have new values written once (`store`) and accessed randomly (`load`).
 *
 * Many instructions are run primarily because they might fail; failure means
 * the rule won't fire if it's a `run` rule, and means that the rule **will**
 * fire if it's a 'run_for_failure' rule.
 *
 * - `store: S,[t] |-> S` -- stores [t] in the next memory location
 * - `load: S |-> S,[t]` -- reads [t] from memory location `ref` (the VM can
 *   assume this reference will be valid, and it's undefined what happens if
 *   that's not the case)
 * - `build c k: `S,[t1],[t2],...,[tk] |-> S,[c t1...tk]`
 * - `explode c k: S,[c t1...tk)] |-> S,[tk],...,[t1]` -- fails if the top of
 *   the stack is not a constructed term with constructor `const` and arity
 *   `arity`
 * - `const t: S |-> S,[t]`
 * - `equal: S,[s],[t] |-> S` -- fails unless `t == s`
 * - `dup: S,[t] |-> S,[t],[t]`
 * - `gt: S,[n],[m] |-> S` -- fails unless `n` and `m` are both integers or
 *   are both strings, and unless `n > m` (for strings, this depends on
 *   internationalization and may be implementation-dependent)
 * - `geq: S,[n],[m] |-> S` -- same as `gt`, but also succeeds if `n` and `m`
 *   are the same integer or the same string
 * - `i_add: S,[n],[m] |-> S,[n+m]` -- fails if `n` and `m` are not both
 *   integers
 * - `i_sub: S,[n],[m] |-> S,[n-m]` -- fails if `n` and `m` are not both
 *   integers
 * - `i_mul: S,[n],[m] |-> S,[n*m]` -- fails if `n` and `m` are not both
 *   integers
 * - `s_concat: S,[s],[t] |-> S,[s++t]` -- fails if `s` and `t` are not both
 *   strings
 * - `s_starts: S,[s],[t] |-> S,[r]` where `s == t++r` -- fails if `s` and `t`
 *   are not both strings, or if `t` is not a prefix of `s`
 * - `s_ends: S,[s],[t] |-> S,[r]` where `s == r++t` -- fails if `s` and `t`
 *   are not both strings, or if `t` is not a postfix of `s`
 *
 * The VM can always assume the stack will contain the required number of
 * elements, and it's undefined what happens if that's not the case.
 */
export type InstructionN<N> =
  | { type: 'store' }
  | { type: 'load'; ref: number }
  | { type: 'build'; const: string; arity: number }
  | { type: 'explode'; const: string; arity: number }
  | {
      type: 'const';
      const:
        | { type: 'trivial' }
        | { type: 'int'; value: N }
        | { type: 'bool'; value: boolean }
        | { type: 'string'; value: string };
    }
  | { type: 'equal' }
  | { type: 'dup' }
  | { type: 'gt' }
  | { type: 'geq' }
  | { type: 'i_add' }
  | { type: 'i_sub' }
  | { type: 'i_mul' }
  | { type: 's_concat' }
  | { type: 's_starts' }
  | { type: 's_ends' };

export type Pattern = PatternN<bigint>;
export type Instruction = InstructionN<bigint>;
export type Conclusion = ConclusionN<bigint>;
export type Rule = RuleN<bigint>;
export type Program = ProgramN<bigint>;
