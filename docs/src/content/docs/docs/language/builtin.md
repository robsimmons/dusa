---
title: Built-in functions
---

On their own, built-in numbers and strings act no different than other uninterpreted
constants, but they can be manipualted with special constructors added by `#builtin`
declarations.

A `#builtin` declarations change the lexer to represent certain identifiers as
operations on built-in types. If you write

    #builtin INT_PLUS plus
    #builtin NAT_SUCC s

then the identifiers `plus` and `s` will be parsed as a built-in definition instead
of as a regular identifiers until those built-ins are redefined.

- The `NAT_ZERO` builtin takes no arguments and represents the natural number zero.
- The `NAT_SUCC` builtin takes one natural number argument, and adds one to it. If
  `NAT_SUCC` is `s`, then the premise `s X == 0` will always fail, since `X` would
  have to be negative for that solution to work.
- The `INT_PLUS` builtin takes two or more integer arguments and adds them all.
- The `INT_MINUS` builtin takes two integer arguments and returns an integer,
  subtracting the second from the first.
- The `STRING_CONCAT` builtin takes two or more string arguments and concatenates them.
