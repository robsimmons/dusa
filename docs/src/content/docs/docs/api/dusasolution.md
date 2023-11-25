---
title: class DusaSolution
---

A `DusaSolution` is a queryable solution to a Dusa program returned by
[solving a `Dusa` instance](docs/api/dusa/#solving-a-dusa-instance).

## Checking facts

### `has()`method

The `has()` method is intended to check whether a relational proposition
exists in a solution.

```typescript
has(name: string, ...args: InputTerm): boolean;
```

An error will be raised if the number of `args` is not equal to the number of
arguments that the proposition has.

### `get()` method

The `get()` method is intended to check the value assigned to a functional
proposition.

```typescript
get(name: string, ...args: InputTerm): undefined | Term;
```

An error will be raised if the number of `args` is not equal to the number of
arguments that the proposition has (not counting the value).

### Example

Since [functional and relational propositions are actually the same
thing](/docs/language/facts/#everythings-secretly-functional), either `has()`
or `get()` can be used with any proposition.

In a solution with propositions of the form `node _`, `edge _ _`, and
`color _ is _`, the implied Typescript types for `has()` and `get()` are as follows:

```typescript
has(name: 'node', arg1: InputTerm): boolean;
has(name: 'edge', arg1: InputTerm, arg2: InputTerm): boolean;
has(name: 'color', arg1: InputTerm): boolean;
get(name: 'node', arg1: InputTerm): undefined | null;
get(name: 'edge', arg1: InputTerm, arg2: InputTerm): undefined | null;
get(name: 'color', arg1: InputTerm): undefined | Term;
```

These can be used like this:

```javascript
const dusa = new Dusa(`
    edge 1 2.
    node 1.
    node 2.
    node 3.
    color 1 is "blue".
    color 2 is "red".`);

dusa.solution.has('node', 1); // === true
dusa.solution.has('node', 7); // === false
dusa.solution.get('node', 3); // === null, () in Dusa
dusa.solution.get('node', 9); // === undefined

dusa.solution.has('edge', 1, 2); // === true
dusa.solution.has('edge', 2, 1); // === false

dusa.solution.get('color', 1); // === "blue"
dusa.solution.get('color', 9); // === undefined
```

## Enumerating all facts

### `facts` getter

The `facts` getter provides an iterator over all the [facts](/docs/api/terms/#type-fact)
in a solution.

```javascript
const dusa = new Dusa(`
    #builtin INT_MINUS minus
    digit 9.
    digit (minus N 1) :- digit N, N != 0.`);

for (const fact of dusa.solution.facts) {
  console.log(fact);
}
```

## Querying solutions

### `lookup()` method

The `lookup()` method on solutions is a powerful query mechanism. If your program
has a relational proposition `path _ _`, then given only the first argument
`'path'`, `lookup()` will return an iterator over all the paths.

```javascript
const dusa = new Dusa(`
    edge 1 2.
    edge 2 3.
    edge 3 4.
    path X Y :- edge X Y.
    path X Z :- edge X Y, path Y Z.`);
for (const [a, b] of dusa.solution.lookup('path')) {
  console.log(`Path from ${a} to ${b}`);
}
```

This will print the following:

    Path from 1 to 2
    Path from 1 to 3
    Path from 1 to 4
    Path from 2 to 3
    Path from 2 to 4
    Path from 3 to 4

Given the first argument `'path'` and the second argument `2n`, `lookup` will
return an iterator over all the second arguments `B` such that there is a fact
`path 2 B`.

```javascript
const dusa = new Dusa(`
    edge 1 2.
    edge 2 3.
    edge 3 4.
    path X Y :- edge X Y.
    path X Z :- edge X Y, path Y Z.`);
for (const [b] of dusa.solution.lookup('path', 2n)) {
  console.log(`Path from 2 to ${b}`);
}
```

This will print the following:

    Path from 2 to 3
    Path from 2 to 4

In Typescript terms, the `lookup()` method has the following type:

```typescript
lookup(name: 'path'): IterableIterator<[Term, Term, null]>;
lookup(name: 'path', arg1: InputTerm): IterableIterator<[Term, null]>;
lookup(name: 'path', arg1: InputTerm, arg2: InputTerm): IterableIterator<[null]>;
```

For a functional proposition like `name _ is _`, the effective type of the
`lookup()` method is:

```typescript
lookup(name: 'name'): IterableIterator<[Term, Term]>;
lookup(name: 'name', arg1: InputTerm): IterableIterator<[Term]>;
```
