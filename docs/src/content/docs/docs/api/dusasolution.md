---
title: class DusaSolution
---

A `DusaSolution` is a queryable solution to a Dusa program returned by
[solving a `Dusa` instance](docs/api/dusa/#solving-a-dusa-instance).

## Checking facts

### `has()` method

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
getBig(name: string, ...args: InputTerm): undefined | BigTerm;
```

An error will be raised if the number of `args` is not equal to the number of
arguments that the proposition has (not counting the value), or if the
predicate `name` is a Datalog predicate that does not have an `is` value.

## Querying solutions

### `lookup()` method

```typescript
lookup(name: string, ...args: InputTerm): Generator<Term[]>;
lookupBig(name: string, ...args: InputTerm): Generator<BigTerm[]>;
```

The `lookup()` method on solutions is a powerful query mechanism. If your
program has a relational proposition `path _ _`, then given only the first
argument `'path'`, `lookup()` will return an iterator over all the paths.

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

[Explore this example on val.town](https://www.val.town/v/robsimmons/lookup_all)

This will print the following in some order:

    Path from 1 to 2
    Path from 1 to 3
    Path from 1 to 4
    Path from 2 to 3
    Path from 2 to 4
    Path from 3 to 4

Given the first argument `'path'` and the second argument `2`, `lookup` will
return an iterator over all the second arguments `B` such that there is a fact
`path 2 B`.

```javascript
const dusa = new Dusa(`
    edge 1 2.
    edge 2 3.
    edge 3 4.
    path X Y :- edge X Y.
    path X Z :- edge X Y, path Y Z.`);
for (const [b] of dusa.solution.lookup('path', 2)) {
  console.log(`Path from 2 to ${b}`);
}
```

[Explore this example on val.town](https://www.val.town/v/robsimmons/lookup_some)

This will print the following:

    Path from 2 to 3
    Path from 2 to 4

In Typescript terms, the `lookup()` method has the following type:

```typescript
lookup(name: 'path'): IterableIterator<[Term, Term]>;
lookup(name: 'path', arg1: InputTerm): IterableIterator<[Term]>;
lookup(name: 'path', arg1: InputTerm, arg2: InputTerm): IterableIterator<[]>;
```

For a functional proposition like `name _ is _`, the effective type of the
`lookup()` method is:

```typescript
lookup(name: 'name'): IterableIterator<[Term, Term]>;
lookup(name: 'name', arg1: InputTerm): IterableIterator<[Term]>;
```

## Enumerating all facts

### `facts()`

```typescript
facts(): Fact[];
factsBig(): BigFact[];
```

The `facts` method provides a list of all the
[facts](/docs/api/terms/#type-fact) in a solution. The `lookup()` method
is generally going to be preferable.

```javascript
const dusa = new Dusa(`
    #builtin INT_MINUS minus
    digit 9.
    digit (minus N 1) :- digit N, N != 0.`);

for (const fact of dusa.solution.facts) {
  console.log(fact);
}
```

[Explore this example on val.town](https://www.val.town/v/robsimmons/list_the_facts)
