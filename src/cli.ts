import {
  Dusa,
  DusaError,
  DusaRuntimeError,
  InputFact,
  InputTerm,
  Term,
  termToJson,
} from './client.js';

import { parseArgs, ParseArgsConfig } from 'util';
import { readFileSync } from 'fs';

function parseArgsConfig(args: string[]): ParseArgsConfig {
  return {
    args,
    strict: true,
    allowPositionals: true,
    options: {
      facts: {
        type: 'string',
        short: 'f',
        multiple: true,
        default: [],
      },
      input: {
        type: 'string',
        short: 'i',
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
        default: '1',
      },
    },
  };
}

function validateTerm(term: any): term is InputTerm {
  if (typeof term === 'number') return true;
  if (typeof term === 'string') return true;
  if (typeof term === 'boolean') return true;
  if (typeof term !== 'object') {
    throw new Error('term not number, string, boolean, or term object');
  }
  if (!term.name) {
    throw new Error("no 'name' field in term object");
  }
  if (typeof term.name !== 'string') {
    throw new Error("'name' field in term object not a string");
  }
  if (!term.args) return true;
  if (typeof term.args !== 'object' || typeof term.args.length !== 'number') {
    throw new Error("'args' field in term object not an array");
  }
  return term.args.every(validateTerm);
}

function validateFact(fact: any): fact is InputFact {
  if (typeof fact !== 'object') {
    throw new Error('not an object');
  }
  if (!fact.name) {
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

  if (fact.value !== undefined) {
    return args.every(validateTerm);
  } else {
    return args.every(validateTerm) && validateTerm(fact.value);
  }
}

function validateJsonString(source: string, str: string): InputFact[] {
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

  let facts: InputFact[] = [];
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

  -f --facts <str>   load list facts as a JSON string <str>
  -i --input <file>  load file <file> containing a list of JSON facts

  -n --models <n>    compute at most <n> models (0 for all)
  -c --count <pred>  returns a count <pred> facts in a solution
  -q --query <pred>  returns the list of <pred> facts in a solution
  -v --verbose <n>   -v0 prints nothing but JSON outputs & CLI errors
`;

export function runDusaCli(argv: string[]): number {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs(parseArgsConfig(argv));
  } catch (e) {
    if (e instanceof Error) console.log(`\n${e.message}\n`);
    console.log(usage);
    return 1;
  }

  if (args.values.help) {
    console.log(usage);
    return 0;
  }

  const verbose = parseInt(`${args.values.verbose}`);
  if (`${verbose | 0}` !== args.values.verbose) {
    console.log(`--verbose must be an integer`);
    console.log(usage);
    return 1;
  }

  if (args.positionals.length !== 1) {
    console.log(
      '\nA single positional argument, a filename containing a Dusa program, is required.\n',
    );
    console.log(usage);
    return 1;
  }

  const max_num_solutions = parseInt(`${args.values.models}`);
  if (`${max_num_solutions}` !== args.values.models) {
    console.log(`Number of models '${args.values.models}' not an natural number`);
    return 1;
  }

  let file;
  try {
    file = readFileSync(args.positionals[0]).toString('utf-8');
  } catch (e) {
    if (e instanceof Error) console.log(`Could not read Dusa program (${e.message})`);
    return 1;
  }

  let dusa;
  try {
    dusa = new Dusa(file);
  } catch (e) {
    if (e instanceof DusaError && verbose > 0) {
      console.log(
        `Error${e.issues?.length === 1 ? '' : 's'} loading Dusa program:\n${e.issues
          .map(({ msg, loc }) => `${loc?.start ? `Line ${loc.start.line}: ` : ''}${msg}`)
          .join('\n')}`,
      );
    }
    if (e instanceof DusaRuntimeError && verbose > 0) {
      console.log(`Runtime error: ${e.message}`);
    }
    return 1;
  }

  const factArgs = args.values.facts as string[];
  try {
    for (let i = 0; i < factArgs.length; i++) {
      const facts = validateJsonString(`command-line fact list #${i + 1}`, factArgs[i]);
      dusa.assert(...facts);
    }
  } catch (e) {
    if (e instanceof Error && verbose > 0) console.log(e.message);
    return 1;
  }

  const inputs = args.values.input as string[];
  try {
    for (let i = 0; i < inputs.length; i++) {
      const facts = validateJsonString(inputs[i], readFileSync(inputs[i]).toString('utf-8'));
      for (const fact of facts) {
        dusa.assert(fact);
      }
    }
  } catch (e) {
    if (e instanceof Error && verbose > 0) console.log(e.message);
    return 1;
  }

  const count = args.values.count as string[];
  const query =
    count.length === 0 && (args.values.query as string[]).length === 0
      ? dusa.relations.toSorted()
      : (args.values.query as string[]);

  if (verbose > 0) console.log('Solving...');
  const solutions = dusa[Symbol.iterator]();
  let num_solutions = 0;
  while (max_num_solutions === 0 || num_solutions < max_num_solutions) {
    const solution = solutions.next();
    if (solution.done) break;
    if (verbose > 0) console.log(`Answer: ${++num_solutions}`);
    const answer: { [pred: string]: Term[][] | number } = {};
    for (const pred of [...count, ...query]) {
      answer[pred] = [...solution.value.lookup(pred).map((terms) => terms.map(termToJson))];
      if (count.includes(pred)) {
        answer[pred] = answer[pred].length;
      }
    }
    console.log(JSON.stringify(answer));
  }

  if (verbose > 0) {
    console.log(
      num_solutions === 0
        ? 'UNSATISFIABLE'
        : `SATISFIABLE (${num_solutions}${
            max_num_solutions === 0 || num_solutions < max_num_solutions ? '' : '+'
          } model${num_solutions === 1 ? '' : 's'})`,
    );
  }
  return num_solutions === 0 ? 1 : 0;
}
