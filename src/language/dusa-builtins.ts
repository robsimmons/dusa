export const BUILT_IN_MAP = {
  BOOLEAN_TRUE: null as null | string,
  BOOLEAN_FALSE: null as null | string,
  NAT_ZERO: null as null | string,
  NAT_SUCC: null as null | string,
  INT_PLUS: null as null | string,
  INT_MINUS: null as null | string,
  STRING_CONCAT: null as null | string,
  EQUAL: null as null | string,
} as const;

export type BUILT_IN_PRED = keyof typeof BUILT_IN_MAP;
