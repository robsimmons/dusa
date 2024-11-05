import {
  Program as BytecodeProgram,
  Rule as BytecodeRule,
  Conclusion as BytecodeConclusion,
} from '../bytecode.js';
import { BinarizedProgram, BinarizedRule, Conclusion as BinarizedConclusion } from './binarize.js';

function generatePattern(subst: { [name: ]})

function generateConclusion(
  subst: { [name: string]: number },
  conclusion: BinarizedConclusion,
): BytecodeConclusion {
  switch (conclusion.type) {
    case 'intermediate':
      return {
        type: 'intermediate',
        name: conclusion.name,
        vars: conclusion.vars.map((x) => subst[x]),
      };
    
  }
}

function generateRule(rule: BinarizedRule): BytecodeRule {}

export function generateBytecode(program: BinarizedProgram): BytecodeProgram {
  return {
    seeds: program.seeds,
    forbids: program.forbids,
    demands: program.demands,
    rules: program.rules.map((rule) => {
      switch (rule.type) {
      }
    }),
  };
}
