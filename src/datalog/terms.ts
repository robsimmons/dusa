export type Pattern =
  | { type: 'triv' }
  | { type: 'int'; value: number }
  | { type: 'nat'; value: number }
  | { type: 'string'; value: string }
  | { type: 'const'; name: string; args: Pattern[] }
  | { type: 'var'; name: string };

export type Data =
  | { type: 'triv' }
  | { type: 'int'; value: number }
  | { type: 'nat'; value: number }
  | { type: 'string'; value: string }
  | { type: 'const'; name: string; args: Data[] };

export type Substitution = { [varName: string]: Data };

const NAT_ZERO = 'z';
const NAT_SUCC = 's';
const INT_PLUS = 'plus';

export function match(
  substitution: Substitution,
  pattern: Pattern,
  data: Data,
): null | Substitution {
  switch (pattern.type) {
    case 'triv':
      if (pattern.type !== data.type) return null;
      return substitution;
    case 'int':
    case 'nat':
      if (data.type !== 'int' && data.type !== 'nat') return null;
      if (pattern.value !== data.value) return null;
      return substitution;
    case 'string':
      if (pattern.type !== data.type) return null;
      if (pattern.value !== data.value) return null;
      return substitution;

    case 'const':
      if (pattern.name === NAT_ZERO && pattern.args.length === 0) {
        if (data.type !== 'nat') {
          throw new Error(`Type error: matching nat '${NAT_ZERO}' against a ${data.type}`);
        }
        return data.value === 0 ? substitution : null;
      }

      if (pattern.name === NAT_SUCC && pattern.args.length === 1) {
        if (data.type !== 'nat') {
          throw new Error(
            `Type error: matching nat constructor '${NAT_SUCC}' against a ${data.type}`,
          );
        }
        return data.value > 0
          ? match(substitution, pattern.args[0], { type: 'nat', value: data.value - 1 })
          : null;
      }

      if (pattern.name === INT_PLUS && pattern.args.length === 2) {
        if (data.type !== 'int' && data.type !== 'nat') {
          throw new Error(
            `Type error: matching int constructor '${INT_PLUS}' against a ${
              data.type
            } ${JSON.stringify(data)}`,
          );
        }
        const increment = apply(substitution, pattern.args[0]);
        if (increment.type !== 'int' && increment.type !== 'nat') {
          throw new Error(
            `Type error: second argument to int constructor '${INT_PLUS}' is a ${data.type}`,
          );
        }
        return match(substitution, pattern.args[1], {
          type: 'int',
          value: data.value - increment.value,
        });
      }

      if (
        data.type !== 'const' ||
        pattern.name !== data.name ||
        pattern.args.length !== data.args.length
      )
        return null;
      for (let i = 0; i < pattern.args.length; i++) {
        const candidate = match(substitution, pattern.args[i], data.args[i]);
        if (candidate === null) return null;
        substitution = candidate;
      }
      return substitution;
    case 'var':
      if (substitution[pattern.name]) {
        return equal(substitution[pattern.name], data) ? substitution : null;
      }
      return { [pattern.name]: data, ...substitution };
  }
}

export function apply(substitution: Substitution, pattern: Pattern): Data {
  switch (pattern.type) {
    case 'triv':
    case 'int':
    case 'nat':
    case 'string':
      return pattern;

    case 'const':
      if (pattern.name === NAT_ZERO && pattern.args.length === 0) {
        return { type: 'nat', value: 0 };
      }

      if (pattern.name === NAT_SUCC && pattern.args.length === 1) {
        const arg = apply(substitution, pattern.args[0]);
        if (arg.type === 'nat') {
          return { type: 'nat', value: arg.value + 1 };
        } else {
          throw new Error(`Type error: argument to '${NAT_SUCC}' is an ${arg.type}, not a nat.`);
        }
      }

      if (pattern.name === INT_PLUS && pattern.args.length === 2) {
        const [arg1, arg2] = pattern.args.map((arg) => apply(substitution, arg));
        if (arg1.type !== 'int' && arg1.type !== 'nat') {
          throw new Error(
            `Type error: first argument to '${INT_PLUS}' is an ${arg1.type}, not an int.`,
          );
        }
        if (arg2.type !== 'int' && arg2.type !== 'nat') {
          throw new Error(
            `Type error: second argument to '${INT_PLUS}' is an ${arg2.type}, not an int.`,
          );
        }
        return {
          type: 'int',
          value: arg1.value + arg2.value,
        };
      }

      return {
        type: 'const',
        name: pattern.name,
        args: pattern.args.map((arg) => apply(substitution, arg)),
      };

    case 'var':
      const result = substitution[pattern.name];
      if (!result) {
        throw new Error(
          `Free variable '${pattern.name}' not assigned to in grounding substitution`,
        );
      }
      return result;
  }
}

export function equal(t: Data, s: Data): boolean {
  switch (t.type) {
    case 'triv':
      return t.type === s.type;
    case 'int':
    case 'nat':
      return (s.type === 'int' || s.type === 'nat') && t.value === s.value;
    case 'string':
      return t.type === s.type && t.value === s.value;
    case 'const':
      return (
        t.type === s.type &&
        t.name === s.name &&
        t.args.length === s.args.length &&
        t.args.every((arg, i) => equal(arg, s.args[i]))
      );
  }
}

export function termToString(t: Pattern): string {
  switch (t.type) {
    case 'triv':
      return `()`;
    case 'int':
    case 'nat':
      return `${t.value}`;
    case 'string':
      return `"${t.value}"`;
    case 'const':
      return t.args.length === 0
        ? t.name
        : `(${t.name} ${t.args.map((arg) => termToString(arg)).join(' ')})`;
    case 'var':
      return t.name;
  }
}

export function assertData(p: Pattern): Data {
  return apply({}, p);
}

export function parseTerm(s: string): { data: Pattern; rest: string } | null {
  if (s[0] === '"') {
    const end = s.slice(1).indexOf('"');
    if (end === -1) {
      throw new Error('Unmatched quote');
    }
    return {
      data: { type: 'string', value: s.slice(1, end + 1) },
      rest: s.slice(end + 2).trimStart(),
    };
  }

  if (s[0] === '(') {
    if (s[1] === ')') {
      return { data: { type: 'triv' }, rest: s.slice(2).trimStart() };
    }
    let next = parseTerm(s.slice(1));
    if (next === null) {
      throw new Error('No term following an open parenthesis');
    }
    if (next.rest[0] !== ')') {
      throw new Error('Did not find expected matching parenthesis');
    }
    return { data: next.data, rest: next.rest.slice(1).trimStart() };
  }

  const constMatch = s.match(/^-?[0-9a-zA-Z]+/);
  if (constMatch) {
    if (constMatch[0].match(/^[A-Z]/)) {
      return {
        data: { type: 'var', name: constMatch[0] },
        rest: s.slice(constMatch[0].length).trimStart(),
      };
    }
    if (constMatch[0].match(/^-?[0-9]/)) {
      if (`${parseInt(constMatch[0])}` !== constMatch[0]) {
        throw new Error(`Bad number: '${constMatch[0]}'`);
      }
      const value = parseInt(constMatch[0]);
      return {
        data: { type: value < 0 ? 'int' : 'nat', value },
        rest: s.slice(constMatch[0].length).trimStart(),
      };
    }
    let rest = s.slice(constMatch[0].length).trimStart();
    const args = [];
    let next = parseTerm(rest);
    while (next !== null) {
      args.push(next.data);
      rest = next.rest;
      next = parseTerm(next.rest);
    }
    return { data: { type: 'const', name: constMatch[0], args }, rest };
  }

  return null;
}

export function parsePattern(s: string): Pattern {
  const result = parseTerm(s);
  if (result === null) {
    throw new Error(`Could not parse '${s}' as a pattern`);
  }
  if (result.rest !== '') {
    throw new Error(`Unexpected parsing '${s}' as a pattern: '${result.rest[0]}'`);
  }
  return result.data;
}

export function parseData(s: string): Data {
  return assertData(parsePattern(s));
}

function freeVarsAccum(s: Set<string>, p: Pattern) {
  switch (p.type) {
    case 'var':
      s.add(p.name);
      return;
    case 'int':
    case 'string':
    case 'triv':
      return;
    case 'const':
      for (let arg of p.args) {
        freeVarsAccum(s, arg);
      }
      return;
  }
}

export function freeVars(...patterns: Pattern[]): Set<string> {
  const s = new Set<string>();
  for (let pattern of patterns) {
    freeVarsAccum(s, pattern);
  }
  return s;
}
