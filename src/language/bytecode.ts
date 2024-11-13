import {
  Pattern as Shape,
  Program as BytecodeProgram,
  Rule as BytecodeRule,
  Conclusion as BytecodeConclusion,
  Instruction,
} from '../bytecode.js';
import {
  BinarizedProgram,
  BinarizedRule,
  Conclusion as BinarizedConclusion,
  BuiltinRule,
} from './binarize.js';
import { BUILT_IN_PRED } from './dusa-builtins.js';
import { patternsToShapes, patternToShape } from './shape.js';

function generateConclusion(
  varsKnown: string[],
  conclusion: BinarizedConclusion,
): BytecodeConclusion {
  switch (conclusion.type) {
    case 'intermediate':
      return {
        type: 'intermediate',
        name: conclusion.name,
        vars: conclusion.vars.map((x) => varsKnown.indexOf(x)),
      };
    case 'datalog':
      return {
        type: 'datalog',
        name: conclusion.name,
        args: patternsToShapes(conclusion.args, varsKnown).shapes,
      };
    case 'closed':
    case 'open':
      return {
        type: conclusion.type,
        name: conclusion.name,
        args: patternsToShapes(conclusion.args, varsKnown).shapes,
        choices: patternsToShapes(conclusion.choices, varsKnown).shapes,
      };
  }
}

function generateRule(rule: BinarizedRule): BytecodeRule {
  switch (rule.type) {
    case 'Unary': {
      const { shapes, varsKnown } = patternsToShapes(rule.premise.args);
      return {
        type: 'unary',
        premise: { name: rule.premise.name, args: shapes },
        conclusion: generateConclusion(varsKnown, rule.conclusion),
      };
    }
    case 'Join': {
      const varsKnown = [...rule.inVars];
      const { shapes } = patternsToShapes(rule.premise.args, varsKnown);

      let shared = 0;
      for (const [i, shape] of shapes.entries()) {
        if (shape.type !== 'var') throw new Error('generateRule invariant');
        if (shape.ref === i) {
          shared += 1;
        } else {
          break;
        }
      }

      return {
        type: 'join',
        inName: rule.inName,
        inVars: rule.inVars.length,
        premise: { name: rule.premise.name, args: shapes.length },
        shared,
        conclusion: generateConclusion(varsKnown, rule.conclusion),
      };
    }
    case 'Builtin': {
      const { type, instrs, varsKnown } = generateBuiltinRule(rule);
      return {
        type,
        inName: rule.inName,
        inVars: rule.inVars.length,
        instructions: instrs,
        conclusion: generateConclusion(varsKnown, rule.conclusion),
      };
    }
  }
}

export function generateBytecode(program: BinarizedProgram): BytecodeProgram {
  return {
    seeds: program.seeds,
    forbids: program.forbids,
    demands: program.demands,
    rules: program.rules.map(generateRule),
  };
}

function pushShape(a: Shape): Instruction[] {
  switch (a.type) {
    case 'int':
    case 'bool':
    case 'string':
    case 'trivial':
      return [{ type: 'const', const: a }];

    case 'const': {
      return [
        ...a.args.flatMap((arg) => pushShape(arg)),
        { type: 'build', const: a.name, arity: a.args.length },
      ];
    }
    case 'var':
      return [{ type: 'load', ref: a.ref }];
  }
}

/**
 * Succeeds if t can be matched with s, stores any refs >= next
 *
 * Stack action: S, s |-> S
 */
function matchShape(t: Shape, next: number): { instrs: Instruction[]; next: number } {
  switch (t.type) {
    case 'var': {
      if (t.ref < next) {
        return { instrs: [{ type: 'load', ref: t.ref }, { type: 'equal' }], next };
      } else {
        // t.ref === next
        return { instrs: [{ type: 'store' }], next: next + 1 };
      }
    }
    case 'const': {
      const instrs: Instruction[] = [{ type: 'explode', const: t.name, arity: t.args.length }];
      for (const arg of t.args) {
        const result = matchShape(arg, next);
        instrs.push(...result.instrs);
        next = result.next;
      }
      return { instrs, next };
    }
    default: {
      return { instrs: [{ type: 'const', const: t }, { type: 'equal' }], next };
    }
  }
}

function maxRef(a: Shape): number {
  switch (a.type) {
    case 'var':
      return a.ref;
    case 'const':
      return a.args.reduce((prev, arg) => Math.max(prev, maxRef(arg)), -1);
    default:
      return -1;
  }
}

function match(a: Shape, b: Shape, next: number): { instrs: Instruction[]; next: number } {
  const matchA = matchShape(a, next);
  const matchB = matchShape(b, next);

  if (matchA.next === next) {
    return { instrs: [...pushShape(a), ...matchB.instrs], next: matchB.next };
  } else {
    return { instrs: [...pushShape(b), ...matchA.instrs], next: matchA.next };
  }
}

function generateBuiltinRuleWithValue(
  name: BUILT_IN_PRED,
  args: Shape[],
  value: Shape,
  next: number,
): Instruction[] {
  switch (name) {
    case 'BOOLEAN_FALSE': {
      return [
        { type: 'const', const: { type: 'bool', value: false } },
        ...matchShape(value, next).instrs,
      ];
    }
    case 'BOOLEAN_TRUE': {
      return [
        { type: 'const', const: { type: 'bool', value: true } },
        ...matchShape(value, next).instrs,
      ];
    }
    case 'NAT_ZERO': {
      return [
        { type: 'const', const: { type: 'int', value: 0n } },
        ...matchShape(value, next).instrs,
      ];
    }
    case 'NAT_SUCC': {
      const a = matchShape(args[0], next);
      const v = matchShape(value, next);
      if (a.next === next) {
        return [
          ...pushShape(args[0]),
          { type: 'const', const: { type: 'int', value: 1n } },
          ...v.instrs,
        ];
      } else {
        return [
          ...pushShape(value),
          { type: 'dup' },
          { type: 'const', const: { type: 'int', value: 1n } },
          { type: 'gt' },
          { type: 'const', const: { type: 'int', value: -1n } },
          { type: 'iplus' },
          ...v.instrs,
        ];
      }
    }
    case 'INT_PLUS': {
      const a = args.map((arg) => matchShape(arg, next));
      const unknownIndex = a.findIndex((a) => a.next !== next);
      const v = matchShape(value, next);
      if (unknownIndex === -1) {
        return [
          { type: 'const', const: { type: 'int', value: 0n } },
          ...args.flatMap<Instruction>((arg) => [...pushShape(arg), { type: 'iplus' }]),
          ...v.instrs,
        ];
      } else {
        const argsToSubtract = [...args.slice(0, unknownIndex), ...args.slice(unknownIndex + 1)];
        return [
          ...pushShape(value),
          ...argsToSubtract.flatMap<Instruction>((arg) => [
            ...pushShape(arg),
            { type: 'ineg' },
            { type: 'iplus' },
          ]),
          ...a[unknownIndex].instrs,
        ];
      }
    }
    default: {
      throw new Error(`builtin ${name} not handled`);
    }
  }
}

function generateBuiltinRule(rule: BuiltinRule): {
  type: 'run' | 'run_for_failure';
  instrs: Instruction[];
  varsKnown: string[];
} {
  let type: 'run' | 'run_for_failure';
  let instrs: Instruction[];
  let { shapes, varsKnown } = patternsToShapes(rule.premise.args, rule.inVars);

  switch (rule.premise.name) {
    case 'Gt': {
      type = 'run';
      instrs = [...pushShape(shapes[0]), ...pushShape(shapes[1]), { type: 'gt' }];
      break;
    }
    case 'Lt': {
      type = 'run';
      instrs = [...pushShape(shapes[1]), ...pushShape(shapes[0]), { type: 'gt' }];
      break;
    }
    case 'Geq': {
      type = 'run_for_failure';
      instrs = [...pushShape(shapes[1]), ...pushShape(shapes[0]), { type: 'gt' }];
      break;
    }
    case 'Leq': {
      type = 'run_for_failure';
      instrs = [...pushShape(shapes[0]), ...pushShape(shapes[1]), { type: 'gt' }];
      break;
    }
    case 'Equality': {
      type = 'run';
      instrs = match(shapes[0], shapes[1], rule.inVars.length).instrs;
      break;
    }
    case 'Inequality': {
      type = 'run_for_failure';
      instrs = match(shapes[0], shapes[1], rule.inVars.length).instrs;
      break;
    }
    default: {
      const v = patternToShape(rule.premise.value, varsKnown);
      const instrs = generateBuiltinRuleWithValue(
        rule.premise.name,
        shapes,
        v.shape,
        rule.inVars.length,
      );
      return { type: 'run', instrs, varsKnown: v.varsKnown };
    }
  }
  return { type, instrs, varsKnown };
}
