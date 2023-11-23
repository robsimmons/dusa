---
title: Terms
---

Most declarations in Dusa contain terms. Numbers, strings, and constructors are all
terms. When you write `edge a b` in Dusa, both `a` and `b` get treated as constructors
that take no arguments (we'll usually call these "constants.")

## Variables

Rules in Dusa may contain logic variables, which start with uppercase letters.
The following rule says the `edge` relation is symmetric:

    edge X Y :- edge Y X.

If we have the fact `edge a b`, this rule will allow us to match `Y = a` and
`X = b` in the premise, and then use the rule to derive the fact `edge b a`.

Each variable can only be assigned one value. This rule:

    self X :- edge X X.

cannot make use of the fact `edge a b`, because there's no way to assign `X = a` and
`X = b` simultaneously. However, if we have the fact `edge c c`, then we can match
`X = c` and derive the fact `self c` using this rule.

All the variables in the conclusion of a rule must appear in the premises.

## Wildcards

You can use and reuse the wildcard `_` in place of a variable you don't care about.
`edge _ _` will match the fact `edge a b` and also the fact `edge c c`.

If you don't care about a variable's value, you can precede the variable name with a
wildcard: `edge _Left _Right` treats the variables `_Left` and `_Right` like
wildcards. A wildcard with a given name can only appear once in a rule. The only
purpose for naming a wildcard is documentation and readability.

## Attributes and values

A fact in Dusa always consists of an attribute (a predicate plus zero or more terms)
and a value (a single term). The predicate plus its terms is called an **attribute**,
and every attribute must have at most one value: deriving both `attr is a` and
`attr is b` will result in the database being invalidated for failing an integrity
constraint.

When we don't write an attribute, that's just syntactic sugar for saying that the
attribute's value is actually `()`, a special term that is pronounced "unit." So the
program

    edge Y X :- edge X Y.
    path X Y :- edge X Y.
    path X Z :- edge X Y, path Y Z.

program above is shorthand for this program:

    edge Y X is () :- edge X Y.
    path X Y is () :- edge X Y.
    path X Z is () :- edge X Y, path Y Z.
