# Dusa Language

[![Coverage Status](https://coveralls.io/repos/github/robsimmons/dusa/badge.svg?branch=main)](https://coveralls.io/github/robsimmons/dusa?branch=main)

Dusa is a logic programming language that shares properties of Datalog (as implemented in systems like
[Soufflé](https://souffle-lang.github.io/program)) and Answer Set Programming (as implemented in systems
like [Potassco](https://potassco.org/)).

Dusa lives online at [dusa.rocks](https://dusa.rocks/).

# Quick start

## Introduction to Datalog

Datalog-like languages try to use logical implication to express the sorts of problems that, in a
language like SQL, you would solve with database joins. The simplest declarations in Dusa are just
declaring facts, like who a character's parent is.

    parent "Arya" "Catelyn".
    parent "Arya" "Eddard".
    parent "Brandon" "Rickard".
    parent "Eddard" "Lyarra".
    parent "Eddard" "Rickard".
    parent "Rickard" "Edwyle".
    parent "Rickard" "Marna".
    parent "Sansa" "Catelyn".
    parent "Sansa" "Eddard".

You can use these facts and logical implication to derive more facts, like "if X's parent is Y, and Y's
parent is Z, then the grandparent of X is Z." That looks like this:

    grandparent X Z :- parent X Y, parent Y Z.

It's also easy to have inferences that build on each other: an ancestor is either your parent or an
ancestor of your parent. In Dusa, that looks like this:

    ancestor X Y :- parent X Y.
    ancestor X Z :- parent X Y, ancestor Y Z.

Using these rules, Dusa will calculate all of Arya's ancestors: Catelyn, Eddard, Edwyle, Marna, and
Rickard.

## Propositions: relations and functions

The propositions in the previous section were all _relations_. Each of `parent`, `grandparent`,
and `ancestor` were relations between two characters.

It's also possible to have propositions that are functions.

- Relations look like this: `prop t1 t2 ... tn-1 tn`
- Functions look like this: `prop t1 t2 ... tn-1 is tn`

A function describes a unique key-value relationship. Familiar relationships don't work like that: Arya
has multiple parents and Eddard has multiple children. But we could use `weapon Char is W` as a
functional proposition to describe a character's favorite weapon.

    weapon "Arya" is "smallsword".
    weapon "Eddard" is "greatsword".
    weapon "Sansa" is "bow".

## Integrity constraints

Functional propositions create integrity constraints on the database of facts that Dusa maintains.
If these constraints are violated by saying that multiple keys map to the same value, then the database
is thrown out completely.

Consider trying to make `sibling` a functional proposition instead of a relational proposition in our
example, like this:

    sibling A is B :- parent A P, parent B P, A != B.

This will work initially, deriving that Arya and Sansa are siblings, as are Brandon and Eddard. But if
we then add a seemingly innoccuous additional fact...

    parent "Bran" "Eddard".

...then Dusa will report that there are no solutions. By trying to derive both `sibling "Arya" is
"Sansa"` and `sibling "Arya" is "Bran"`, the database failed an integrity constraint.

The takeway here is that we made a mistake: the `sibling` relationship should be a relation, not a
function.

Integrity constraints can also be added with the `#forbid` and `#demand` directives. If we want to
insist that no two characters have the same weapon, we can write.

    #forbid weapon Char1 is W, weapon Char2 is W, Char1 != Char2.

Note that it's necessary to say `Char1 != Char2`. If we left that out, Dusa could match both `Char1`
and `Char2` to `"Arya"` and therefore invalidate the database for violating an integrity constraint.

A `#demand` predicate expresses something that must be true in order for the database to be valid. This
can be used like an assertion in programming, invalidating the database if an expected fact doesn't
hold. If we want to make sure we derive Marna as an ancestor of Arya, we can write this:

    #demand ancestor "Arya" "Marna".

## Introduction to answer set programming

Answer set programming is a way of writing Datalog-like programs to compute acceptable models (answer
sets) that meet certain contraints. Whereas traditional Datalog aims to compute just one database (or
zero databases, if an integrity constraint fails), answer set programming allows different choices to
be made that let multiple possible databases diverge.

Dusa allows this kind of programming by supporting mutually exclusive assignments to a functional
predicate. Any assignment which satisfies all integrity constraints is a valid solution. (Answer set
programming calls them "answer sets" or "models," Dusa calls them "solutions," but they're the same
concept.)

If we have three suspects, Amy, Harry, and Sally, we can assign each of them guilt or
innocence with the following program:

    suspect amy.
    suspect harry.
    suspect sally.

    guilt Susp is { innocent, guilty } :- suspect Susp.

Dusa will, in no particular order, generate eight different solutions, corresponding to the two
different guilt assignments for the three suspects.

If we then add a constraint that only one suspect may be guilty...

    #forbid guilt Susp1 is guilty, guilt Susp2 is guilty, Susp1 != Susp2.

...Dusa will only be able to generate four solutions, one where each suspect is guilty and one where all
suspects are innocent. If we want someone to be guilty, which would limit us to three models, we can specify
that too:

    #demand guilt _ is guilty.

Answer set programming is sometimes compared to boolean satisfiability solving, and is sometimes
implemented with, general purpose satisfiablity solvers. We can also use Dusa as a pretty bad boolean
satisfibility solver, by assigning every proposition we come across the value `true` or `false`. The
[Wikipedia article describing a basic SAT-solving algorithm, DPLL](https://en.wikipedia.org/wiki/DPLL_algorithm),
uses as its example the following SAT instance:

    (a' + b  + c ) * (a  + c  + d ) *
    (a  + c  + d') * (a  + c' + d ) *
    (a  + c' + d') * (b' + c' + d ) *
    (a' + b  + c') * (a' + b' + c )

We can ask Dusa to solve this problem by negating all the OR-ed together clauses and making them
`#forbid` constraints.

    a is { true, false }.
    b is { true, false }.
    c is { true, false }.
    d is { true, false }.

    #forbid a is true, b is false, c is false.
    #forbid a is false, c is false, c is false.
    #forbid a is false, c is false, d is true.
    #forbid a is false, c is true, d is false.
    #forbid a is false, c is true, d is true.
    #forbid b is true, c is true, d is false.
    #forbid a is true, b is false, c is true.
    #forbid a is true, b is true, c is false.

# Language definition

## Lexical tokens

- A `<variable>` matches `/[A-Z][a-zA-Z0-9_]*/`
- A `<wildcard>` matches `/_[a-zA-Z0-9_]*/` and represents variable names that you wish to be ignored.
- An `<identifier>` matches `/[a-z][a-zA-Z0-9_]`
- A `<string-literal>` is a regular string constant with no escape characters: two double quotes `"`
  surrounding any ASCII character in the range 32-126 except for `"` and `\`.
- An `<int-literal>` matches `/0|-?[1-9][0-9]*/`

## Grammar

    <program>      ::= <declaration> <program> | ""
    <declaration>  ::= "#builtin" <builtin> <identifier> [ "." ]
                    |  "#demand" <premises> "."
                    |  "#forbid" <premises> "."
                    |  <conclusion> ":-" <premises> "."

    <premises>     ::= <premise> | <premise> "," <premises>
    <premise>      ::= <term> "!=" <term>
                    |  <term> "==" <term>
                    |  <attribute>
                    |  <attribute> "is" <term>

    <conclusion>   ::= <attribute>
                    |  <attribute> "is" <term>
                    |  <attribute> "is" "{" <options> "}"
    <conc-options> ::= <term> | <term> "?" | <conc-option> "," <conc-options>
    <conc-option>  ::- <term> | "?"

    <attribute>   ::= <identifier> | <identifier> <arguments>
    <arguments>   ::= <atomic-term> | <atomic-term> <arguments>
    <atomic-term> ::= <wildcard> | <variable>
                   |  <string-literal> | <int-literal>
                   |  <identifier> | <builtin-identifier>
                   |  "(" <term> ")"
    <term>        ::= <atomic-term>
                   |  <identifier> <arguments>
                   |  <builtin-identifier> <arguments>
    <builtin>     ::= "INT_PLUS" | "INT_MINUS"
                   |  "NAT_ZERO" | "NAT_SUCC"
                   |  "STRING_CONCAT"

## Built-in values and constructors

On their own, built-in numbers and strings act no different than random uninterpreted constants,
but they can be manipualted with special constructors added by `#builtin` declarations.

A `#builtin` declarations change the lexer to represent certain identifiers as operations on built-in
types. If you write

    #builtin INT_PLUS plus
    #builtin NAT_SUCC s

then the identifiers `plus` and `s` will be parsed as `<builtin-identifiers>` instead of as regular
identifiers until those built-ins are redefined.

- The `NAT_ZERO` builtin takes no arguments and represents the natural number zero.
- The `NAT_SUCC` builtin takes one natural number argument, and adds one to it. If `NAT_SUCC` is `s`,
  then the premise `s X == 0` will always fail, since `X` would have to be negative for that solution
  to work.
- The `INT_PLUS` builtin takes two or more integer arguments and adds them all.
- The `INT_MINUS` builtin takes two integer arguments and returns an integer, subtracting the second
  from the first.
- The `STRING_CONCAT` builtin takes two or more string arguments and concatenates them.
