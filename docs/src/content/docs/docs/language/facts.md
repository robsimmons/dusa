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

## Using propositions like functions

- TODO add
