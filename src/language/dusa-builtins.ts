export const BUILT_IN_MAP = {
  BOOLEAN_TRUE: true as const,
  BOOLEAN_FALSE: true as const,
  NAT_ZERO: true as const,
  NAT_SUCC: true as const,
  INT_PLUS: true as const,
  INT_MINUS: true as const,
  INT_TIMES: true as const,
  STRING_CONCAT: true as const,
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
  INT_MINUS: [
    { args: ['+', '+'], value: '-' },
    { args: ['+', '-'], value: '+' },
    { args: ['-', '+'], value: '+' },
  ],
  INT_TIMES: 'forward_only',
  STRING_CONCAT: 'reversible',
};

export function isBuiltIn(s: string): s is BUILT_IN_PRED {
  return Object.hasOwn(BUILT_IN_MAP, s);
}
