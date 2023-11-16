import { BinarizedProgram } from './binarize';

export function indexize(program: BinarizedProgram) {
  const rules: { [name: string]: 'conclusion' | { keys: string[]; values: string[] } } = {};
  for (let [name, rule] of program.rules) {
  }
}
