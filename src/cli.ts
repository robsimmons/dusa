import {
  compareTerms,
  Dusa,
  DusaError,
  DusaRuntimeError,
  InputFact,
  InputTerm,
  Term,
} from './client.js';

import { parseArgs, ParseArgsConfig } from 'util';
import { readFileSync } from 'fs';

function parseArgsConfig(args: string[]): ParseArgsConfig {
  return {
    args,
    strict: true,
    allowPositionals: true,
    options: {
      assert: {
        type: 'string',
        short: 'a',
        multiple: true,
        default: [],
      },
      facts: {
        type: 'string',
        short: 'f',
        multiple: true,
        default: [],
      },
      help: {
        type: 'boolean',
        short: 'h',
      },
      models: {
        type: 'string',
        short: 'n',
        default: '1',
      },
      count: {
        type: 'string',
        short: 'c',
        multiple: true,
        default: [],
      },
      query: {
        type: 'string',
        short: 'q',
        multiple: true,
        default: [],
      },
      verbose: {
        type: 'string',
        short: 'v',
        default: '2',
      },
    },
  };
}

/* eslint @typescript-eslint/no-explicit-any: "off" */

function validateTerm(term: any): term is InputTerm {
  if (typeof term === 'number') return true;
  if (typeof term === 'string') return true;
  if (typeof term === 'boolean') return true;
  /* istanbul ignore next -- not possible for json inputs @preserve */
  if (typeof term !== 'object') {
    throw new Error(
      '(unexpected internal error, please report) term not number, string, boolean, or term object',
    );
  }
  if (term.name === undefined) {
    throw new Error("no 'name' field in term object");
  }
  if (typeof term.name !== 'string') {
    throw new Error("'name' field in term object not a string");
  }
  if (term.args === undefined) return true;
  if (!Array.isArray(term.args)) {
    throw new Error("'args' field in term object not an array");
  }
  return term.args.every(validateTerm);
}

function validateFact(fact: any): fact is InputFact {
  if (typeof fact !== 'object') {
    throw new Error('not an object');
  }
  if (fact.name === undefined) {
    throw new Error("no 'name' field in fact object");
  }
  if (typeof fact.name !== 'string') {
    throw new Error("'name' field in fact object not a string");
  }

  let args: any[] = [];
  if (fact.args !== undefined) {
    if (Array.isArray(fact.args)) {
      args = fact.args;
    } else {
      throw new Error("'args' field in fact object not an array");
    }
  }

  if (fact.value === undefined) {
    return args.every(validateTerm);
  } else {
    return args.every(validateTerm) && validateTerm(fact.value);
  }
}

function validateJsonFact(arg: number, str: string): InputFact {
  let input: any;
  try {
    input = JSON.parse(str);
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(`Invalid JSON in command-line fact #${arg}: ${e.message}`);
    } else {
      throw e;
    }
  }

  try {
    validateFact(input);
    return input;
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(`Error in command-line fact #${arg}: ${e.message}`);
    } else {
      throw e;
    }
  }
}

function validateJsonFacts(source: string, str: string): InputFact[] {
  let input: any;
  try {
    input = JSON.parse(str);
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(`Invalid JSON in ${source}: ${e.message}`);
    } else {
      throw e;
    }
  }

  if (!Array.isArray(input)) {
    throw new Error(`JSON in ${source} is not a list`);
  }

  const facts: InputFact[] = [];
  for (const [i, fact] of input.entries()) {
    try {
      if (validateFact(fact)) {
        facts.push(fact);
      }
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`Error in fact #${i + 1} in ${source}: ${e.message}`);
      } else {
        throw e;
      }
    }
  }
  return facts;
}

const usage = `dusa cli
usage: dusa <filename.dusa> [options]

Dusa takes a single filename and multiple strings or files
containing JSON objects matching the spec Fact[], defined
in TypeScript as follows:

type Fact = { name: string, args?: term[], value?: term };
type Term = number | string | boolean | { name: string, args?: Term[] };

Options:
  -h --help          print this message and exit

  -a --assert <str>  load a single fact as a JSON string
  -f --facts <fact>  load file <file> containing a list of JSON facts

  -n --models <n>    compute at most <n> models (default 1, 0 for all)
  -c --count <pred>  returns the number of <pred> facts in each solution
  -q --query <pred>  returns the list of <pred> facts in a solution
  -v --verbose <n>   -v0 prints nothing to stdout
                     -v1 prints only JSON output to stdout
                     -v2 (default) print solution counts & JSON to stdout
`;

export function runDusaCli(
  argv: string[],
  log: (message: any) => void,
  err: (message: any) => void,
): number {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs(parseArgsConfig(argv));
  } catch (e) {
    if (e instanceof Error) err(`\n${e.message}\n`);
    err(usage);
    return 1;
  }

  if (args.values.help) {
    err(usage);
    return 0;
  }

  const verbose = parseInt(`${args.values.verbose}`);
  if (`${verbose | 0}` !== args.values.verbose) {
    err(`--verbose must be an integer`);
    err(usage);
    return 1;
  }

  if (args.positionals.length !== 1) {
    err('\nA single positional argument, a filename containing a Dusa program, is required.\n');
    err(usage);
    return 1;
  }

  const max_num_solutions = parseInt(`${args.values.models}`);
  if (`${max_num_solutions}` !== args.values.models) {
    err(`Number of models '${args.values.models}' not an natural number`);
    return 1;
  }

  let file;
  try {
    file = readFileSync(args.positionals[0]).toString('utf-8');
  } catch (e) {
    if (e instanceof Error) err(`Could not read Dusa program (${e.message})`);
    return 1;
  }

  let dusa;
  try {
    dusa = new Dusa(file);
  } catch (e) {
    if (e instanceof DusaError) {
      err(
        `Error${e.issues?.length === 1 ? '' : 's'} loading Dusa program:\n${e.issues
          .map(({ msg, loc }) => `${loc?.start ? `Line ${loc.start.line}: ` : ''}${msg}`)
          .join('\n')}`,
      );
    }
    if (e instanceof DusaRuntimeError) {
      err(`Runtime error: ${e.message}`);
    }
    return 1;
  }

  const assertArgs = args.values.assert as string[];
  try {
    for (let i = 0; i < assertArgs.length; i++) {
      const fact = validateJsonFact(i + 1, assertArgs[i]);
      dusa.assert(fact);
    }
  } catch (e) {
    if (e instanceof Error) err(e.message);
    return 1;
  }

  const assertFileArgs = args.values.facts as string[];
  try {
    for (let i = 0; i < assertFileArgs.length; i++) {
      const facts = validateJsonFacts(
        assertFileArgs[i],
        readFileSync(assertFileArgs[i]).toString('utf-8'),
      );
      for (const fact of facts) {
        dusa.assert(fact);
      }
    }
  } catch (e) {
    if (e instanceof Error) err(e.message);
    return 1;
  }

  const count = args.values.count as string[];
  const query =
    count.length === 0 && (args.values.query as string[]).length === 0
      ? dusa.relations.slice(0).sort()
      : (args.values.query as string[]);

  if (verbose >= 2) log('Solving...');
  const solutions = dusa[Symbol.iterator]();
  let num_solutions = 0;
  while (max_num_solutions === 0 || num_solutions < max_num_solutions) {
    const solution = solutions.next();
    if (solution.done) break;
    num_solutions += 1;
    if (verbose >= 2) log(`Answer: ${num_solutions}`);
    const answer: { [pred: string]: Term[][] | number } = {};
    for (const pred of [...count, ...query]) {
      answer[pred] = [...solution.value.lookup(pred)].sort(compareTerms);
      if (count.includes(pred)) {
        answer[pred] = answer[pred].length;
      }
    }
    if (verbose >= 1) log(JSON.stringify(answer));
  }

  if (verbose >= 2) {
    log(
      num_solutions === 0
        ? 'UNSATISFIABLE'
        : `SATISFIABLE (${num_solutions}${
            max_num_solutions === 0 || num_solutions < max_num_solutions ? '' : '+'
          } model${num_solutions === 1 ? '' : 's'})`,
    );
  }
  return num_solutions === 0 ? 1 : 0;
}
