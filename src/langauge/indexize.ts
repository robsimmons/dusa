import { BinarizedProgram, freeVarsBinarizedPremise } from './binarize';
import { Pattern, termToString } from './terms';

/**
 * Indexing transformation
 *
 * The indexing transformation is relatively straightforward to conceptualize, but
 * quite tedious to implement. The goal is to take a every rule in the binarized
 * program of the form
 *
 *     $x <vars> :- $y <vars>, P.
 *
 * (where each introduced predicate --- $x or $y --- is on the left of only one binarized
 * rule) and turn it into a program of the form
 *
 *     $zindex [ <shared> ] [ <introduced> ] :- P.
 *     $xprefix [ <vars1> ] [ <vars2> ] :-
 *         $yprefix [ <shared> ] [ <passed> ],
 *         $zindex [ <shared> ] [ <introduced> ].
 *
 * The critical invariants here are:
 *  - there is no repetition among <shared>, <passed>, and <introduced> variables,
 *    and the three sequences are mutually disjoint
 *  - the $zindex rule and $yprefix predicates in the rule utilize the same set of <shared>
 *    variables in the same order
 *
 * Making the shared variables explicit and consistent in this way makes finding all the
 * $yprefix facts that match a given $zindex fact trivial, and vice versa, but getting there
 * requires a lot of bookkeeping, which is why this ends up being tedious.
 */

export type IndexedBinaryRule =
  | {
      type: 'IndexLookup';
      inName: string;
      shared: string[];
      passed: string[];
      indexName: string;
      introduced: string[];
      outName: string;
      outShared: ['shared' | 'passed' | 'introduced', number][];
      outPassed: ['shared' | 'passed' | 'introduced', number][];
    }
  | {
      type: 'FunctionalLookup';
      inName: string;
      shared: string[];
      passed: string[];
      introduced: string[];
      function: { type: 'Equality' | 'Inequality'; ground: Pattern; match: Pattern };
      outName: string;
      outShared: ['shared' | 'passed' | 'introduced', number][];
      outPassed: ['shared' | 'passed' | 'introduced', number][];
    };

export interface IndexInsertionRule {
  name: string;
  args: Pattern[];
  value: Pattern;
  indexName: string;
  shared: string[];
  introduced: string[];
}

export interface IndexedConclusion {
  inName: string;
  inVars: string[];
  name: string;
  args: Pattern[];
  values: Pattern[];
  exhaustive: boolean;
}

export interface IndexedProgram {
  seeds: string[];
  forbids: Set<string>;
  demands: Set<string>;
  indexes: [string, number, number][];
  binaryRules: IndexedBinaryRule[];
  indexInsertionRules: IndexInsertionRule[];
  conclusionRules: IndexedConclusion[];
  prefixToRule: { [prefix: string]: IndexedBinaryRule };
  indexToRule: { [index: string]: IndexedBinaryRule };
  prefixToConclusion: { [prefix: string]: IndexedConclusion };
  factToRules: { [name: string]: IndexInsertionRule[] };
}

function indexedRuleToString(rule: IndexedBinaryRule) {
  function lookup([location, index]: ['shared' | 'passed' | 'introduced', number]) {
    if (location === 'shared') return rule.shared[index];
    if (location === 'introduced') return rule.introduced[index];
    if (location === 'passed') return rule.passed[index];
  }

  const premiseStr =
    rule.type === 'IndexLookup'
      ? `$${rule.indexName}index [ ${rule.shared.join(', ')} ] [ ${rule.introduced.join(', ')} ]`
      : `${termToString(rule.function.ground)} ${
          rule.function.type === 'Equality' ? '==' : '!='
        } ${termToString(rule.function.match)}`;

  return `$${rule.outName}prefix [ ${rule.outShared.map(lookup).join(', ')} ] [ ${rule.outPassed
    .map(lookup)
    .join(', ')} ] :- $${rule.inName}prefix [ ${rule.shared.join(', ')} ] [ ${rule.passed.join(
    ', ',
  )} ], ${premiseStr}.\n`;
}

function indexInsertionRuleToString(rule: IndexInsertionRule) {
  return `$${rule.indexName}index [ ${rule.shared.join(', ')} ] [ ${rule.introduced.join(
    ', ',
  )} ] :- ${rule.name}${rule.args.map((arg) => ` ${termToString(arg)}`).join('')} is ${termToString(
    rule.value,
  )}.\n`;
}

function conclusionRuleToString(rule: IndexedConclusion) {
  return `${rule.name}${rule.args.map((arg) => ` ${termToString(arg)}`)} is { ${rule.values
    .map((value) => termToString(value))
    .join(', ')}${rule.exhaustive ? '' : '?'} } :- $${rule.inName}prefix [  ] [ ${rule.inVars.join(
    ', ',
  )} ].\n`;
}

export function indexedProgramToString(program: IndexedProgram) {
  return `Initial seeds: ${program.seeds.map((name) => `$${name}prefix`).join(', ')}
Demands to derive: ${[...program.demands].map((name) => `$${name}prefix`).join(', ')}
Forbids to derive: ${[...program.forbids].map((name) => `$${name}prefix`).join(', ')}
Index insertion rules:
${program.indexInsertionRules.map((rule) => indexInsertionRuleToString(rule)).join('')}
Binary rules:
${program.binaryRules.map((rule) => indexedRuleToString(rule)).join('')}
Conclusion rules:
${program.conclusionRules.map((rule) => conclusionRuleToString(rule)).join('')}`;
}

export function indexize(program: BinarizedProgram): IndexedProgram {
  // Figure out which positions of each introduced predicate are keys
  const ruleIndexing: {
    [name: string]: {
      shared: string[];
      introduced: string[];
      passed: string[];
      permutation: { position: 'shared' | 'passed'; index: number }[];
    };
  } = {};

  const conclusionRules: IndexedConclusion[] = [];
  const pseudoConclusions = new Set([...program.demands, ...program.forbids]);
  for (const rule of program.rules) {
    if (rule.type === 'Conclusion') {
      conclusionRules.push({
        inName: rule.inName,
        inVars: rule.inVars,
        name: rule.name,
        args: rule.args,
        values: rule.values,
        exhaustive: rule.exhaustive,
      });

      ruleIndexing[rule.inName] = {
        shared: [],
        introduced: [],
        passed: rule.inVars,
        permutation: rule.inVars.map((_, index) => ({ position: 'passed', index })),
      };
    } else {
      const fv = freeVarsBinarizedPremise(rule.premise);
      const inVars = new Set(rule.inVars);
      const outVars = new Set(rule.outVars);

      const shared: string[] = [];
      const introduced: string[] = [];
      const passed: string[] = [];

      for (const v of rule.inVars) {
        if (!fv.has(v)) {
          passed.push(v);
        }
      }

      // Create an index predicate $aNright (shared variables) (introduced variables)
      for (const v of fv) {
        if (inVars.has(v)) {
          shared.push(v);
        } else if (outVars.has(v)) {
          introduced.push(v);
        }
      }

      // We have to permute the arguments to $aN so that the shared variables
      // come first, and in the same order they come for $aNright
      const permutation: { position: 'shared' | 'passed'; index: number }[] = [];
      let nextPassedThrough = 0;
      for (const v of rule.inVars) {
        const index = shared.findIndex((sh) => v === sh);
        if (index === -1) {
          permutation.push({ position: 'passed', index: nextPassedThrough++ });
        } else {
          permutation.push({ position: 'shared', index });
        }
      }

      ruleIndexing[rule.inName] = { shared, introduced, passed, permutation };
    }
  }

  const indexes: [string, number, number][] = [];
  const indexInsertionRules: IndexInsertionRule[] = [];
  const binaryRules: IndexedBinaryRule[] = [];

  for (const rule of program.rules) {
    if (rule.type === 'Binary') {
      let outVars = rule.outVars;
      const inPrefixIndexing = ruleIndexing[rule.inName];
      const outPrefixIndexing = ruleIndexing[rule.outName];

      const lookup = (v: string): ['shared' | 'passed' | 'introduced', number] => {
        let index: number;
        if ((index = inPrefixIndexing.shared.findIndex((v2) => v === v2)) !== -1) {
          return ['shared', index];
        }
        if ((index = inPrefixIndexing.passed.findIndex((v2) => v === v2)) !== -1) {
          return ['passed', index];
        }
        if ((index = inPrefixIndexing.introduced.findIndex((v2) => v === v2)) !== -1) {
          return ['introduced', index];
        }
        console.log(inPrefixIndexing);
        throw new Error(`Could not find ${v} in lookup`);
      };

      // For pseudorules, we override any variables and just
      // have the conclusion be zero-ary. That's not the only option, but it
      // felt easier than figuring out how to correctly order the rules.
      if (!outPrefixIndexing) {
        if (!pseudoConclusions.has(rule.outName)) {
          throw new Error(`No outPrefix for ${rule.outName}`);
        }
        outVars = [];
      }

      /* The new conclusion will have outPrefixIndexing.shared.length arguments in the
       * "shared" position, and outPrefixIndexing.passed.length arguments in the
       * "passed" position. These two arrays form the placeholders for the shared
       * and passed arguments of tne new proposition. */
      const outShared: ['shared' | 'passed' | 'introduced', number][] = Array.from({
        length: outPrefixIndexing?.shared.length ?? 0,
      });
      const outPassed: ['shared' | 'passed' | 'introduced', number][] = Array.from({
        length: outPrefixIndexing?.passed.length ?? 0,
      });

      for (const [index, v] of outVars.entries()) {
        // console.log(`Pre-transformation, argument #${index} to $${rule.outName} was ${v}.`);
        const destination = outPrefixIndexing.permutation[index];
        // console.log(
        //   `That position ${index} argument of $${rule.outName} becomes the ${destination.position} position ${destination.index} argument to $${rule.outName}prefix.`,
        // );
        const [source, sourceIndex] = lookup(v);
        // console.log(
        //   `To derive the ${destination.position} position ${destination.index} argument $${rule.outName}prefix, ${v} is pulled from position ${sourceIndex} of the rule's ${source} variables`,
        // );
        if (destination.position === 'shared') {
          outShared[destination.index] = [source, sourceIndex];
        } else {
          outPassed[destination.index] = [source, sourceIndex];
        }
      }

      if (rule.premise.type === 'Proposition') {
        indexInsertionRules.push({
          name: rule.premise.name,
          args: rule.premise.args,
          value: rule.premise.value,
          indexName: rule.inName,
          shared: inPrefixIndexing.shared,
          introduced: inPrefixIndexing.introduced,
        });

        binaryRules.push({
          type: 'IndexLookup',
          shared: inPrefixIndexing.shared,
          passed: inPrefixIndexing.passed,
          introduced: inPrefixIndexing.introduced,
          inName: rule.inName,
          indexName: rule.inName,
          outName: rule.outName,
          outShared,
          outPassed,
        });
      } else {
        binaryRules.push({
          type: 'FunctionalLookup',
          inName: rule.inName,
          shared: inPrefixIndexing.shared,
          passed: inPrefixIndexing.passed,
          introduced: inPrefixIndexing.introduced,
          function: { type: rule.premise.type, ground: rule.premise.a, match: rule.premise.b },
          outName: rule.outName,
          outShared,
          outPassed,
        });
      }
    }
  }

  const prefixToRule: { [prefix: string]: IndexedBinaryRule } = {};
  const indexToRule: { [index: string]: IndexedBinaryRule } = {};
  const prefixToConclusion: { [prefix: string]: IndexedConclusion } = {};
  const factToRules: { [name: string]: IndexInsertionRule[] } = {};
  for (const rule of binaryRules) {
    prefixToRule[rule.inName] = rule;
    if (rule.type === 'IndexLookup') {
      indexToRule[rule.indexName] = rule;
    }
  }
  for (const rule of conclusionRules) {
    prefixToConclusion[rule.inName] = rule;
  }
  for (const rule of indexInsertionRules) {
    factToRules[rule.name] = (factToRules[rule.name] ?? []).concat(rule);
  }

  return {
    seeds: program.seeds,
    demands: new Set(program.demands),
    forbids: new Set(program.forbids),
    indexes,
    indexInsertionRules,
    binaryRules,
    conclusionRules,
    prefixToRule,
    indexToRule,
    prefixToConclusion,
    factToRules,
  };
}
