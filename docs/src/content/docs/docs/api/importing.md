---
title: Using Dusa in your JavaScript programs
---

As Julia Evans describes, in 2024
[there are basically three ways use JavaScript code in your project](https://jvns.ca/blog/2024/11/18/how-to-import-a-javascript-library/).

1. A "classic" module that just defines a global variable
2. An ES module
3. Use a build system

### Classic modules

To use Dusa in your random web page, include the UMD module in a script tag in
the head of your file, for example with unpkg like this:

<!-- https://www.srihash.org/ for updating this when the package bumps -->

```html
<script src="https://unpkg.com/dusa@0.1.6" integrity="sha384-dQ1a/faivdqPhpQcxYG+tCkmln6OAQAi5gccaliGtbeOcGFGgXlsLuSKl+h8Jp8r" crossorigin="anonymous"></script>
```

or with jsdelivr like this:

```html
<script src="https://cdn.jsdelivr.net/npm/dusa@0.1.6" integrity="sha384-rz5oQihX+60VISoW9hKtiHrEU11ydb3dfTN93lQEAIx0XwNOEfR3z3jFaYieGfrp" crossorigin="anonymous"></script>
```

This defines the `Dusa` name, which can be used to make new Dusa classes or
access the various [helpers](/docs/api/helpers/).

```javascript
const dusa = new Dusa('fact is { mortal socrates, man socrates }.');
function handleClick() {
  const fact = Dusa.termToString(dusa.sample().get('fact'));
  document.getElementById('facts').innerText = fact;
}
```

- [Example 1: Glitch site](https://glitch.com/edit/#!/dusa-use-umd)
- [Example 2: p5js sketch](https://editor.p5js.org/robsimmons/sketches/xcHwiBh2H)

### ES modules

ES modules can be used to access the [`Dusa` class](/docs/api/dusa/) and the
[helpers](/docs/api/helpers/) in any development using ES modules, without
requiring any build system.

```javascript
import { Dusa, termToString } from 'https://unpkg.com/dusa@0.1.6/lib/client.js';
const dusa = new Dusa('fact is { mortal socrates, man socrates }.');
console.log(termToString(dusa.solution.get('fact')));
```

The val.town examples used elsewhere in the docs use this way of importing
Dusa. [Here's the example above on val.town](https://www.val.town/v/robsimmons/fieryPlumLeopon).

### Build system imports

If import `dusa` through NPM (or a similar package manager/build system), then
you can import the [core `Dusa` class](/docs/api/dusa/) as well as the
[helpers](/docs/api/helpers/) through the `'dusa'` import.

```javascript
// example.mjs
import { Dusa, termToString } from 'dusa';
const dusa = new Dusa('fact is { mortal socrates, man socrates }.');
console.log(termToString(dusa.solution.get('fact')));
```

```javascript
// example.cjs
const { Dusa, termToString } = require('dusa');
const dusa = new Dusa('fact is { mortal socrates, man socrates }.');
console.log(termToString(dusa.solution.get('fact')));
```
