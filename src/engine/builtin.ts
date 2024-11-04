import { BUILT_IN_PRED } from '../language/dusa-builtins.js';
import { BOOL_FALSE, BOOL_TRUE, TRIVIAL, Data, expose, hide } from '../datastructures/data.js';
import { Substitution, equal, match } from './dataterm-old.js';
import { Pattern } from '../language/terms.js';

export function* runBuiltinBackward(
  pred: BUILT_IN_PRED,
  prefix: Data[],
  matchPosition: Pattern,
  postfix: Data[],
  value: Data,
  substitution: Substitution,
): IterableIterator<Substitution> {
  const v = expose(value);
  switch (pred) {
    case 'BOOLEAN_FALSE':
    case 'BOOLEAN_TRUE':
    case 'NAT_ZERO':
    case 'INT_TIMES':
      throw new TypeError(`${pred} should not be run backwards`);
    case 'NAT_SUCC': {
      if (v.type !== 'int') return;
      if (v.value <= 0n) return;
      const subst = match(substitution, matchPosition, hide({ type: 'int', value: v.value - 1n }));
      if (subst !== null) {
        yield subst;
      }
      return;
    }
    case 'INT_MINUS': {
      if (v.type !== 'int') return;
      let expected: bigint;
      if (prefix.length === 1 && postfix.length === 0) {
        const a = expose(prefix[0]);
        if (a.type !== 'int') return;
        expected = a.value - v.value;
      } else if (prefix.length === 0 && postfix.length === 1) {
        const b = expose(prefix[0]);
        if (b.type !== 'int') return;
        expected = v.value + b.value;
      } else {
        throw new TypeError(
          `INT_MINUS expects 2 arguments, given ${prefix.length + postfix.length + 1}`,
        );
      }
      const subst = match(substitution, matchPosition, hide({ type: 'int', value: expected }));
      if (subst !== null) {
        yield subst;
      }
      return;
    }
    case 'INT_PLUS': {
      if (v.type !== 'int') return;
      let expected = v.value;
      for (const arg of prefix.concat(postfix)) {
        const view = expose(arg);
        if (view.type !== 'int') return;
        expected = expected - view.value;
      }
      const subst = match(substitution, matchPosition, hide({ type: 'int', value: expected }));
      if (subst !== null) {
        yield subst;
      }
      return;
    }

    case 'STRING_CONCAT': {
      const preStr: string[] = [];
      for (const arg of prefix) {
        const view = expose(arg);
        if (view.type !== 'string') return;
        preStr.push(view.value);
      }
      const postStr: string[] = [];
      for (const arg of postfix) {
        const view = expose(arg);
        if (view.type !== 'string') return;
        postStr.push(view.value);
      }
      if (v.type !== 'string') return;
      const pre = preStr.join('');
      const post = postStr.join('');
      if (!v.value.startsWith(pre)) return;
      let result = v.value.slice(pre.length);
      if (!result.endsWith(post)) return;
      result = result.slice(0, result.length - post.length);
      const subst = match(substitution, matchPosition, hide({ type: 'string', value: result }));
      if (subst === null) return;
      yield subst;
      return;
    }
    case 'EQUAL': {
      if (v.type !== 'trivial') return;
      let actualValue: Data | null = null;
      for (const arg of prefix.concat(postfix)) {
        if (actualValue === null) {
          actualValue = arg;
        } else {
          if (!equal(actualValue, arg)) {
            return;
          }
        }
      }
      const subst = match(substitution, matchPosition, actualValue!);
      if (subst !== null) {
        yield subst;
      }
      return;
    }
    case 'NOT_EQUAL': {
      if (v.type !== 'trivial') return;
      let actualValue: Data | null = null;
      for (const arg of prefix.concat(postfix)) {
        if (actualValue === null) {
          actualValue = arg;
        } else {
          if (equal(actualValue, arg)) {
            yield substitution;
            return;
          }
        }
      }
      const subst = match(substitution, matchPosition, actualValue!);
      if (subst === null) {
        yield substitution;
      }
      return;
    }
  }
}

function bool(b: boolean): Data {
  return b ? BOOL_TRUE : BOOL_FALSE;
}

export function runBuiltinForward(pred: BUILT_IN_PRED, args: Data[]): Data | null {
  switch (pred) {
    case 'BOOLEAN_FALSE':
      return BOOL_FALSE;
    case 'BOOLEAN_TRUE':
      return BOOL_TRUE;
    case 'NAT_ZERO':
      return hide({ type: 'int', value: 0n });
    case 'EQUAL':
      for (let i = 1; i < args.length; i++) {
        if (!equal(args[i - 1], args[i])) return null;
      }
      return TRIVIAL;
    case 'NOT_EQUAL':
      for (let i = 1; i < args.length; i++) {
        if (!equal(args[i - 1], args[i])) return TRIVIAL;
      }
      return null;
    case 'CHECK_GEQ':
    case 'CHECK_GT':
    case 'CHECK_LEQ':
    case 'CHECK_LT': {
      const [a, b] = args.map(expose);
      if (a.type !== 'int' || b.type !== 'int') return null;
      let compare: 'gt' | 'eq' | 'lt' = 'eq';
      if (a.value > b.value) compare = 'gt';
      if (a.value < b.value) compare = 'lt';
      return pred === 'CHECK_GEQ'
        ? bool(compare === 'gt' || compare === 'eq')
        : pred === 'CHECK_GT'
          ? bool(compare === 'gt')
          : pred === 'CHECK_LEQ'
            ? bool(compare === 'lt' || compare === 'eq')
            : bool(compare === 'lt');
    }
    case 'STRING_CONCAT': {
      const strings: string[] = [];
      for (const arg of args) {
        const view = expose(arg);
        if (view.type !== 'string') return null;
        strings.push(view.value);
      }
      return hide({ type: 'string', value: strings.join('') });
    }
    case 'INT_MINUS': {
      if (args.length !== 2) {
        throw new TypeError(`INT_MINUS expects 2 arguments, given ${args.length}`);
      }
      const [a, b] = args.map(expose);
      if (a.type !== 'int' || b.type !== 'int') return null;
      return hide({ type: 'int', value: a.value - b.value });
    }
    case 'INT_PLUS': {
      let sum = 0n;
      for (const arg of args) {
        const view = expose(arg);
        if (view.type !== 'int') return null;
        sum += view.value;
      }
      return hide({ type: 'int', value: sum });
    }
    case 'INT_TIMES': {
      let product = 1n;
      for (const arg of args) {
        const view = expose(arg);
        if (view.type !== 'int') return null;
        product *= view.value;
      }
      return hide({ type: 'int', value: product });
    }
    case 'NAT_SUCC': {
      const n = expose(args[0]);
      if (n.type !== 'int') return null;
      if (n.value < 0) return null;
      return hide({ type: 'int', value: n.value + 1n });
    }
  }
}
