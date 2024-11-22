import {
  Pattern,
  ConclusionN,
  ProgramN,
  PatternN,
  Instruction,
  InstructionN,
} from '../bytecode.js';
import { HashCons } from '../datastructures/data.js';

type ConclusionInput = ConclusionN<bigint | string | number>;
type PatternInput = PatternN<bigint | string | number>;
type ProgramInput = ProgramN<bigint | string | number>;
type InstructionInput = InstructionN<bigint | string | number>;

export type CPattern =
  | { type: 'trivial' }
  | { type: 'int'; value: bigint }
  | { type: 'bool'; value: boolean }
  | { type: 'string'; value: string }
  | { type: 'const'; name: string; args: CPattern[] }
  | { type: 'var'; ref: number }
  | { type: 'pass'; ref: number }
  | { type: 'intro'; ref: number };

export type Conclusion =
  | { type: 'intermediate'; name: string; args: CPattern[] }
  | { type: 'datalog'; name: string; args: CPattern[] }
  | { type: 'open'; name: string; args: CPattern[]; choices: CPattern[] }
  | { type: 'closed'; name: string; args: CPattern[]; choices: CPattern[] };

type PredUnary = {
  [pred: string]: {
    args: Pattern[];
    conclusion: Conclusion;
  }[];
};

type PredBinary = {
  [pred: string]: {
    inName: string;
    inVars: { shared: number; passed: number };
    conclusion: Conclusion;
  }[];
};

type Intermediates = {
  [inName: string]: {
    inVars: { shared: number; total: number };
    premise: { name: string; introduced: number };
    conclusion: Conclusion;
  }[];
};

type Subprograms = {
  [inName: string]: {
    inVars: number;
    instructions: Instruction[];
    runForFailure: boolean;
    conclusion: Conclusion;
  }[];
};

export interface Program {
  seeds: string[];
  arities: { [pred: string]: { args: number; value: boolean } };
  predUnary: PredUnary;
  predBinary: PredBinary;
  intermediates: Intermediates;
  subprograms: Subprograms;
  demands: string[];
  forbids: { [inName: string]: true };
  data: HashCons;
}

function ingestCPattern(pattern: PatternInput, shared: number, passed: number): CPattern {
  if (pattern.type === 'int') {
    return { type: 'int', value: BigInt(pattern.value) };
  }
  if (pattern.type === 'const') {
    return {
      type: 'const',
      name: pattern.name,
      args: pattern.args.map((arg) => ingestCPattern(arg, shared, passed)),
    };
  }
  if (pattern.type === 'var') {
    if (pattern.ref < shared) return pattern;
    if (pattern.ref < shared + passed) return { type: 'pass', ref: pattern.ref - shared };
    return { type: 'intro', ref: pattern.ref - shared - passed };
  }
  return pattern;
}

function ingestPattern(pattern: PatternInput): Pattern {
  if (pattern.type === 'int') {
    return { type: 'int', value: BigInt(pattern.value) };
  }
  if (pattern.type === 'const') {
    return { type: 'const', name: pattern.name, args: pattern.args.map(ingestPattern) };
  }
  return pattern;
}

function ingestConclusion(conclusion: ConclusionInput, shared: number, passed: number): Conclusion {
  switch (conclusion.type) {
    case 'intermediate':
      return {
        type: 'intermediate',
        name: `@${conclusion.name}`,
        args: conclusion.vars.map((ref) => ingestCPattern({ type: 'var', ref }, shared, passed)),
      };
    case 'datalog':
      return {
        type: 'datalog',
        name: conclusion.name,
        args: conclusion.args.map((arg) => ingestCPattern(arg, shared, passed)),
      };
    case 'closed':
    case 'open':
      return {
        type: conclusion.type,
        name: conclusion.name,
        args: conclusion.args.map((arg) => ingestCPattern(arg, shared, passed)),
        choices: conclusion.choices.map((arg) => ingestCPattern(arg, shared, passed)),
      };
  }
}

function ingestInstruction(instruction: InstructionInput): Instruction {
  switch (instruction.type) {
    case 'const': {
      switch (instruction.const.type) {
        case 'int':
          return { type: 'const', const: { type: 'int', value: BigInt(instruction.const.value) } };
        default:
          return { type: 'const', const: instruction.const };
      }
    }
    default: {
      return instruction;
    }
  }
}

export function ingestBytecodeProgram(prog: ProgramInput): Program {
  const predUnary: PredUnary = {};
  const predBinary: PredBinary = {};
  const intermediates: Intermediates = {};
  const subprograms: Subprograms = {};
  for (const rule of prog.rules) {
    switch (rule.type) {
      case 'unary': {
        const matches = predUnary[rule.premise.name] ?? [];
        matches.push({
          args: rule.premise.args.map(ingestPattern),
          conclusion: ingestConclusion(rule.conclusion, Infinity, 0),
        });
        predUnary[rule.premise.name] = matches;
        continue;
      }
      case 'join': {
        const passed = rule.inVars - rule.shared;
        const introduced = rule.premise.args - rule.shared;

        const intermediateMatches = intermediates[`@${rule.inName}`] ?? [];
        intermediates[`@${rule.inName}`] = intermediateMatches;
        intermediateMatches.push({
          inVars: { shared: rule.shared, total: rule.inVars },
          premise: { name: rule.premise.name, introduced },
          conclusion: ingestConclusion(rule.conclusion, rule.shared, passed),
        });

        const indexMatches = predBinary[rule.premise.name] ?? [];
        predBinary[rule.premise.name] = indexMatches;
        indexMatches.push({
          inName: `@${rule.inName}`,
          inVars: { shared: rule.shared, passed },
          conclusion: ingestConclusion(rule.conclusion, rule.shared, passed),
        });
        continue;
      }
      case 'run':
      case 'run_for_failure': {
        const subprogramMatches = subprograms[`@${rule.inName}`] ?? [];
        subprograms[`@${rule.inName}`] = subprogramMatches;
        subprogramMatches.push({
          inVars: rule.inVars,
          runForFailure: rule.type === 'run_for_failure',
          instructions: rule.instructions.map(ingestInstruction),
          conclusion: ingestConclusion(rule.conclusion, 0, rule.inVars),
        });
        continue;
      }
    }
  }

  return {
    arities: prog.arities,
    seeds: prog.seeds,
    demands: prog.demands.map((intermediate) => `@${intermediate}`),
    predUnary,
    predBinary,
    intermediates,
    subprograms,
    forbids: prog.forbids.reduce<{ [inName: string]: true }>(
      (forbids, intermediate) => ((forbids[`@${intermediate}`] = true), forbids),
      {},
    ),
    data: new HashCons(),
  };
}
