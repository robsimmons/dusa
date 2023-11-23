---
title: Dusa is a graph exploration language
description: Using Dusa to describe and explore graphs.
---

Graph structures are pretty common in computer science, and Dusa is a pretty good
language for working with graphs. A lot of problems that would be solved in an
imperative or functional language by yet another implementation of depth-first search
can be described in just a line or two of Dusa.

## Describing graphs

Consider the following graph, lovingly rendered with ASCII graphics:

    a   f--k--j
    | \    |
    b--c   g  h
    |  |      |
    d--e   i--l

We can describe the edges in this graph as a bunch of facts in Dusa:

    edge a b.
    edge a c.
    edge b c.
    edge b d.
    edge c e.
    edge d e.
    edge f k.
    edge g k.
    edge h l.
    edge i l.
    edge k j.

We call `edge` a predicate, and say that it takes two arguments or, equivalently, that
it defines a two-place relation. A fact `edge a b` is also sometimes called a
**proposition**. Dusa deals in propositions.

We can use variables, which start with upper case letters, to talk about edges more
generically. Our illustration indicated that the graph was undirected, so we probably
want there to be an `edge b a` as well as `edge a b`. Instead of writing out eleven
more facts, we can say that for every edge, there's an edge in the opposite direction.

As an if-then statement, we could write "for all `X` and `Y`, if `edge X Y` then
`edge Y X`.

    edge Y X :- edge X Y.

Note that this if-thin statement is written backwards from how it's written in English:
the "then" part, the **conclusion** is written first, followed by the `:-` symbol.
After the `:-` symbol is **premises**. (There can be more than one premise. If there
aren't any premises we're just defining a fact, so we don't write the `:-` symbol at
all.)

## Graph reachability

Lots of problems boil down to needing to know all the points in a graph that are
connected to a given node by one or more edges. For example, liveness analysis in a
compiler can be treated as a graph reachability problem where nodes are lines of code.

A node in a graph is reachable from a starting node if it is that starting node, or if
it's connected to another reachable node by an edge. That logic can be captured in
Dusa with two rules and a fact:

    start a.
    reachable X :- start X.
    reachable Y :-
        reachable X,
        edge X Y.

[Explore this example](https://dusa.rocks/#program=%23%20Graph%20reachability%0A%0Aedge%20a%20b.%20%23%20a%20%20%20f--k--j%0Aedge%20a%20c.%20%23%20%7C%20%5C%20%20%20%20%7C%20%0Aedge%20b%20c.%20%23%20b--c%20%20%20g%20%20h%0Aedge%20b%20d.%20%23%20%7C%20%20%7C%20%20%20%20%20%20%7C%0Aedge%20c%20e.%20%23%20d--e%20%20%20i--j%0Aedge%20d%20e.%0Aedge%20f%20k.%0Aedge%20g%20k.%0Aedge%20h%20j.%0Aedge%20i%20j.%0Aedge%20j%20k.%0Aedge%20Y%20X%20%3A-%20edge%20X%20Y.%0A%0Astart%20a.%0Areachable%20X%20%3A-%20start%20X.%0Areachable%20Y%20%3A-%0A%20%20%20%20reachable%20X%2C%0A%20%20%20%20edge%20X%20Y.)

## Connected components

If we want to know all the information about what edges are connected to other edges,

## Creating random graphs
