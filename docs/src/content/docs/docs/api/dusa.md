---
title: class Dusa
---

The main entrypoint to the Dusa JavaScript API is the Dusa class. (The
[dusa NPM package](https://www.npmjs.com/package/dusa) also includes Typescript
definitions.)

## Creating a Dusa instance

### `Dusa()` constructor

A Dusa instance is created by passing a Dusa program to the constructor.

```javascript
const dusa = new Dusa(`
    edge a b.
    edge b c.
    edge c d.
    path X Y :- edge X Y.
    path X Z :- edge X Y, path Y Z.`);
```

If the program has errors, an error in the `DusaError` class will be thrown.

```javascript
// raises DusaError, X is conclusion but not premise.
const dusa = new Dusa(`edge a X.`);
```

## Solving a Dusa instance

Dusa programs can't be directly queried: they must first be solved. There are several
different ways to direct Dusa to generate solutions, all of which provide access to
[`DusaSolution` objects](/docs/api/dusasolution/).

### `solution` getter

If a Dusa program has at most one solution, that solution can be accessed with the
`solution` getter. The first time this method is accessed it will cause some
computation to happen (and it could even fail to terminate if there aren't finite
solutions). The result is cached, so subsequent calls will not trigger additional
computation.

```javascript
const dusa = new Dusa(`
    edge "a" "b".
    edge "b" "c".
    edge "c" "d".
    path X Y :- edge X Y.
    path X Z :- edge X Y, path Y Z.`);
dusa.solution; // Object of type DusaSolution
[...dusa.solution.lookup('path', 'a')]; // [ ["b"], ["c"], ["d"] ]
[...dusa.solution.lookup('path', 'd')]; // []
```

If no solutions exist, the `solution` getter will return `null`.

```javascript
const dusa = new Dusa(`
    name is "one".
    name is "two".`);
dusa.solution; // null
```

This getter can only be used if a single solution exists. Dusa will check for
additional solutions when the `solution` getter is accessed, and will throw an
exception if there are other solutions.

```javascript
const dusa = new Dusa(`name is { "one", "two" }.`);
dusa.solution; // raises DusaError
```

For programs with multiple solutions, use the `sample()` method or the `solutions`
getter, which returns an iterator.

### `sample()` method

The `sample()` method will return an arbitrary solution to the Dusa program, or
`null` if no solution exists.

Each call to `sample()` re-computes the program, so even if there are only a finite
(but nonzero) number of solutions, `sample()` can be called as many times as desired.

```javascript
const dusa = new Dusa(`name is { "one", "two" }.`);

for (let i = 0; i < 1000; i++) {
  for (const { args } of dusa.sample().lookup('name')) {
    console.log(args[0]);
  }
}
```

The current Dusa interpreter does not have a well-defined probabilistic semantics for
complex programs, but the simple program above will print `"one"` about 500 times and
will print `"two"` about 500 times.

### solutions getter

The `solutions` getter iterates through all the possible distinct solutions of a Dusa
program. The iterator works in an arbitrary order: this program will either print
`"one"` and then `"two"` or else it will print `"two"` and then `"one"`.

```javascript
const dusa = new Dusa(`name is { "one", "two" }.`);

for (const solution of dusa.solutions) {
  console.log([...solution.lookup('name')].args[0]);
}
```

Each time the `dusa.solutions` getter is accessed, an iterator is returned that
re-runs solution search, potentially returning solutions in a different order.

## Modifying a Dusa instance

The Dusa implementation doesn't support adding and removing rules after a `Dusa`
class instance has been created, but it does support adding additional **facts**,
which can be just as powerful. This can be useful for applications where the actual
set of facts isn't known ahead of time, but the desired analysis on those facts is
known.

### assert() method

The `assert` method of a Dusa instance takes an arbitrary number of arguments, each
one a Fact.

```javascript
const dusa = new Dusa(`
    path X Y :- edge X Y.
    path X Z :- edge X Y, path Y Z.`);

[...dusa.solution.lookup('path', 'a')]; // []
dusa.assert({ name: 'edge', args: ['a', 'b'] });
[...dusa.solution.lookup('path', 'a')]; // [ { args: ['b'] } ]
dusa.assert(
  { name: 'edge', args: ['b', 'c'] },
  { name: 'edge', args: ['e', 'b'] },
  { name: 'edge', args: ['d', 'e'] },
);
[...dusa.solution.lookup('path', 'a')]; // [ { args: ['b'] }, { args: ['c'] } ]
```
