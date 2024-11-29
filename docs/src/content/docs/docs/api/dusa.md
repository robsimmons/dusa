---
title: class Dusa
---

The main entrypoint to the Dusa JavaScript API is the Dusa class.

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

If the program has errors, an error in the `DusaCompileError` class will be thrown.

```javascript
// raises DusaCompileError, X is conclusion but not premise.
const dusa = new Dusa(`edge a X.`);
```

## Solving a Dusa instance

Dusa programs can't be directly queried: they must first be solved. There are
several different ways to direct Dusa to generate solutions, all of which
provide access to [`DusaSolution` objects](/docs/api/dusasolution/).

### `sample()` method and `solution` getter

Often all you need is to find a single solution (or to know that at least one
solution exists). The `sample()` method just returns a single solution, but
will potentially return a different solution every time it is called. The
`solution` getter will generate a sample the first time it is accessed and 
will then remember that sample; from then on accessing `dusa.solution` will 
always return the _same_ solution until new facts are asserted.

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

[Explore this example on val.town](https://www.val.town/v/robsimmons/solution_getter_no)

If there are multiple solutions, the `solution` getter will pick one solution,
and will always return that one.

```javascript
const dusa = new Dusa(`name is { "one", "two" }.`);
dusa.solution.get("name"); // either "one" or "two"
```

[Explore this example on val.town](https://www.val.town/v/robsimmons/solution_getter_maybe)

### Getting a solution iterator with `solve()`

The `solve()` function returns a extended
[JavaScript iterator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator)
that will, upon successive calls to `next()`, return each solution for the
Dusa program. The iterator works in an arbitrary order: this program will
either print `"one"` and then `"two"` or else it will print `"two"` and then
`"one"`.

```javascript
const dusa = new Dusa(`name is { "one", "two" }.`);
const iterator = dusa.solve();
console.log(iterator.next().value?.get('name')); // "one" or "two"
console.log(iterator.next().value?.get('name')); // "two" or "one"
console.log(iterator.next().value?.get('name')); // undefined
```

[Explore this example on val.town](https://www.val.town/v/robsimmons/solutions_with_next)

The iterator returned by `solve` has a couple of extra methods. Trying to
return the next solution is a process that could run forever; the `advance()`
method takes an optional argument `limit` and then will run at most `limit`
steps, returning `true` if `next()` can return without any extra computation.
The `stats()` method reports how much work has been done by the iterator so
far, and `all()` returns all remaining solutions as an array.

```javascript
advance(limit?: number): boolean;
stats(): { deductions: number; rejected: number; choices: number; nonPos: number };
all(): DusaSolution[];
```

### Using `for...of` loops

Dusa classes themselves are also `Iterable` — they implement the
`[Symbol.iterator]` method and so can be used in `for..of` loops:

```javascript
const dusa = new Dusa(`name is { "one", "two" }.`);
for (const solution of dusa) {
  console.log(solution.get('name'));
}
```

[Explore this example on val.town](https://www.val.town/v/robsimmons/solutions_enumerate)

Each time you invoke the iterator `dusa` is accessed, search is re-run,
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
