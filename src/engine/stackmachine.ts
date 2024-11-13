import { Program } from './program.js';
import { Data } from '../datastructures/data.js';
import { Instruction } from '../bytecode.js';

/** Stack machine running a sequence of Instruction statements */
export function runInstructions(prog: Program, memory: Data[], instructions: Instruction[]) {
  const stack: Data[] = [];
  for (const instr of instructions) {
    switch (instr.type) {
      case 'const': {
        stack.push(prog.data.hide(instr.const));
        break;
      }
      case 'dup': {
        stack.push(stack[stack.length - 1]);
        break;
      }
      case 'equal': {
        const a = stack.pop()!;
        const b = stack.pop()!;
        if (a !== b) return false;
        break;
      }
      case 'gt': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (typeof a !== 'bigint' || typeof b !== 'bigint') return false;
        if (a <= b) return false;
        break;
      }
      case 'load': {
        stack.push(memory[instr.ref]);
        break;
      }
      case 'store': {
        memory.push(stack.pop()!);
        break;
      }
      case 'i_add': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (typeof a !== 'bigint' || typeof b !== 'bigint') return false;
        stack.push(a + b);
        break;
      }
      case 'i_sub': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (typeof a !== 'bigint' || typeof b !== 'bigint') return false;
        stack.push(a - b);
        break;
      }
      case 'explode': {
        const a = prog.data.expose(stack.pop()!);
        if (a.type !== 'const' || a.name !== instr.const || a.args.length !== instr.arity) {
          return false;
        }
        for (const t of a.args.toReversed()) {
          stack.push(t);
        }
        break;
      }
      case 'build': {
        const args: Data[] = [];
        for (let i = 0; i < instr.arity; i++) {
          args.push(stack.pop()!);
        }
        stack.push(prog.data.hide({ type: 'const', name: instr.const, args: args.toReversed() }));
        break;
      }
    }
  }
  return true;
}
