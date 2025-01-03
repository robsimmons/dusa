---
title: Terms
---

## Output types

All Dusa terms have a correspondence with JavaScript types:

- The trivial type `()` in Dusa corresponds to `null` in JavaScript.
- The string type in Dusa corresponds to the string type in JavaScript.
- The integer and natural number types in Dusa correspond to either the
  Number type or the
  [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
  type in JavaScript. The JavaScript BigInt four is written as `4n`, not `4`.
- Constants like `a`, `tt`, or `bob` in Dusa correspond to objects
  `{ name: 'a' }`, `{ name: 'tt' }`, or `{ name: 'bob' }` in JavaScript.
- An uninterpreted function with arguments like `h c "fish"` in Dusa
  corresponds to an object `{ name: 'h', args: [{ name: 'c' }, 'fish'] }` in JavaScript.

### type `Term` and `BigTerm`

The `Term` type is more convenient to use in JavaScript; `BigTerm` represents
integers with the `bigint` type and so will correctly represent very positive
or very negative large integers without rounding.

```typescript
export type Term =
  | null // Trivial type ()
  | number // Natural numbers and integers
  | string // Strings
  | { name: string } // Constants
  | { name: string; args: [Term, ...Term[]] };
export type BigTerm =
  | null // Trivial type ()
  | bigint // Natural numbers and integers
  | string // Strings
  | { name: string } // Constants
  | { name: string; args: [Term, ...Term[]] };
```

### type `Fact`

```typescript
export interface Fact {
  name: string;
  args: Term[];
  value?: Term;
}
export interface BigFact {
  name: string;
  args: BigTerm[];
  value?: BigTerm;
}
```

## Input types

The Dusa and DusaSolution methods that take terms and facts as argument accept
inputs that are more flexible than the outputs that Dusa will return (see the
[Robustness Principle](https://en.wikipedia.org/wiki/Robustness_principle)).

### type `InputTerm`

Dusa will accept numbers of type `number` and convert them to
[BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
values. This will raise a `RangeError` if you try to pass a non-integer
`number` to Dusa.

An input constant like `a` can also be given as `{ name: 'a', args: [] }`,
even though that constant will always be output as `{ name: 'a' }`.

### type `InputFact`

```typescript
export interface InputFact {
  name: string;
  args?: InputTerm[];
  value?: InputTerm;
}
```

Both the `args` field and the `value` field are is optional when giving a fact
as an argument (for example, to the [`assert()`
method](/docs/api/dusa/#assert-method).).
