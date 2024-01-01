import {
  Rule,
  Pattern as Pat,
  Pattern_PatternEnum,
  Pattern_Structure,
  Program,
  Rule_Function_Builtin,
  Rule_Join_JoinPattern_JoinLocation,
  Rule_Join_JoinPattern,
} from '../gen/busa_pb.js';
import { BUILT_IN_MAP } from './dusa-builtins.js';
import { IndexedProgram } from './indexize.js';
import { Pattern } from './terms.js';

/**
 * Transformation to protocol buffer format
 */

function outputPattern(varToIndex: Map<string, number>, pattern: Pattern): Pat {
  switch (pattern.type) {
    case 'triv':
      return new Pat({ is: { case: 'enum', value: Pattern_PatternEnum.Unit } });
    case 'bool':
      return new Pat({ is: { case: 'bool', value: pattern.value } });
    case 'int':
      return new Pat({ is: { case: 'int', value: BigInt(pattern.value) } });
    case 'string':
      return new Pat({ is: { case: 'string', value: pattern.value } });
    case 'const':
      return new Pat({
        is: {
          case: 'structure',
          value: new Pattern_Structure({
            name: pattern.name,
            args: pattern.args.map((arg) => outputPattern(varToIndex, arg)),
          }),
        },
      });
    case 'wildcard':
      return new Pat({ is: { case: 'enum', value: Pattern_PatternEnum.Wildcard } });
    case 'var':
      return new Pat({ is: { case: 'var', value: varToIndex.get(pattern.name)! } });
  }
}

const builtins: { [key in keyof typeof BUILT_IN_MAP]: Rule_Function_Builtin } = {
  BOOLEAN_TRUE: Rule_Function_Builtin.BOOLEAN_TRUE,
  BOOLEAN_FALSE: Rule_Function_Builtin.BOOLEAN_FALSE,
  NAT_ZERO: Rule_Function_Builtin.NAT_ZERO,
  NAT_SUCC: Rule_Function_Builtin.NAT_SUCC,
  INT_PLUS: Rule_Function_Builtin.INT_PLUS,
  INT_MINUS: Rule_Function_Builtin.INT_MINUS,
  INT_TIMES: Rule_Function_Builtin.INT_TIMES,
  STRING_CONCAT: Rule_Function_Builtin.STRING_CONCAT,
  EQUAL: Rule_Function_Builtin.EQUAL,
  GT: Rule_Function_Builtin.GT,
  GEQ: Rule_Function_Builtin.GEQ,
};

export function outputProgram(prog: IndexedProgram) {
  const binaryRules = prog.binaryRules.map((value) => {
    if (value.type === 'IndexLookup') {
      return new Rule({
        is: {
          case: 'join',
          value: {
            conclusion: value.outName,
            args: value.outShared.concat(value.outPassed).map(
              ([type, index]) =>
                new Rule_Join_JoinPattern({
                  loc:
                    type === 'shared'
                      ? Rule_Join_JoinPattern_JoinLocation.Shared
                      : type === 'passed'
                        ? Rule_Join_JoinPattern_JoinLocation.Prefix
                        : Rule_Join_JoinPattern_JoinLocation.FactArg,
                  var: index,
                }),
            ),
            prefix: value.inName,
            fact: value.indexName,
            numShared: value.shared.length,
          },
        },
      });
    } else {
      const varToIndex = new Map<string, number>();
      for (const [index, varName] of value.shared.entries()) {
        varToIndex.set(varName, index);
      }
      for (const [index, varName] of value.passed.entries()) {
        varToIndex.set(varName, index + value.shared.length);
      }
      for (const [index, varName] of value.introduced.entries()) {
        varToIndex.set(varName, index + value.shared.length + value.passed.length);
      }
      return new Rule({
        is: {
          case: 'function',
          value: {
            conclusion: value.outName,
            args: value.outShared
              .concat(value.outPassed)
              .map(([type, index]) =>
                type === 'shared'
                  ? index
                  : type === 'passed'
                    ? index + value.shared.length
                    : index + value.shared.length + value.passed.length,
              ),
            prefix: value.inName,
            type: {
              case: 'builtin',
              value: builtins[value.name],
            },
            functionArgs: value.args.map((arg) => outputPattern(varToIndex, arg)),
            numVars: value.shared.length + value.passed.length + value.introduced.length,
          },
        },
      });
    }
  });

  const indexRules = prog.indexInsertionRules.map((value) => {
    const varToIndex = new Map<string, number>();
    for (const [index, varName] of value.shared.entries()) {
      varToIndex.set(varName, index);
    }
    for (const [index, varName] of value.introduced.entries()) {
      varToIndex.set(varName, index + value.shared.length);
    }

    return new Rule({
      is: {
        case: 'index',
        value: {
          conclusion: value.indexName,
          numConclusionArgs: value.introduced.length,
          premise: value.name,
          args: value.args.map((arg) => outputPattern(varToIndex, arg)),
          values: [outputPattern(varToIndex, value.value)],
        },
      },
    });
  });

  const conclusionRules = prog.conclusionRules.map((value) => {
    const varToIndex = new Map<string, number>();
    for (const [index, varName] of value.inVars.entries()) {
      varToIndex.set(varName, index);
    }

    if (!value.exhaustive || value.values.length !== 1) {
      return new Rule({
        is: {
          case: 'choiceConclusion',
          value: {
            conclusion: value.name,
            args: value.args.map((arg) => outputPattern(varToIndex, arg)),
            choices: value.values.map((arg) => outputPattern(varToIndex, arg)),
            exhaustive: value.exhaustive,
            prefix: value.inName,
          },
        },
      });
    }

    return new Rule({
      is: {
        case: 'datalogConclusion',
        value: {
          conclusion: value.name,
          args: value.args.map((arg) => outputPattern(varToIndex, arg)),
          values: [outputPattern(varToIndex, value.values[0])],
          prefix: value.inName,
        },
      },
    });
  });

  return new Program({
    rules: binaryRules.concat(indexRules).concat(conclusionRules),
    seeds: prog.seeds,
    forbids: [...prog.forbids],
    demands: [...prog.demands],
  });
}
