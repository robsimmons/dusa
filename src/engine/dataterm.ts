import { Data, expose, hide } from '../datastructures/data';
import { Pattern } from '../langauge/terms';

export type Substitution = { [varName: string]: Data };

export function match(
  substitution: Substitution,
  pattern: Pattern,
  data: Data,
): null | Substitution {
  const dv = expose(data);
  switch (pattern.type) {
    case 'triv':
      if (pattern.type !== dv.type) return null;
      return substitution;
    case 'int':
    case 'nat':
      if (dv.type !== 'int') return null;
      if (BigInt(pattern.value) !== dv.value) return null;
      return substitution;
    case 'string':
      if (pattern.type !== dv.type) return null;
      if (pattern.value !== dv.value) return null;
      return substitution;
    case 'special':
      if (pattern.name === 'NAT_ZERO' && pattern.args.length === 0) {
        if (dv.type !== 'int') {
          throw new Error(`Type error: matching NAT_ZERO against a ${dv.type}`);
        }

        return dv.value === 0n ? substitution : null;
      }

      if (pattern.name === 'NAT_SUCC' && pattern.args.length === 1) {
        if (dv.type !== 'int') {
          throw new Error(`Type error: matching NAT_SUCC against a ${dv.type}`);
        }
        return dv.value > 0n
          ? match(substitution, pattern.args[0], hide({ type: 'int', value: dv.value - 1n }))
          : null;
      }

      if (pattern.name === 'INT_PLUS') {
        if (dv.type !== 'int') {
          throw new Error(`Type error: matching INT_PLUS against a ${dv.type}`);
        }
        const increment = pattern.args
          .map((arg, i) => {
            if (i === pattern.nonground) return 0n;
            const value = expose(apply(substitution, arg));
            if (value.type !== 'int') {
              throw new Error(`Type error: argument #${i} to INT_PLUS is ${dv.type}, not int.`);
            }
            return value.value;
          })
          .reduce((x, y) => x + y, 0n);

        if (pattern.nonground === undefined) {
          return increment === dv.value ? substitution : null;
        }
        return match(
          substitution,
          pattern.args[pattern.nonground],
          hide({ type: 'int', value: dv.value - increment }),
        );
      }

      if (pattern.name === 'INT_MINUS' && pattern.args.length === 2) {
        if (dv.type !== 'int') {
          throw new Error(`Type error: matching INT_MINUS against a ${dv.type}`);
        }
        if (pattern.nonground === undefined) {
          const [x, y] = pattern.args.map((arg, i) => {
            const value = expose(apply(substitution, arg));
            if (value.type !== 'int') {
              throw new Error(`Type error: argument #${i} to INT_MINUS is ${dv.type}, not int.`);
            }
            return value.value;
          });
          return x - y === dv.value ? substitution : null;
        }
        throw new Error('Non ground matching against INT_MINUS not implemented');
      }

      if (pattern.name === 'STRING_CONCAT') {
        if (dv.type !== 'string') {
          throw new Error(`Type error: matching STRING_CONCAT against a ${dv.type}`);
        }

        const strings = pattern.args.map((arg, i) => {
          if (i === pattern.nonground) return '';
          const value = expose(apply(substitution, arg));
          if (value.type !== 'string') {
            throw new Error(
              `Type error: argument #${i} to STRING_CONCAT is ${value.type}, not string.`,
            );
          }
          return value.value;
        });

        if (pattern.nonground === undefined) {
          return strings.join('') === dv.value ? substitution : null;
        }
        const prefix = strings.slice(0, pattern.nonground).join('');
        if (dv.value.length < prefix.length || prefix !== dv.value.slice(0, prefix.length)) {
          return null;
        }

        const prefixRemoved = dv.value.slice(prefix.length);
        const postfix = strings.slice(pattern.nonground + 1).join('');
        if (
          prefixRemoved.length < postfix.length ||
          postfix !== prefixRemoved.slice(prefixRemoved.length - postfix.length)
        ) {
          return null;
        }

        return match(
          substitution,
          pattern.args[pattern.nonground],
          hide({
            type: 'string',
            value: prefixRemoved.slice(0, prefixRemoved.length - postfix.length),
          }),
        );
      }

      throw new Error(
        `Type error: cannot support ${pattern.name} with ${pattern.args.length} argument${
          pattern.args.length === 1 ? '' : 's'
        }`,
      );

    case 'const':
      if (dv.type !== 'const' || pattern.name !== dv.name || pattern.args.length !== dv.args.length)
        return null;
      for (let i = 0; i < pattern.args.length; i++) {
        const candidate = match(substitution, pattern.args[i], dv.args[i]);
        if (candidate === null) return null;
        substitution = candidate;
      }
      return substitution;

    case 'wildcard':
      return substitution;

    case 'var':
      if (substitution[pattern.name] !== undefined) {
        return equal(substitution[pattern.name], data) ? substitution : null;
      }
      return { [pattern.name]: data, ...substitution };
  }
}

export function apply(substitution: Substitution, pattern: Pattern): Data {
  switch (pattern.type) {
    case 'triv':
    case 'string': {
      return hide(pattern);
    }
    case 'int':
    case 'nat':
      return hide({ type: 'int', value: BigInt(pattern.value) });

    case 'special': {
      if (pattern.name === 'NAT_ZERO' && pattern.args.length === 0) {
        return hide({ type: 'int', value: 0n });
      }

      if (pattern.name === 'NAT_SUCC' && pattern.args.length === 1) {
        const arg = expose(apply(substitution, pattern.args[0]));
        if (arg.type === 'int') {
          return hide({ type: 'int', value: arg.value + 1n });
        } else {
          throw new Error(`Type error: argument to NAT_SUCC is an ${arg.type}, not a nat.`);
        }
      }

      if (pattern.name === 'INT_PLUS') {
        const args = pattern.args.map((arg, i) => {
          const value = expose(apply(substitution, arg));
          if (value.type !== 'int') {
            throw new Error(`Type error: argument #${i} to INT_PLUS is ${value.type}, not int.`);
          }
          return value.value;
        });
        return hide({
          type: 'int',
          value: args.reduce((x, y) => x + y, 0n),
        });
      }

      if (pattern.name === 'INT_MINUS' && pattern.args.length === 2) {
        const [x, y] = pattern.args.map((arg, i) => {
          const value = expose(apply(substitution, arg));
          if (value.type !== 'int') {
            throw new Error(`Type error: argument #${i} to INT_PLUS is ${value.type}, not int.`);
          }
          return value.value;
        });
        return hide({ type: 'int', value: x - y });
      }

      if (pattern.name === 'STRING_CONCAT') {
        const args = pattern.args.map((arg, i) => {
          const value = expose(apply(substitution, arg));
          if (value.type !== 'string') {
            throw new Error(
              `Type error: argument #${i} to STRING_CONCAT is ${value.type}, not string.`,
            );
          }
          return value.value;
        });
        return hide({ type: 'string', value: args.join('') });
      }

      throw new Error(
        `Type error: cannot support ${pattern.name} with ${pattern.args.length} argument${
          pattern.args.length === 1 ? '' : 's'
        }`,
      );
    }

    case 'const': {
      return hide({
        type: 'const',
        name: pattern.name,
        args: pattern.args.map((arg) => apply(substitution, arg)),
      });
    }

    case 'wildcard': {
      throw new Error(`Cannot match apply a substitution to a pattern containing the wildcard '_'`);
    }

    case 'var': {
      const result = substitution[pattern.name];
      if (result == null) {
        throw new Error(
          `Free variable '${pattern.name}' not assigned to in grounding substitution`,
        );
      }
      return result;
    }
  }
}

export function equal(t: Data, s: Data): boolean {
  return t === s;
}
