import { ConclusionN, InstructionN, PatternN, ProgramN, RuleN } from './bytecode.js';
import { Term } from './termoutput.js';

const MAX_INT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_INT = BigInt(Number.MIN_SAFE_INTEGER);

function bigintToJSON(n: bigint): string | number {
  if (n < MIN_INT || n > MAX_INT) {
    return `${n}`;
  } else {
    return Number(n);
  }
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function termToJson(t: Term): any {
  if (t === null || typeof t === 'string' || typeof t === 'boolean') return t;
  if (typeof t === 'bigint') {
    return bigintToJSON(t);
  }
  if (typeof t === 'object') {
    if (t.name === null) return t;
    if (!t.args) return { name: t.name };
    return { name: t.name, args: t.args.map(termToJson) };
  }
}

function patternToJSON(tm: PatternN<bigint>): PatternN<string | number> {
  switch (tm.type) {
    case 'int': {
      return { type: tm.type, value: bigintToJSON(tm.value) };
    }
    case 'const': {
      return { type: tm.type, name: tm.name, args: tm.args.map(patternToJSON) };
    }
    default: {
      return tm;
    }
  }
}

function conclusionToJSON(conc: ConclusionN<bigint>): ConclusionN<string | number> {
  switch (conc.type) {
    case 'datalog': {
      return { type: conc.type, name: conc.name, args: conc.args.map(patternToJSON) };
    }
    case 'closed':
    case 'open': {
      return {
        type: conc.type,
        name: conc.name,
        args: conc.args.map(patternToJSON),
        choices: conc.choices.map(patternToJSON),
      };
    }
    case 'intermediate': {
      return conc;
    }
  }
}

function ruleToJSON(rule: RuleN<bigint>): RuleN<string | number> {
  switch (rule.type) {
    case 'unary':
      return {
        type: rule.type,
        premise: { name: rule.premise.name, args: rule.premise.args.map(patternToJSON) },
        conclusion: conclusionToJSON(rule.conclusion),
      };
    case 'join': {
      return {
        type: rule.type,
        inName: rule.inName,
        inVars: rule.inVars,
        premise: rule.premise,
        shared: rule.shared,
        conclusion: conclusionToJSON(rule.conclusion),
      };
    }
    case 'run':
    case 'run_for_failure': {
      return {
        type: rule.type,
        inName: rule.inName,
        inVars: rule.inVars,
        conclusion: conclusionToJSON(rule.conclusion),
        instructions: rule.instructions.map<InstructionN<string | number>>((instr) => {
          switch (instr.type) {
            case 'const': {
              switch (instr.const.type) {
                case 'int': {
                  return {
                    type: instr.type,
                    const: { type: instr.const.type, value: bigintToJSON(instr.const.value) },
                  };
                }
                default: {
                  return {
                    type: instr.type,
                    const: instr.const,
                  };
                }
              }
            }
            default: {
              return instr;
            }
            case 'nondet_s_concat': {
              return {
                type: instr.type,
                pattern: instr.pattern.map((pat) =>
                  typeof pat !== 'number' && pat.type === 'int'
                    ? { type: 'int', value: bigintToJSON(pat.value) }
                    : pat,
                ),
              };
            }
          }
        }),
      };
    }
  }
}

export function bytecodeToJSON(prog: ProgramN<bigint>): ProgramN<string | number> {
  return {
    seeds: prog.seeds,
    forbids: prog.forbids,
    demands: prog.demands,
    arities: prog.arities,
    lazy: prog.lazy,
    rules: prog.rules.map(ruleToJSON),
  };
}
