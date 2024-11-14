import { ConclusionN, PatternN, ProgramN, RuleN } from './bytecode.js';

const MAX_INT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_INT = BigInt(Number.MIN_SAFE_INTEGER);

function bigintToJSON(n: bigint): string | number {
  if (n < MIN_INT || n > MAX_INT) {
    return `${n}`;
  } else {
    return Number(n);
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
        instructions: rule.instructions.map((instr) => {
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
    rules: prog.rules.map(ruleToJSON),
  };
}
