---
title: Facts
---

A solution to a Dusa program consists of a set of propositions that have no free
variables: we call propositions with no free variables **facts**.

## Relational propositions

A relational proposition is a predicate followed by any number of terms. The
proposition `edge a b` treats `edge` as a two-place relation, and the proposition
`node c` treats `node` as a one-place relation.

## Functional propositions

Dusa also utilizes functional propositions, which consist of an attribute (a predicate
plus zero or more terms) and a value (a single term). The predicate plus its terms is
called an **attribute**, and every attribute must have at most one value: deriving
both `attr is a` and `attr is b` will result in the solution being invalidated for
failing an integrity constraint.

## Everything's secretly functional

When we don't write an attribute, that's just syntactic sugar for saying that the
attribute's value is actually `()`, a special term that is pronounced "unit." So the
program

    edge Y X :- edge X Y.
    path X Y :- edge X Y.
    path X Z :- edge X Y, path Y Z.

program above is shorthand for this program:

    edge Y X is () :- edge X Y is ().
    path X Y is () :- edge X Y is ().
    path X Z is () :- edge X Y is (), path Y Z is ().
