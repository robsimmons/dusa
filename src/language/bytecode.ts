import {
  Pattern as Shape,
  Program as BytecodeProgram,
  Rule as BytecodeRule,
  Conclusion as BytecodeConclusion,
} from '../bytecode.js';
import {
  BinarizedProgram,
  BinarizedRule,
  Conclusion as BinarizedConclusion,
  BuiltinRule,
} from './binarize.js';
import { patternsToShapes } from './shape.js';

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
      throw new Error('TODO');
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

type Instruction =
  | { type: 'var'; ref: number }
  | { type: 'build'; const: string; arity: number }
  | {
      type: 'const';
      const:
        | { type: 'trivial' }
        | { type: 'int'; value: bigint }
        | { type: 'bool'; value: boolean }
        | { type: 'string'; value: string };
    }
  | { type: 'store'; ref: number }
  | { type: 'fail' };

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
      return [{ type: 'var', ref: a.ref }];
  }
}

function match(a: Shape, b: Shape, next: number): { instrs: Instruction[]; next: number } {
  if (a.type === 'var' && a.ref == next) {
    return { instrs: [...pushShape(b), { type: 'store', ref: a.ref }], next: next + 1 };
  }
  if (b.type === 'var' && b.ref == next) {
    return { instrs: [...pushShape(a), { type: 'store', ref: b.ref }], next: next + 1 };
  }
  if ()
}

function generateBuiltin(rule: BuiltinRule) {
  switch (rule.premise.name) {
    case 'Inequality':
  }
}
