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

Dusa programs can't be directly queried: they must first be solved. There are
several different ways to direct Dusa to generate solutions, all of which
provide access to [`DusaSolution` objects](/docs/api/dusasolution/).

### `solution` getter

Often all you need is to find a single solution (or to know that know
solutions exist). The first time you try to access `dusa.solution` some
computation will happen (and this could even fail to terminate). But then the
result is cached; subsequent calls will not trigger additional computation.

```javascript
const dusa = new Dusa(`
    edge "a" "b".
    edge "b" "c".
    edge "c" "d".
    path X Y :- edge X Y.
    path X Z :- edge X Y, path Y Z.`);
dusa.solution; // Object of type DusaSolution
[...dusa.solution.lookup('path', 'b')]; // [['c'], ['d']]
[...dusa.solution.lookup('path', 'c')]; // [['d']]
```

[Explore this example on val.town](https://www.val.town/v/robsimmons/solution_getter_yes)

If no solutions exist, the `solution` getter will return `null`.

```javascript
const dusa = new Dusa(`
    name is "one".
    name is "two".`);
dusa.solution; // null
```

[Explore this example on val.town](htthttps://www.val.town/v/robsimmons/solution_getter_no)

If there are multiple solutions, the `solution` getter will pick one solution,
and will always return that one.

```javascript
const dusa = new Dusa(`name is { "one", "two" }.`);
dusa.solution; // raises DusaError
```

[Explore this example on val.town](https://www.val.town/v/robsimmons/solution_getter_maybe)

### Getting all solutions

To enumerate the solutions to a program, you can use the Javascript iterator
notation. The iterator works in an arbitrary order: this program will either
print `[["one"]]` and then `[["two"]]` or else it will print `[["two"]]` and
then `[["one"]]`.

```javascript
const dusa = new Dusa(`name is { "one", "two" }.`);

for (const solution of dusa) {
  console.log([...solution.lookup('name')]);
}
```

[Explore this example on val.town](https://www.val.town/v/robsimmons/solutions_enumerate)

Each time you invoke the iterator `dusa` getter is accessed, search is re-run,
potentially returning solutions in a different order.

## Modifying a Dusa instance

The Dusa implementation doesn't support adding and removing rules after a
`Dusa` class instance has been created, but it does support adding additional
**facts**, which can be just as powerful. This can be useful for applications
where the actual set of facts isn't known ahead of time, but the desired
analysis on those facts is known.

### assert() method

The `assert` method of a Dusa instance takes an arbitrary number of arguments,
each one a Fact, and adds them to the database.

```javascript
const dusa = new Dusa(`
    path X Y :- edge X Y.
    path X Z :- edge X Y, path Y Z.`);

[...dusa.solution.lookup('path', 'a')]; // []
dusa.assert({ name: 'edge', args: ['a', 'b'] });
[...dusa.solution.lookup('path', 'a')]; // [['b', null]]
dusa.assert(
  { name: 'edge', args: ['b', 'c'] },
  { name: 'edge', args: ['e', 'b'] },
  { name: 'edge', args: ['d', 'e'] },
);
[...dusa.solution.lookup('path', 'a')]; // [['b', null], ['c', null]]
```

[Explore this example on val.town](https://www.val.town/v/robsimmons/dusa_assertion)
