import { Conclusion, Pattern, ConclusionN, ProgramN, PatternN } from '../bytecode.js';
import { HashCons } from '../datastructures/data.js';

type ConclusionInput = ConclusionN<bigint | string | number>;
type PatternInput = PatternN<bigint | string | number>;
type ProgramInput = ProgramN<bigint | string | number>;

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
    premise: { name: string; shared: number; introduced: number };
    conclusion: Conclusion;
  }[];
};

export interface Program {
  seeds: string[];
  predUnary: PredUnary;
  predBinary: PredBinary;
  intermediates: Intermediates;
  demands: string[];
  forbids: { [inName: string]: true };
  data: HashCons;
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

function ingestConclusion(conclusion: ConclusionInput): Conclusion {
  switch (conclusion.type) {
    case 'intermediate':
      return {
        ...conclusion,
        name: `@${conclusion.name}`,
      };
    case 'datalog':
      return {
        ...conclusion,
        args: conclusion.args.map(ingestPattern),
      };
    case 'closed':
    case 'open':
      return {
        ...conclusion,
        args: conclusion.args.map(ingestPattern),
        choices: conclusion.choices.map(ingestPattern),
      };
  }
}

export function ingestBytecodeProgram(prog: ProgramInput): Program {
  const predUnary: PredUnary = {};
  const predBinary: PredBinary = {};
  const intermediates: Intermediates = {};
  for (const rule of prog.rules) {
    switch (rule.type) {
      case 'unary': {
        const matches = predUnary[rule.premise.name] ?? [];
        matches.push({
          args: rule.premise.args.map(ingestPattern),
          conclusion: ingestConclusion(rule.conclusion),
        });
        predUnary[rule.premise.name] = matches;
        continue;
      }
      case 'join': {
        const passed = rule.inVars - rule.shared;
        const introduced = rule.premise.args - rule.shared;

        const intermediateMatches = intermediates[rule.inName];
        intermediates[rule.inName] = intermediateMatches;
        intermediateMatches.push({
          premise: { name: rule.premise.name, shared: rule.shared, introduced },
          conclusion: ingestConclusion(rule.conclusion),
        });

        const indexMatches = predBinary[rule.premise.name];
        predBinary[rule.premise.name] = indexMatches;
        indexMatches.push({
          inName: rule.inName,
          inVars: { shared: rule.shared, passed },
          conclusion: ingestConclusion(rule.conclusion),
        });
      }
    }
  }

  return {
    seeds: prog.seeds,
    demands: prog.demands.map((intermediate) => `@${intermediate}`),
    predUnary,
    predBinary,
    intermediates,
    forbids: prog.forbids.reduce<{ [inName: string]: true }>(
      (forbids, intermediate) => ((forbids[`@${intermediate}`] = true), forbids),
      {},
    ),
    data: new HashCons(),
  };
}
