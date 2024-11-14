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
      const { shapes, varsKnown } = patternsToShapes(rule.premise.args, [...rule.inVars]);

      let shared = 0;
      for (const [i, shape] of shapes.entries()) {
        if (shape.type !== 'var') throw new Error('generateRule invariant');
        if (i < rule.inVars.length && shape.ref === i) {
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

export function generateBytecode(
  program: BinarizedProgram,
  aritiesMap: Map<string, { args: number; value: boolean }>,
): BytecodeProgram {
  const arities: { [pred: string]: { args: number; value: boolean } } = {};
  for (const [pred, arity] of aritiesMap.entries()) {
    arities[pred] = arity;
  }
  return {
    seeds: program.seeds,
    forbids: program.forbids,
    demands: program.demands,
    rules: program.rules.map(generateRule),
    arities,
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
          ...pushShape(args[0]), // S |-> S,[v]
          { type: 'dup' }, // |-> S,[v],[v]
          { type: 'const', const: { type: 'int', value: -1n } }, // |-> S,[v],[v],[-1]
          { type: 'gt' }, // |-> S,[v]
          { type: 'const', const: { type: 'int', value: 1n } }, // |-> S,[v],[1]
          { type: 'i_add' }, // |-> S,[v-1]
          ...v.instrs, // |-> S
        ];
      } else {
        return [
          ...pushShape(value), // S |-> S,[v]
          { type: 'dup' }, // |-> S,[v],[v]
          { type: 'const', const: { type: 'int', value: 0n } }, // |-> S,[v],[v],[0]
          { type: 'gt' }, // |-> S,[v]
          { type: 'const', const: { type: 'int', value: -1n } }, // |-> S,[v],[-1]
          { type: 'i_add' }, // |-> S,[v-1]
          ...a.instrs, // |-> S
        ];
      }
    }
    case 'INT_PLUS': {
      const a = args.map((arg) => matchShape(arg, next));
      const unknownIndex = a.findIndex((a) => a.next !== next);
      if (unknownIndex === -1) {
        return [
          ...pushShape(args[0]),
          ...args.slice(1).flatMap<Instruction>((arg) => [...pushShape(arg), { type: 'i_add' }]),
          ...matchShape(value, next).instrs,
        ];
      } else {
        const argsToSubtract = [...args.slice(0, unknownIndex), ...args.slice(unknownIndex + 1)];
        return [
          ...pushShape(value),
          ...argsToSubtract.flatMap<Instruction>((arg) => [...pushShape(arg), { type: 'i_sub' }]),
          ...a[unknownIndex].instrs,
        ];
      }
    }
    case 'INT_MINUS': {
      const a = matchShape(args[0], next);
      const b = matchShape(args[1], next);
      const v = matchShape(value, next);
      if (a.next !== next) {
        return [...pushShape(args[1]), ...pushShape(value), { type: 'i_add' }, ...a.instrs];
      } else if (b.next !== next) {
        return [...pushShape(args[0]), ...pushShape(value), { type: 'i_sub' }, ...b.instrs];
      } else {
        return [...pushShape(args[0]), ...pushShape(args[1]), { type: 'i_sub' }, ...v.instrs];
      }
    }
    case 'INT_TIMES': {
      return [
        ...pushShape(args[0]),
        ...args.slice(1).flatMap<Instruction>((arg) => [...pushShape(arg), { type: 'i_mul' }]),
        ...matchShape(value, next).instrs,
      ];
    }
    case 'STRING_CONCAT': {
      const a = args.map((arg) => matchShape(arg, next));
      const unknownIndex = a.findIndex((a) => a.next !== next);
      if (unknownIndex === -1) {
        return [
          ...pushShape(args[0]),
          ...args.slice(1).flatMap<Instruction>((arg) => [...pushShape(arg), { type: 's_concat' }]),
          ...matchShape(value, next).instrs,
        ];
      } else {
        const prefix = args.slice(0, unknownIndex);
        const postfix = args.slice(unknownIndex + 1).toReversed();
        return [
          ...pushShape(value),
          ...prefix.flatMap<Instruction>((arg) => [...pushShape(arg), { type: 's_starts' }]),
          ...postfix.flatMap<Instruction>((arg) => [...pushShape(arg), { type: 's_ends' }]),
          ...a[unknownIndex].instrs,
        ];
      }
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
  const { shapes, varsKnown } = patternsToShapes(rule.premise.args, rule.inVars);

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
      type = 'run';
      instrs = [...pushShape(shapes[0]), ...pushShape(shapes[1]), { type: 'geq' }];
      break;
    }
    case 'Leq': {
      type = 'run';
      instrs = [...pushShape(shapes[1]), ...pushShape(shapes[0]), { type: 'geq' }];
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
