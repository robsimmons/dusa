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

Note that this if-then statement is written backwards from how it's written in English:
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

[Explore this example](https://dusa.rocks/#jsonz=VY9JDoMwDEWv8hW2mAP0Ar0CSNlkMHMDonRRtb17ExKglSL56T_bil9iFRcxzexELuxkHjd2IclwXdTcYmFlWqW7sVuf0knHtmEo6AKZL0BNNBD1hzBBvCGld6HGXMdcExkfN0B7CBsHwttGkjDgICwR-7QjGpOwXiSsMezYnNhi3LE7cUC_Y4USF8LGJaoinHVf1bJCeU4Hjxy7oij_ROWFdOG3P815TI6t4vMF)

## Graph coloring

A graph is three-colorable if every node can be assigned to one of three different
colors without giving two edge-connected node the same color.

### Functional propositions

Saying "every node can have one color: red, yellow, or blue" is Dusa's specialty!
That rule looks like this:

    color X is { red, yellow, blue } :- node X.

This rule means that if `node a` is present in a solution, that solution must also
include one of the following: `color a is red`, `color a is yellow`, or
`color a is blue`. Whereas `node _`, `edge _ _`, and `node _` are **relational**
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

Say that prospective solution tries to give the color `red` to both nodes `a` and `b`,
then Dusa can assign `X` to `a`, assign `Y` to `b`, and `Color` to `red` in the rule above. Because `edge a b` exists, all the parts of the `#forbid` constraint are satisfied, so the solution will be rejected.

### Making the graph un-colorable

Our example graph is three-colorable, but if we add two more edges:

    edge a d.
    edge c d.

then there are no solutions.

### Demand constraints

Constraints can work in the other direction as well. Because our graph has three
different connected components, and the nodes `a`, `f`, and `h` are in different
connected components, the color `a` doesn't affect the color of `f` and so on.
It might be desirable to say that these three nodes must all have the same color
in order to reduce the number of redundant solutions. We could enforce that
with a `#demand` constraint:

    #demand color a is Color, color f is Color, color h is Color.

This constraint says that concrete node values `a`, `f`, and `h` all have to
have the same color, but because `Color` is a variable, the constraint doesn't
say anything about _what_ that color has to be.

[Explore this example](https://dusa.rocks/#jsonz=ZZFbboMwEEW3cgW_mAXkr-pHtwASUoQ9wyMYO4KQqkqz9455JRUSwtfn-NoIP6JbdIr8lV2UROTN1LMLJMbXUF4bGG_90Lq6cIVjqhkldIpYBqBSqlPqsgsTxC-KQlwYF64XrpUygmug2QUthfDMlVUYcBCkFAttlbKrIBFrrNBtsX7FBnaL7St2uKT79-fIcFKYc4ZchPPE_-D5CM_I5i3m3yG8HfHAwJTgh6313wm0nRjPUFiqsjyu_KBb2s9K8Fb_DHEj-U5CjbgvHa2qPCyuDqR5r8sG-CCSO8Ot4ZHn40f0ZSdvIbgOXlvuMbnR23spOVTWO6R0nxiZRM8_)

## Connected components

We can also use Dusa to calculate the connected components
of a graph. A common way to describe connected components and equivalence classes is to
assign a canonical representative for every node. Every element might be the
representative of its connected component: an arbitrary element is chosen as a leader
and then all connected nodes are assigned the same representative.

The fact that every element might be (but isn't necessarily) the representative of its
connected component can be captured by an **open** rule.

    representative X is? X :- node X.

This rule indicates that every node **may** be its own representative, but doesn't force
that decision if another rule provides a contradictory assignment.

If only that rule is given, every node will be assigned as its own
representative.
If we add the reachability logic from our first example, it will force every node
in a connected component to have the same representative:

    representative Y is Rep :-
        edge X Y,
        representative X is Rep.

There are many different solutions, but they only differ in which node from a
connected component is arbitrarily chosen as the leader.

[Explore this example](https://dusa.rocks/#jsonz=bZBNDoIwEIWv8lK3Dgdw48IbuIKkiZF2RESnRNCNenenFDBGkybz-r4305-H6c3KhJbFLI0P7nZhic4CmyDCrmcPFy5tEPWtWGFfMfYoMyy0AAeihug0AxfBE9YqizX5ZfJLIqd2BRxn4FNDXEPLCBw4Ak_E6tZE5xF4BaM8oJlk9ZFHnCdZf2SDUzbfv0COFWHQOQoFEjx_mbtfc4d8GHHl9sqd_se-r-8xUHfrFEsN2U-k0Ai23GrGSnzldPIybf9MjPHMvN4)
