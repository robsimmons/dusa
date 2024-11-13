import { Program } from './program.js';
import { Data, DataView } from '../datastructures/data.js';
import { Instruction } from '../bytecode.js';

/** Stack machine running a sequence of Instruction statements */
export function runInstructions(prog: Program, memory: Data[], instructions: Instruction[]) {
  const stack: DataView[] = [];
  for (const instr of instructions) {
    switch (instr.type) {
      case 'const': {
        stack.push(instr.const);
        break;
      }
      case 'dup': {
        stack.push(stack[stack.length - 1]);
        break;
      }
      case 'equal': {
        const a = stack.pop()!;
        const b = stack.pop()!;
        if (prog.data.hide(a) !== prog.data.hide(b)) return false;
        break;
      }
      case 'gt': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (a.type !== 'int' && a.type !== 'string') return false;
        if (b.type !== 'int' && b.type !== 'string') return false;
        if (a.type !== b.type) return false;
        if (a.value <= b.value) return false;
        break;
      }
      case 'geq': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (a.type !== 'int' && a.type !== 'string') return false;
        if (b.type !== 'int' && b.type !== 'string') return false;
        if (a.type !== b.type) return false;
        if (a.value < b.value) return false;
        break;
      }
      case 'load': {
        stack.push(prog.data.expose(memory[instr.ref]));
        break;
      }
      case 'store': {
        memory.push(prog.data.hide(stack.pop()!));
        break;
      }
      case 'i_add': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (a.type !== 'int' || b.type !== 'int') return false;
        stack.push({ type: 'int', value: a.value + b.value });
        break;
      }
      case 'i_sub': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (a.type !== 'int' || b.type !== 'int') return false;
        stack.push({ type: 'int', value: a.value - b.value });
        break;
      }
      case 'i_mul': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (a.type !== 'int' || b.type !== 'int') return false;
        stack.push({ type: 'int', value: a.value * b.value });
        break;
      }
      case 'explode': {
        const a = stack.pop()!;
        if (a.type !== 'const' || a.name !== instr.const || a.args.length !== instr.arity) {
          return false;
        }
        for (const t of a.args.toReversed()) {
          stack.push(prog.data.expose(t));
        }
        break;
      }
      case 'build': {
        const args: Data[] = [];
        for (let i = 0; i < instr.arity; i++) {
          args.push(prog.data.hide(stack.pop()!));
        }
        stack.push({ type: 'const', name: instr.const, args: args.toReversed() });
        break;
      }
      case 's_concat': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (a.type !== 'string' || b.type !== 'string') return false;
        stack.push({ type: 'string', value: `${a.value}${b.value}` });
        break;
      }
      case 's_starts': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (a.type !== 'string' || b.type !== 'string') return false;
        if (!a.value.startsWith(b.value)) return false;
        stack.push({ type: 'string', value: a.value.slice(b.value.length) });
        break;
      }
      case 's_ends': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (a.type !== 'string' || b.type !== 'string') return false;
        if (!a.value.endsWith(b.value)) return false;
        stack.push({ type: 'string', value: a.value.slice(0, a.value.length - b.value.length) });
        break;
      }
    }
  }
  return true;
}
