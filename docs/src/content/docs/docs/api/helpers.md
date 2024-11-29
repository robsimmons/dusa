---
title: Dusa helpers
---

In addition to the [Dusa class and solution iterator](/docs/api/dusa/) and the
the [DusaSolution class](/docs/api/dusasolution/), the Dusa API includes a
couple of other utility functions.

### `compareTerm()` and `compareTerms()`

Provides a consistent comparison function for sorting Dusa terms or list of
Dusa terms.

```typescript
function compareTerm(t1: Term | BigTerm, t2: Term | BigTerm): number;
function compareTerms(t: (Term | BigTerm)[], s: (Term | BigTerm)[]): number;
```

### `termToString()`

Provides a consistent way of making terms into strings. If `true` is passed
as the `parens` argument, then structured terms with arguments will be
surrounded by parentheses.

```typescript
function termToString(tm: Term | BigTerm, parens = false): string;
```

### `check()` and `compile()`

The `check()` function runs just static checks on a Dusa program, and returns
a list of any issues that exist.

```typescript
interface Issue {
  type: 'Issue';
  msg: string;
  severity: 'warning' | 'error';
  loc?: SourceLocation;
}
function check(source: string): Issue[] | null;
```

The `compile()` function transforms a Dusa source program into an
intermediate "bytecode" representation which can be passed to the Dusa
constructor instead of a source program. If there are any issues, the
`DusaCompileError` exception will be thrown.

```typescript
interface DusaCompileError extends Error {
  issues: Issue[];
}
function compile(source: string): BytecodeProgram;
```
