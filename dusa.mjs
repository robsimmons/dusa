import { Dusa } from './lib/client.js';

import { parseArgs } from 'util';
import { argv, exit } from 'process';
import { readFileSync } from 'fs';

const options = {
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
};

function validateTerm(term) {
  if (typeof term === 'number') return;
  if (typeof term === 'string') return;
  if (typeof term !== 'object') {
    throw new Error('term not number, string, or term object');
  }
  if (!term.name) {
    throw new Error("no 'name' field in term object");
  }
  if (typeof term.name !== 'string') {
    throw new Error("'name' field in term object not a string");
  }
  if (!term.args) return;
  if (typeof term.args !== 'object' || typeof term.args.length !== 'number') {
    throw new Error("'args' field in term object not an array");
  }
  for (const arg in term.args) {
    validateTerm(arg);
  }
}

function validateFact(fact) {
  if (typeof fact !== 'object') {
    throw new Error('not an object');
  }
  if (!fact.name) {
    throw new Error("no 'name' field in fact object");
  }
  if (typeof fact.name !== 'string') {
    throw new Error("'name' field in fact object not a string");
  }
  if (!fact.args) {
    throw new Error("no 'args' field in fact object");
  }
  if (typeof fact.args !== 'object' || typeof fact.args.length !== 'number') {
    throw new Error("'args' field in fact object not an array");
  }
  for (const term in fact.args) {
    validateTerm(term);
  }
  if (fact.value !== undefined) {
    validateTerm(fact.value);
  }
}

function validateJsonString(source, str) {
  let obj;
  try {
    obj = JSON.parse(str);
  } catch (e) {
    throw new Error(`Invalid JSON in ${source}: ${e.message}`);
  }
  if (typeof obj !== 'object' || typeof obj.length !== 'number') {
    throw new Error(`JSON in ${source} is not a list`);
  }
  for (let i = 0; i < obj.length; i++) {
    try {
      validateFact(obj[i]);
    } catch (e) {
      throw new Error(`Error in fact #${i + 1} in ${source}: ${e.message}`);
    }
  }
  return obj;
}

function jsonStringify(json) {
  if (typeof json === 'bigint') {
    return `${json}`;
  }
  if (Array.isArray(json)) {
    return `[${json
      .filter((x) => x !== null)
      .map(jsonStringify)
      .join(',')}]`;
  }
  if (json && typeof json === 'object') {
    return `{${Object.entries(json)
      .filter((tup) => tup[1] !== null)
      .map(([key, value]) => `"${key}":${jsonStringify(value)}`)
      .join(',')}}`;
  }
  return JSON.stringify(json);
}

const usage = `dusa artifact cli
  usage: dusa <filename.dusa> [options]
  
  Dusa takes a single filename and multiple strings or files
  containing JSON objects matching the spec Fact[], defined
  in TypeScript as follows:
  
  type Fact = { name: string, args: term[], value?: term };
  type Term = number | string | { name: string, args?: Term[] };
  
  Options:
    -h --help          print this message and exit
  
    -f --facts <str>   load list facts as a JSON string <str>
    -i --input <file>  load file <file> containing a list of JSON facts
  
    -n --models <n>    compute at most <n> models (0 for all)
    -c --count <pred>  returns a count <pred> facts in a solution
    -q --query <pred>  returns the list of <pred> facts in a solution
  `;

let args;
try {
  args = parseArgs({
    args: argv.slice(2),
    options,
    strict: true,
    allowPositionals: true,
  });
} catch (e) {
  console.log(`\n${e.message}\n`);
  console.log(usage);
  exit(1);
}

if (args.values.help) {
  console.log(usage);
  exit(0);
}

if (args.positionals.length !== 1) {
  console.log(
    '\nA single positional argument, a filename containing a Dusa program, is required.\n',
  );
  console.log(usage);
  exit(1);
}

const max_num_solutions = parseInt(args.values.models);
if (`${max_num_solutions}` !== args.values.models) {
  console.log(`Number of models '${args.values.models}' not an natural number`);
  exit(1);
}

let file;
try {
  file = readFileSync(args.positionals[0]).toString('utf-8');
} catch (e) {
  console.log(`Could not read Dusa program (${e.message})`);
  exit(1);
}

let dusa;
try {
  dusa = new Dusa(file);
} catch (e) {
  console.log(
    `Error${e.issues?.length === 1 ? '' : 's'} loading Dusa program:\n${e.issues
      .map(({ msg, loc }) => `${loc?.start ? `Line ${loc.start.line}: ` : ''}${msg}`)
      .join('\n')}`,
  );
  exit(1);
}

try {
  for (let i = 0; i < args.values.facts.length; i++) {
    const facts = validateJsonString(`command-line fact list #${i + 1}`, args.values.facts[i]);
    dusa.assert(...facts);
  }
} catch (e) {
  console.log(e.message);
  exit(1);
}

console.log('Solving...');
const solutions = dusa[Symbol.iterator]();
let num_solutions = 0;
while (max_num_solutions === 0 || num_solutions < max_num_solutions) {
  const solution = solutions.next();
  if (!solution.value) break;
  console.log(`Answer: ${++num_solutions}`);
  if (args.values.query.length === 0 && args.values.count.length === 0) {
    console.log(jsonStringify([...solution.value.facts]));
  } else {
    const answer = {};
    for (const pred of [...args.values.count, ...args.values.query]) {
      answer[pred] = [...solution.value.lookup(pred)];
      if (args.values.count.includes(pred)) {
        answer[pred] = answer[pred].length;
      }
    }
    console.log(jsonStringify(answer));
  }
}

console.log(
  num_solutions === 0
    ? 'UNSATISFIABLE'
    : `SATISFIABLE (${num_solutions}${
        max_num_solutions === 0 || num_solutions < max_num_solutions ? '' : '+'
      } model${num_solutions === 1 ? '' : 's'})`,
);
exit(num_solutions === 0 ? 1 : 0);
