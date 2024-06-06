export const BUILT_IN_MAP = {
  BOOLEAN_TRUE: null as null,
  BOOLEAN_FALSE: null as null,
  NAT_ZERO: null as null,
  NAT_SUCC: null as null,
  INT_PLUS: null as null,
  INT_MINUS: null as null,
  INT_TIMES: null as null,
  STRING_CONCAT: null as null,
  CHECK_GT: null as null,
  CHECK_GEQ: null as null,
  CHECK_LT: null as null,
  CHECK_LEQ: null as null,
  EQUAL: null as null,
  NOT_EQUAL: null as null,
} as const;

export type BUILT_IN_PRED = keyof typeof BUILT_IN_MAP;

export function isBuiltIn(s: string): s is BUILT_IN_PRED {
  return Object.hasOwn(BUILT_IN_MAP, s);
}

export interface BuiltinMode {
  args: ('input' | 'wildcards' | 'output')[];
  value: 'input' | 'output';
}

export function builtinModes(builtin: BUILT_IN_PRED): (mode: BuiltinMode) => boolean {
  switch (builtin) {
    case 'BOOLEAN_TRUE':
    case 'BOOLEAN_FALSE':
    case 'NAT_ZERO':
      return ({ args }) => args.length === 0;

    case 'NAT_SUCC':
      return ({ args, value }) => args.length === 1 && (args[0] === 'input' || value === 'input');

    case 'CHECK_GT':
    case 'CHECK_GEQ':
    case 'CHECK_LT':
    case 'CHECK_LEQ':
      return ({ args }) => args.length === 2 && args[0] === 'input' && args[1] === 'input';

    case 'EQUAL':
      return ({ args, value }) => 
        args.length >= 2 && value === 'input' && (args[0] === 'input' || args[1] === 'input');

    case 'NOT_EQUAL':
      return ({ args, value }) =>
        args.length >= 2 &&
        value === 'input' &&
        args.every((arg) => arg !== 'output') &&
        (args[0] === 'input' || args[1] === 'input');

    case 'INT_PLUS':
    case 'INT_TIMES':
    case 'STRING_CONCAT':
      return ({ args, value }) =>
        args.length >= 2 &&
        (value !== 'input' ? 1 : 0) + args.filter((arg) => arg !== 'input').length <= 1;

    case 'INT_MINUS':
      return ({ args, value }) =>
        args.length === 2 &&
        (value !== 'input' ? 1 : 0) + args.filter((arg) => arg !== 'input').length <= 1;
  }
}
