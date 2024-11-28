import { Program } from './program.js';
import { Data, DataView, HashCons } from '../datastructures/data.js';
import { Instruction } from '../bytecode.js';

/** Stack machine running a sequence of Instruction statements */
export function* runInstructions(
  prog: Program,
  memory: Data[],
  limit: number,
  instructions: Instruction[],
) {
  const stack: DataView[] = [];
  const newMem: Data[] = [];
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
        if (prog.data.hide(a) !== prog.data.hide(b)) return null;
        break;
      }
      case 'gt': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (a.type !== 'int' && a.type !== 'string') return null;
        if (b.type !== 'int' && b.type !== 'string') return null;
        if (a.type !== b.type) return null;
        if (a.value <= b.value) return null;
        break;
      }
      case 'geq': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (a.type !== 'int' && a.type !== 'string') return null;
        if (b.type !== 'int' && b.type !== 'string') return null;
        if (a.type !== b.type) return null;
        if (a.value < b.value) return null;
        break;
      }
      case 'load': {
        if (instr.ref < limit) {
          stack.push(prog.data.expose(memory[instr.ref]));
        } else {
          stack.push(prog.data.expose(newMem[instr.ref - limit]));
        }
        break;
      }
      case 'store': {
        newMem.push(prog.data.hide(stack.pop()!));
        break;
      }
      case 'i_add': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (a.type !== 'int' || b.type !== 'int') return null;
        stack.push({ type: 'int', value: a.value + b.value });
        break;
      }
      case 'i_sub': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (a.type !== 'int' || b.type !== 'int') return null;
        stack.push({ type: 'int', value: a.value - b.value });
        break;
      }
      case 'i_mul': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (a.type !== 'int' || b.type !== 'int') return null;
        stack.push({ type: 'int', value: a.value * b.value });
        break;
      }
      case 'explode': {
        const a = stack.pop()!;
        if (a.type !== 'const' || a.name !== instr.const || a.args.length !== instr.arity) {
          return null;
        }
        for (const t of [...a.args].reverse()) {
          stack.push(prog.data.expose(t));
        }
        break;
      }
      case 'build': {
        const args: Data[] = [];
        for (let i = 0; i < instr.arity; i++) {
          args.push(prog.data.hide(stack.pop()!));
        }
        stack.push({ type: 'const', name: instr.const, args: [...args].reverse() });
        break;
      }
      case 's_concat': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (a.type !== 'string' || b.type !== 'string') return null;
        stack.push({ type: 'string', value: `${a.value}${b.value}` });
        break;
      }
      case 's_starts': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (a.type !== 'string' || b.type !== 'string') return null;
        if (!a.value.startsWith(b.value)) return null;
        stack.push({ type: 'string', value: a.value.slice(b.value.length) });
        break;
      }
      case 's_ends': {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (a.type !== 'string' || b.type !== 'string') return null;
        if (!a.value.endsWith(b.value)) return null;
        stack.push({ type: 'string', value: a.value.slice(0, a.value.length - b.value.length) });
        break;
      }
      case 'fail': {
        return null;
      }
      case 'nondet_s_concat': {
        const a = stack.pop()!;
        if (a.type !== 'string') return null;

        const knownLimit = limit + newMem.length;
        const segments: (number | string)[] = [];
        for (const pat of instr.pattern) {
          let constantSegment: DataView;
          if (typeof pat === 'number') {
            if (pat < limit) {
              constantSegment = prog.data.expose(memory[pat]);
            } else if (pat < knownLimit) {
              constantSegment = prog.data.expose(newMem[pat]);
            } else {
              segments.push(pat - knownLimit);
              continue;
            }
          } else {
            constantSegment = pat;
          }

          if (constantSegment.type === 'string') {
            segments.push(constantSegment.value);
          } else {
            // Non-string pattern, fail immediately
            return null;
          }
        }

        for (const result of nondeterministicStringMatcher(prog.data, newMem, segments, a.value)) {
          yield result;
        }
        return null;
      }
    }
  }

  yield newMem;
  return null;
}

/**
 * @param mem
 * @param segments - nonempty list of segments
 * @param str - string to match
 */
export function* nondeterministicStringMatcher(
  data: HashCons,
  mem: Data[],
  segments: (number | string)[],
  str: string,
): Generator<Data[]> {
  if (segments.length <= 1) {
    if (segments[0] === 0) {
      mem.push(data.hide({ type: 'string', value: str }));
      yield mem;
      mem.pop();
    } else if (segments[0] === str) {
      yield mem;
    }
  } else {
    // Optimization: can we end early?
    const minLength = segments.reduce<number>(
      (accum, seg) => (typeof seg === 'number' ? accum : seg.length + accum),
      0,
    );
    if (minLength > str.length) return;

    const seg = segments[0];
    if (typeof seg === 'number') {
      // assert: seg === 0
      for (let i = 0; i <= str.length; i++) {
        const here = str.slice(0, i);
        const there = str.slice(i);
        mem.push(data.hide({ type: 'string', value: here }));
        for (const result of nondeterministicStringMatcher(
          data,
          mem,
          segments
            .slice(1)
            .map((seg) => (seg === 0 ? here : typeof seg === 'number' ? seg - 1 : seg)),
          there,
        )) {
          yield result;
        }
        mem.pop();
      }
    } else {
      if (str.startsWith(seg)) {
        for (const result of nondeterministicStringMatcher(
          data,
          mem,
          segments.slice(1),
          str.slice(seg.length),
        )) {
          yield result;
        }
      }
    }
  }
}
