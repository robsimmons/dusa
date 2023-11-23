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

[Explore this example](https://dusa.rocks/#program=%23%20Graph%20reachability%0A%0Aedge%20a%20b.%20%23%20a%20%20%20f--k--j%0Aedge%20a%20c.%20%23%20%7C%20%5C%20%20%20%20%7C%20%0Aedge%20b%20c.%20%23%20b--c%20%20%20g%20%20h%0Aedge%20b%20d.%20%23%20%7C%20%20%7C%20%20%20%20%20%20%7C%0Aedge%20c%20e.%20%23%20d--e%20%20%20i--l%0Aedge%20d%20e.%0Aedge%20f%20k.%0Aedge%20g%20k.%0Aedge%20h%20l.%0Aedge%20i%20l.%0Aedge%20k%20j.%0Aedge%20Y%20X%20%3A-%20edge%20X%20Y.%0A%0Astart%20a.%0Areachable%20X%20%3A-%20start%20X.%0Areachable%20Y%20%3A-%0A%20%20%20%20reachable%20X%2C%0A%20%20%20%20edge%20X%20Y.)

## Graph coloring

A graph is three-colorable if every node can be assigned to one of three different
colors without giving two edge-connected node the same color.

### Functional propositions

Saying "every node can have one color: red, yellow, or blue" is Dusa's specialty!
That rule looks like this:

    color X is { red, yellow, blue } :- node X.

This rule means that if `node a` is present in a solution, that solution must also
include one of the following: `color a is red`, `color a is yellow`, or
`color a is blue`. Whereas `node _`, `edge _ _`, and `node _` are all **relational**
propositions, `color _ is _` is a **functional** proposition: the attribute `color a`
can be assigned at most one value by a database, and any solution that derived both
`color a is red` and `color a is blue` would be rejected.

The premise `node X` is important, because you can't have free variables in the
conclusion of a rule that aren't present in a premise. We can define the node relation
from the edge relation like this:

    node X :- edge X _.
    node X :- edge _ X.

(Because we defined the edge relation to be symmetric, either one of these rules will
do on its own, but nothing is wrong with both versions.)

### Forbid constraints

There are 12 nodes in our running example, and so there are 3<sup>12</sup> = 531441
different ways to assign three colors to those 12 nodes. But to show that the graph
is three-colorable, we need to reject any solutions where two edge-connected nodes
have the same color. We can do this with a `#forbid` constraint:

    #forbid edge X Y, color X is Color, color Y is Color.

If a prospective solution tries to give the color `red` to both nodes `a` and `b`,
then Dusa can assign `X` to `a`, assign `Y` to `b`, and `Color` to `red`, and
because `edge a b` exists, this will violate the forbid constraint and the solution
will be rejected.

### Making the graph un-colorable

Our example graph is three-colorable, but if we add two more edges:

    edge a d.
    edge c d.

then there are no solutions.

### Demand constraints

Constraints can work in the other direction as well. Because our graph has three
different connected components, it won't . If we _only_ want to accept
solutions where the nodes `a`, `f`, and `h` have the same color, we can enforce that
with a `#demand` constraint:

    #demand color a is Color, color f is Color, color h is Color.

[Explore this example](https://dusa.rocks/#program=%23%20Graph%20coloring%0A%0Aedge%20a%20b.%20%23%20a%20%20%20f--k--j%0Aedge%20a%20c.%20%23%20%7C%20%5C%20%20%20%20%7C%20%0Aedge%20b%20c.%20%23%20b--c%20%20%20g%20%20h%0Aedge%20b%20d.%20%23%20%7C%20%20%7C%20%20%20%20%20%20%7C%0Aedge%20c%20e.%20%23%20d--e%20%20%20i--l%0Aedge%20d%20e.%0Aedge%20f%20k.%0Aedge%20g%20k.%0Aedge%20h%20l.%0Aedge%20i%20l.%0Aedge%20k%20j.%0A%0Aedge%20Y%20X%20%3A-%20edge%20X%20Y.%0Anode%20X%20%3A-%20edge%20X%20_.%0Anode%20X%20%3A-%20edge%20_%20X.%0A%0Acolor%20X%20is%20%7B%20red%2C%20yellow%2C%20blue%20%7D%20%3A-%20node%20X.%0A%23forbid%20edge%20X%20Y%2C%20color%20X%20is%20Color%2C%20color%20Y%20is%20Color.%0A%23demand%20color%20a%20is%20Color%2C%20color%20f%20is%20Color%2C%20color%20h%20is%20Color.%0A%0A%23%20Adding%20these%20edges%20makes%20the%20problem%20unsolvable%0A%23%20edge%20a%20d.%0A%23%20edge%20c%20d.)

## Connected components

Speaking of connected components, we can use Dusa to calculate the connected components
of a graph. A common way to describe connected components and equivalence classes is to
assign a canonical representative for every node. Every element might be the
representative of its connected component: an arbitrary element is chosen as a leader
and then all connected nodes are assigned the same representative.

The fact that every element might be (but isn't necessarily) the representative of its
connected component can be captured by an **open** rule.

    representative X is { X? } :- node X.

This rule indicates that every node may be its own representative, but doesn't force
that decision. If only that rule is given, every node will be assigned as its own
representative.

If we add the reachability logic from our first example, it will force every node
in a connected component to have the same representative:

    representative Y is Rep :-
        edge X Y,
        representative X is Rep.

There are many different solutions, but they only differ in which node from a
connected component is arbitrarily chosen as the leader.

[Explore this example](https://dusa.rocks/#program=%23%20Connected%20component%0A%0Aedge%20a%20b.%20%23%20a%20%20%20f--k--j%0Aedge%20a%20c.%20%23%20%7C%20%5C%20%20%20%20%7C%20%0Aedge%20b%20c.%20%23%20b--c%20%20%20g%20%20h%0Aedge%20b%20d.%20%23%20%7C%20%20%7C%20%20%20%20%20%20%7C%0Aedge%20c%20e.%20%23%20d--e%20%20%20i--l%0Aedge%20d%20e.%0Aedge%20f%20k.%0Aedge%20g%20k.%0Aedge%20h%20l.%0Aedge%20i%20l.%0Aedge%20k%20j.%0A%0Aedge%20Y%20X%20%3A-%20edge%20X%20Y.%0Anode%20X%20%3A-%20edge%20X%20_.%0Anode%20X%20%3A-%20edge%20_%20X.%0A%0Arepresentative%20X%20is%20%7B%20X%3F%20%7D%20%3A-%20node%20X.%0Arepresentative%20Y%20is%20Rep%20%3A-%0A%20%20%20%20edge%20X%20Y%2C%0A%20%20%20%20representative%20X%20is%20Rep.)
