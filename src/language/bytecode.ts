import {
  Program as BytecodeProgram,
  Rule as BytecodeRule,
  Conclusion as BytecodeConclusion,
} from '../bytecode.js';
import { BinarizedProgram, BinarizedRule, Conclusion as BinarizedConclusion } from './binarize.js';
import { termsToShape } from './indexes.js';

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
    case 'datalog'
  }
}

function generateRule(rule: BinarizedRule): BytecodeRule {
  switch (rule.type) {
    case 'Unary':
      const { shape, lookup, revLookup } = termsToShape()
  }
}

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
