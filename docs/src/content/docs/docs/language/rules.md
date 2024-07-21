---
title: Rules
---

The most important declarations in Dusa are rules. There are two types of
declarations, **open** and **closed**. Both kinds of rules involve a conclusion,
followed by the `:-` symbol, followed by some number of comma-separated premises.
(When a rule has no premises, the `:-` symbol is omitted.)

All the variables in the conclusion of a rule must appear in a premise.

## Premises

Premises to a rule can have the following form:

- `<attr>` or `<attr> is <value>`, where the value-free form is again shorthand for
  `<attr> is ()`. The attribute and value can both contain free variables.
- `<term> == <term>`, which is only satisfied if the two terms can be made equal.
  Both sides of the equation can contain variables, but all the variables on one side
  or the other must have been mentioned in a previous premise.
- `<term> != <term>`, which is only satisfied if the two terms cannot be made equal.
  Both sides of the equation can contain variables, but all the variables on one side
  must have been mentioned in a previous premise, and variables first mentioned in an
  inequality premise cannot be mentioned in subsequent premises or in the conclusion.

## Closed rules

An closed rule looks like this:

    <attribute> is { <value_1>, ..., <value_n> } :- <premises>.

but if `n` is 1, it can be written like this:

    <attribute> is <value_1> :- <premises>.

If the premises of a closed rule hold, Dusa must assign the attribute to one of the
listed values. If we've already given the attribute a value, then that attribute must
be one of the listed values, or else the solution will be invalidated.

### Closed rules describe intersections

This program has two solutions: one just containing `a is blue` and one just
containing `a is orange`:

    a is { blue, orange, red }.
    a is { blue, orange, green }.

The rules of forward chaining logic programming say that every rule that can fire must
fire, and this program has two rules that can fire. If we imagine the first rule
firing "first," it creates three possible consistent databases: the first just
containing `a is blue`, the second just containing `a is orange`, and the third just
containing `a is red`.

- In the first database, where `a is blue`, there's only one valid way for the first
  rule to fire again: choosing blue. Choosing orange or red will just invalidate the
  database. Therefore, we've gotten all the information we can get out of the first
  rule. The same is true for the second rule: choosing orange or green will invalidate
  the database, so we've gotten all the information we can out of the second rule.
- Analogously, in the second database where `a is orange`, there's only one valid way
  for either rule to fire.
- In the third database, where `a is red`, every way of firing the second rule
  invalidates the database. Because every rule that can fire must fire, this means
  that the second rule requires us to invalidate the database where `a is red`.

## Open rules

Open rules use the `is?` keyword instead of the `is` keyword in their conclusion.

    <attribute> is? <value> :- <premises>.

It's also possible to use curly braces to make an open rule with multiple values:

    <attribute> is? { <value_1>, ..., <value_n> } :- <premises>.

This rule is shorthand for writing the following `n` rules:

    <attribute> is? <value_1> :- <premises>.
    ...
    <attribute> is? <value_n> :- <premises>.

If all premises of an open rule hold, then Dusa will try to evaluate the program
further with each of the listed attributes, but will **also** leave open the option
that some other chain of reasoning might assign some different value to the attribute.

    color is { brown, blue }.
    species is? { dolphin, fish }.
    species is? bear :- color is brown.

When evaluating the first rule, the color must be blue or brown: no other possibility
is allowed when dealing with a closed rule. When evaluating the second rule, however,
there are three possibilities: the species is dolphin, the species is fish, and the
species might be determined later by some other chain of reasoning.
And indeed, the third rule allows us to derive that the species is potentially `bear`
if the color is brown.

The program has five total solutions:

- `color is brown`, `species is dolphin`
- `color is brown`, `species is fish`
- `color is blue`, `species is dolphin`
- `color is blue`, `species is fish`
- `color is brown`, `species is bear`

If we'd made the conclusion of the last rule `species is { bear }` --- or,
equivalently, `species is bear` --- it would require that when the color is brown, the
species is bear, invalidating the brown+dolphin and brown+fish solutions. By leaving
the third rule open, it didn't invalidate solutions where a different chain of
reasoning had assigned a different species.

[Explore this example](https://dusa.rocks/#jsonz=ZYy7DcMwDAVXeWBaJQO4yQhewI0lMbAAmRT0QQrDu4dOkSZ43d3DHdRpIi0s5ChqGDvLRW6YjaGOzIi8q7Re155UFlvQrBWp4YDPgx181bfgfCzSCofEzeTTbNRctiQOr9S2P-95rZju-OW-GTvR-QE)

### Open rules describe unions

The following programs all have exactly 3 solutions: `a is 1`, `a is 2`, and `a is 3`.

**Program 1**

    a is? { 1, 2, 3 }.

**Program 2**

    a is? 1.
    a is? 2.
    a is? 3.

**Program 3**

    a is? { 1, 2 }.
    a is? { 2, 3 }.

Because open rules don't preclude other consistent assignments, the possible
assignments are the union of the different assignments proposed by different open
rules.

### Open rules for picking from a different relation

A common pattern in Dusa is having closed rules where the domain of the rule gets
repeated:

    nameOf hero is { "Celeste", "Nimbus", "Luna", "Terra" }.
    nameOf sidekick is { "Celeste", "Nimbus", "Luna", "Terra" }.
    nameOf villain is { "Celeste", "Nimbus", "Luna", "Terra" }.

Instead of having to repeat the list of names every time, it's desirable to have
one relation describe the possible names. Using a closed rule will not work:

    name "Celeste".
    name "Nimbus".
    name "Luna".
    name "Terra".

    nameOf hero is { Name } :- name Name.

This program will try to force mutually contradictory names on the hero! That program
is equivalent to this one, which similarly has no solutions:

    nameOf hero is "Celeste".
    nameOf hero is "Nimbus".
    nameOf hero is "Luna".
    nameOf hero is "Terra".

Forcing incompatible names on the hero, as the last two programs did, will invalidate
the database and prevent there from being any solutions.

Using an open rule does allow us to separate the set of names from their assignment to
characters:

    name "Celeste".
    name "Nimbus".
    name "Luna".
    name "Terra".

    nameOf hero is? Name :- name Name.
    nameOf sidekick is? Name :- name Name.
    nameOf villain is? Name :- name Name.

The rules above allow for any of the valid names to be given to each character, but
also provide for the possibility that a different name will get assigned to the
character.

### Open rules don't provide extra information

When Dusa considers the "question mark path" of a derivation, it does **not** treat
the attribute as if it has some value that's not yet determined; instead, it treats
the open rule as if it hasn't ever fired. To see why this matters, consider the
following program:

    a is? { 1, 2 }.
    b :- a is _.
    a is? 3 :- b.

Procedurally, Dusa must follow three chains of logic. In the first chain of logic,
Dusa derives `a is 1` as a fact, uses that to further derive `b`, and then considers
the third rule, which opens up the possibility that `a is 3`, but this cannot be
derived as it would conflict with the fact `a is 1`. In the second chain of logic,
Dusa does the same thing, but for `a is 2`.

In the final chain, if we acted like `a is ?` was true for an as-yet-unknown value,
we'd be able to use that fact to derive `b` with the second rule and then `a is 3`
with the third rule. That is **not** how Dusa works. In actuality, the third chain of
reasoning will be rejected, because no subsequent reasoning will derive any knowledge
about the value assigned to the attribute `a`.
