---
title: Built-in relations
---

* TODO FIX: add (in)equality
* TODO FIX: update with relational interpretation

On their own, built-in numbers and strings act no different than other uninterpreted
constants, but they can be manipulated with special relations added by `#builtin`
declarations.

A `#builtin` declarations connects a certain identifiers to a certain built-in
relation. If you write

    #builtin INT_PLUS plus
    #builtin NAT_SUCC s

then the identifiers `plus` and `s` will be treated, throughout the program, as a
built-in definition instead of as a regular identifier.

- The `NAT_ZERO` builtin takes no arguments and represents the natural number zero.
- The `NAT_SUCC` builtin takes one natural number argument, and adds one to it. If
  `NAT_SUCC` is `s`, then the premise `s X == 0` will always fail, since `X` would
  have to be negative for that solution to work.
- The `INT_PLUS` builtin takes two or more integer arguments and adds them all.
- The `INT_MINUS` builtin takes two integer arguments and returns an integer,
  subtracting the second from the first.
- The `STRING_CONCAT` builtin takes two or more string arguments and concatenates them.

## How built-in relations work

All built-in relations
