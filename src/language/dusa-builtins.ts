export const BUILT_IN_MAP = {
  BOOLEAN_TRUE: true as true,
  BOOLEAN_FALSE: true as true,
  NAT_ZERO: true as true,
  NAT_SUCC: true as true,
  INT_PLUS: true as true,
  INT_MINUS: true as true,
  INT_TIMES: true as true,
  STRING_CONCAT: true as true,
} as const;

export type BUILT_IN_PRED = keyof typeof BUILT_IN_MAP;

type Mode = 'forward_only' | 'reversible' | { args: ('+' | '-')[]; value: '+' | '-' }[];

/** Modes have an order: if a position accepts '-', it must also accept '+' */
export const builtinModes: { [key in BUILT_IN_PRED]: Mode } = {
  BOOLEAN_TRUE: [{ args: [], value: '-' }],
  BOOLEAN_FALSE: [{ args: [], value: '-' }],
  NAT_ZERO: [{ args: [], value: '-' }],
  NAT_SUCC: [
    { args: ['+'], value: '-' },
    { args: ['-'], value: '+' },
  ],
  INT_PLUS: 'reversible',
  INT_MINUS: [{ args: ['+', '+'], value: '-' }],
  INT_TIMES: 'forward_only',
  STRING_CONCAT: 'forward_only',
};

export function isBuiltIn(s: string): s is BUILT_IN_PRED {
  return Object.hasOwn(BUILT_IN_MAP, s);
}
