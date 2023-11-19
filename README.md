# Dusa Language

Dusa is a logic programming language that shares properties of Datalog (as implemented in systems like
[Soufflé](https://souffle-lang.github.io/program)) and Answer Set Programming (as implemented in systems
like [Potassco](https://potassco.org/)).

[![Build status](https://builds.sr.ht/~robsimmons/dusa.svg)](https://builds.sr.ht/~robsimmons/dusa?)
[![Coverage Status](https://coveralls.io/repos/github/robsimmons/dusa/badge.svg?branch=main)](https://coveralls.io/github/robsimmons/dusa?branch=main)
[![NPM Module](https://img.shields.io/npm/v/dusa.svg)](https://www.npmjs.com/package/dusa)

Dusa lives online at [dusa.rocks](https://dusa.rocks/).

# Quick start

## Introduction to Datalog

Datalog-like languages use logical implication to express the sorts of problems that, in a language like
SQL, you would solve with database joins. The simplest declarations in Dusa are just declaring facts, like
who a character's parent is.

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

It's also possible to have propositions that are _functions_.

- Relations look like this: `prop t1 t2 ... tn-1 tn`
- Functions look like this: `prop t1 t2 ... tn-1 is tn` (`is` is a keyword)

A function describes a unique key-value relationship. Familiar relationships don't work like that: Arya
has multiple parents and Eddard has multiple children. But we could use `weapon Char is W` as a
functional proposition to describe a character's favorite weapon, if each character can have at most one
favorite weapon.

    weapon "Arya" is "smallsword".
    weapon "Eddard" is "greatsword".
    weapon "Sansa" is "bow".

## Integrity constraints

Functional propositions create integrity constraints on the database of facts that Dusa maintains.
If these constraints are violated by saying that multiple keys map to the same value, then the database
is thrown out completely.

If we try to give Arya two favorite weapons, for instance, the database will be invalidated for violating
an integrity constraint.

    weapon "Arya" is "smallsword".
    weapon "Arya" is "greatsword".

For a more subtle example, consider trying to make `sibling` a functional proposition instead of a
relational proposition, like this:

    sibling A is B :- parent A P, parent B P, A != B.

This will work initially, deriving that Arya and Sansa are siblings, as are Brandon and Eddard. But if
we then add a seemingly innoccuous additional fact...

    parent "Bran" "Eddard".

...then Dusa will throw out the database in its entirety, reporting that there are no solutions. By
deriving both `sibling "Arya" is "Sansa"` and `sibling "Arya" is "Bran"`, the database failed an integrity
constraint and was completely invalidated.

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

Dusa allows choices by supporting mutually exclusive assignments to a functional predicate. Any assignment
which satisfies all integrity constraints is a valid solution. (Answer set programming calls them "answer
sets" or "models," Dusa calls them "solutions," but they're the same concept.)

If we have three suspects, Amy, Harry, and Sally, we can assign each of them guilt or innocence with the
following program:

    suspect amy.
    suspect harry.
    suspect sally.

    guilt Susp is { innocent, guilty } :- suspect Susp.

Dusa will, in no particular order, generate eight different solutions, corresponding to the two
different guilt assignments for the three suspects.

If we then add a constraint that only one suspect may be guilty...

    #forbid guilt Susp1 is guilty, guilt Susp2 is guilty, Susp1 != Susp2.

...Dusa will only be able to generate four solutions, one where each suspect is guilty and one where all
suspects are innocent. If we want someone to be guilty, which would limit us to three models, we can
specify that too:

    #demand guilt _ is guilty.

Answer set programming is sometimes compared to boolean satisfiability solving, and is sometimes
implemented with general purpose boolean satisfiablity solvers. We can use Dusa as a (pretty bad) boolean
satisfibility solver,by assigning every proposition we come across the value `true` or `false`. The
[Wikipedia article describing a basic SAT-solving algorithm,
DPLL](https://en.wikipedia.org/wiki/DPLL_algorithm), uses as its example the following SAT instance:

    (a' + b  + c ) * (a  + c  + d ) *
    (a  + c  + d') * (a  + c' + d ) *
    (a  + c' + d') * (b' + c' + d ) *
    (a' + b  + c') * (a' + b' + c )

We can ask Dusa to solve this problem by negating each the OR-ed together clauses and making each one
a `#forbid` constraint. (Needing one of the literals in a clause to hold is the same as needing
all of the negations to hold.)

    a is { true, false }.
    b is { true, false }.
    c is { true, false }.
    d is { true, false }.

    #forbid a is true,  b is false, c is false.
    #forbid a is false, c is false, c is false.
    #forbid a is false, c is false, d is true.
    #forbid a is false, c is true,  d is false.
    #forbid a is false, c is true,  d is true.
    #forbid b is true,  c is true,  d is false.
    #forbid a is true,  b is false, c is true.
    #forbid a is true,  b is true,  c is false.

# Language definition

A Dusa program is a sequence of declarations. This program has 2 declarations, and we read it as saying
that `a` is immediately provable and that `a` implies `b`.

    # a pound sign followed by a space is a line comment
    a.
    b :- a.

## Terms

Most declarations in Dusa contain terms. Numbers, strings, and constructors are all terms. When you write
`edge a b` in Dusa, both `a` and `b` get treated as constructors that take no arguments (we'll usually
call these "constants.")

## Attributes and values

A fact in Dusa always consists of an attribute --- a predicate plus zero or more terms --- and a value ---
a single term. The predicate plus its terms is called an **attribute**, and every attribute must have at
most one value: deriving both `attr is a` and `attr is b` will result in the database being invalidated
for failing an integrity constraint.

When we don't write an attribute, that's just syntactic sugar for saying that the attribute's value is
actually `()`, a special term that is pronounced "unit." So our program above is actually shorthand
for writing this:

    a is ().
    b is () :- a is ().

## Closed rules

The most important declarations in Dusa are rules. There are two types of declarations, **open** and
**closed**. An closed rule looks like this:

    <attribute> is { <value1>, ..., <valuen> } :- <premises>.

and it means that, if the premises hold, Dusa must assign the attribute to one of the listed values.
(If we've already given the attribute a value, then that attribute must be one of the listed values,
or else the database will be invalidated.)

It's quite common that we want, as the conclusion of a rule, to assign one specific value to an attribute.
In that case, we don't need to write the curly braces. This program:

    p is 1.
    q is { 2, 3 }.

is syntactic sugar for theis program:

    p is { 1 }.
    q is { 2, 3 }.

That means that our example from before:

    a is ().
    b is () :- a is ().

is, in its fully expanded form, written like this:

    a is { () }.
    b is { () } :- a is ().

### Closed rules are create intersections

This program has two solutions: one just containing `a is blue` and one just containing `a is orange`:

    a is { blue, orange, red }.
    a is { blue, orange, green }.

The rules of forward chaining logic programming say that every rule that can fire must fire, and this
program has two rules that can fire. If we imagine the first rule firing "first," it creates three possible
consistent databases: the first just containing `a is blue`, the second just containing `a is orange`, and
the third just containing `a is red`.

- In the first database, where `a is blue`, there's only one valid way for the first rule to fire
  again: choosing blue. Choosing orange or red will just invalidate the database. Therefore, we've gotten
  all the information we can get out of the first rule. The same is true for the second rule: choosing
  orange or green will invalidate the database, so we've gotten all the information we can out of the
  second rule.
- Analagously, in the second database where `a is orange`, there's only one valid way for either rule to
  fire.
- In the third database, where `a is red`, every way of firing the second rule invalidates the database.
  Because every rule that can fire must fire, this means that the second rule requires us to invalidate
  the database where `a is red`.

## Open rules

Open rules include a question mark after the last choice.

    a is { 1, 2? } :- b..

If all premises of an open rule hold, then Dusa will try to evaluate the program further with each of the
listed attributes, but will **also** leave open the option that some other chain of reasoning might assign
some different value to the attribute.

    color is { brown, blue }.
    species is { dolphin, fish? }.
    species is { bear? } :- color is brown.

When evaluating the first rule, the color must be blue or brown: no other possibility is allowed when
dealing with a closed rule. When evaluating the second rule, however, there are three possibilities:
the species is dolphin, the species is fish, and the species might be determined later by some other
chain of reasoning if we don't commit. And indeed, the third rule allows us to derive that the species
is potentially bear if the color is brown.

The program has five total solutions:

- `color is brown`, `species is dolphin`
- `color is brown`, `species is fish`
- `color is blue`, `species is dolphin`
- `color is blue`, `species is fish`
- `color is brown`, `species is bear`

If we'd made the conclusion of the last rule `species is { bear }` --- or, equivalently, `species is bear`
--- it would require that when the color is brown, the species is bear, invalidating the brown+dolphin and
brown+fish solutions. By leaving the third rule open, it didn't invalidate solutions where a different
chain of reasoning had assigned a different species.

### Open rules create unions

The following programs all have exactly 3 solutions: `a is 1`, `a is 2`, and `a is 3`.

Program 1

    a is { 1, 2, 3? }.

Program 2

    a is { 1? }.
    a is { 2? }.
    a is { 3? }.

Program 3

    a is { 1, 2? }.
    a is { 2, 3? }.

Because open rules don't preclude other consistent assignments, the possible assignments are the union
of the different assignments proposed by different open rules.

### Open rules for picking from a different relation

A common pattern in Dusa is having closed rules where the domain of the rule gets repeated:

    nameOf hero is { "Celeste", "Nimbus", "Luna", "Terra" }.
    nameOf sidekick is { "Celeste", "Nimbus", "Luna", "Terra" }.
    nameOf villian is { "Celeste", "Nimbus", "Luna", "Terra" }.

Instead of having to repeat the list of names every time, it's desirable to have one relation describe
the possible names. Using a closed rule will not work:

    name "Celeste".
    name "Nimbus".
    name "Luna".
    name "Terra".

    nameOf hero is { Name } :- name Name.

This program will try to force mutually contradictory names on the hero! That program is equivalent to
this one, which similarly has no solutions:

    nameOf hero is "Celeste".
    nameOf hero is "Nimbus".
    nameOf hero is "Luna".
    nameOf hero is "Terra".

Forcing incompatible names on the hero, as the last two programs did, will invalidate the database
and prevent there from being any solutions.

Using an open rule does allow us to separate the set of names from their assignment to characters:

    name "Celeste".
    name "Nimbus".
    name "Luna".
    name "Terra".

    nameOf hero is { Name? } :- name Name.
    nameOf sidekick is { Name? } :- name Name.
    nameOf villian is { Name? } :- name Name.

The rules above allow for any of the valid names to be given to each character, but also provide for the
possibility that a different name will get assigned to the character.

### Open rules don't provide extra information

When Dusa considers the "question mark path" of a derivation, it does **not** treat the attribute
as if it has some value that's not yet determined; instead, it treats the open rule as if it hasn't ever
fired. To see why this matters, consider the following program:

    a is { 1, 2? }.
    b :- a is _.
    a is { 3? } :- b.

Procedurally, Dusa must follow three chains of logic. In the first chain of logic, Dusa derives `a is 1` as
a fact, uses that to further derive `b`, and then considers the third rule, which opens up the possibility
that `a is 3`, but this cannot be derived as it would conflict with the fact `a is 1`. In the second chain
of logic, Dusa does the same thing, but for `a is 2`.

In the final chain, if we acted like `a is ?` was true for an as-yet-unknown value, we'd be able to use
that fact to derive `b` with the second rule and then `a is 3` with the third rule. That is **not** how
Dusa works. In actuality, the third chain of reasoning will be rejected, because no subsequent reasoning
will derive any no knowledge about the value assigned to the attribute `a`.

## Variables

Rules in Dusa may contain logic variables, which start with uppercase letters. The following
rule says the `edge` relation is symmetric:

    edge X Y :- edge Y X.

If we have the fact `edge a b`, this rule will allow us to match `Y = a` and `X = b` in the premise,
and then use the rule to derive the fact `edge b a`.

Each variable can only be assigned one value. This rule:

    self X :- edge X X.

cannot make use of the fact `edge a b`, because there's no way to assign `X = a` and `X = b` simultaneously. However, if we have the fact `edge c c`, then we can match `X = c` and derive
the fact `self c` using this rule.

All the variables in the conclusion of a rule must appear in the premises.

You can use and reuse the wildcard `_` in place of a variable you don't care about. `edge _ _` will
match the fact `edge a b` and also the fact `edge c c`.

If you don't care about a variable's value,
you can precede the variable name with a wildcard: `edge _Left _Right` treats the variables
`_Left` and `_Right` like wildcards. A wildcard with a given name can only appear once in a rule,
and the only purpose of the wildcard is documentation.

## Premises

Premises to a rule can have the following form:

- `<attr>` or `<attr> is <value>`, where the value-free form is again shorthand for `<attr> is ()`.
  The attribute and value can both contain free variables.
- `<term> == <term>`, which is only satisfied if the two terms can be made equal. Both sides of the
  equation can contain variables, but all the variables on one side must have
  been mentioned in a previous premise.
- `<term> != <term>`, which is only satisfied if the two terms cannot be made equal. Both sides of the
  equation can contain variables, but all the variables on one side must have
  been mentioned in a previous premise, and variables first mentioned in an inequality premise
  cannot be mentioned in subsequent premises or the conclusion.

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

## Constraint declarations

Besides rules and `#builtin` declarations, it's possible to add constraints about the shape
of a solution.

    #forbid <premises>.
    #demand <premises>.

If all the premises to any `#forbid` declaration can be simutaeously satisfied, the database
is invalidaed.

Conversely, an ostensible solution will be invalidated unless all the premises to every `#demand`
declaration can be simultaneously satisfied.

## Syntax and grammar specification

The syntax of Dusa is not whitespace-sensitive, and comments, which begin with a pound sign followed
by a space or end of line and continue to the end of the line, are treated like whitespace.

- A `<variable>` matches `/[A-Z][a-zA-Z0-9_]*/`
- A `<wildcard>` matches `/_[a-zA-Z0-9_]*/` and represents variable names that you wish to be ignored.
- An `<identifier>` matches `/[a-z][a-zA-Z0-9_]*/`
- A `<string-literal>` is a regular string constant with no escape characters: two double quotes `"`
  surrounding any ASCII character in the range 32-126 except for `"` and `\`.
- An `<int-literal>` matches `/0|-?[1-9][0-9]*/`

The grammar of Dusa programs is as follows

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
