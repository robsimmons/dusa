---
title: Dusa is datalog
description: Introducing Dusa usage for Datalog programmers.
---

Datalog-like languages use logical implication to express the sorts of problems
that, in a language like SQL, you would solve with database joins. The simplest
declarations in Dusa are just declaring facts, like who a character's parent is.

    parent "Arya" "Catelyn".
    parent "Arya" "Eddard".
    parent "Brandon" "Rickard".
    parent "Eddard" "Lyarra".
    parent "Eddard" "Rickard".
    parent "Rickard" "Edwyle".
    parent "Rickard" "Marna".
    parent "Sansa" "Catelyn".
    parent "Sansa" "Eddard".

## Logical implication

You can use these facts and logical implication to derive more facts, like "if
X's parent is Y, and Y's parent is Z, then the grandparent of X is Z." That
looks like this:

    grandparent X Z :- parent X Y, parent Y Z.

The uppercase characters are variables. To conclude that Arya's grandparent is
Lyarra, Dusa will use this rule with `X` assigned `"Arya"`, `Y` assigned
`"Eddard"`, and `Z` assigned `"Lyarra"`.

It's also easy to have inferences that build on themselves in a recursive fashion:
an ancestor is either your parent or an ancestor of your parent. In Dusa, that looks
like this:

    ancestor X Y :- parent X Y.
    ancestor X Z :- parent X Y, ancestor Y Z.

Using these rules, Dusa will calculate all of Arya's ancestors: Catelyn,
Eddard, Edwyle, Marna, and Rickard.

## Relations and functions

The propositions in the previous section were all _relations_. Each of
`parent`, `grandparent`, and `ancestor` were relations between two characters.

In Dusa, it's also possible to have propositions that are _functions_.

- Relations look like this: `prop t1 t2 ... tn-1 tn`
- Functions look like this: `prop t1 t2 ... tn-1 is tn` (`is` is a keyword)

A function describes a unique key-value relationship. Familial relationships
don't work like that: Arya has multiple parents and Eddard has multiple
children. But we could use `weapon Char is W` as a functional proposition to
describe a character's favorite weapon, if each character can have at most one
favorite weapon.

    weapon "Arya" is "smallsword".
    weapon "Eddard" is "greatsword".
    weapon "Sansa" is "bow".

Functional propositions aren't unique to Dusa, but they're not too common in
other Datalog-like languages. (One Datalog-like language that used functional
propositions extensively was LogicBlox's LogiQL language.)

## Integrity constraints

Functional propositions create _integrity constraints_ on the database of facts
that Dusa maintains. If these constraints are violated by saying that multiple
keys map to the same value, then the database is thrown out completely.

If we try to give Arya two favorite weapons, for instance, the database will be
invalidated for violating an integrity constraint.

    weapon "Arya" is "smallsword".
    weapon "Arya" is "greatsword".

For a more subtle example, consider trying to make `sibling` a functional
proposition like this:

    sibling A is B :- parent A P, parent B P, A != B.

This will work initially, deriving that Arya and Sansa are siblings, as are
Brandon and Eddard. But if we then add a seemingly innocuous additional fact...

    parent "Bran" "Eddard".

...then Dusa will throw out the database in its entirety, reporting that there
are no solutions. By deriving both `sibling "Arya" is "Sansa"` and
`sibling "Arya" is "Bran"`, the database fails an integrity constraint and is
completely invalidated.

The takeaway here is that we made a mistake: the `sibling` relationship should
be a relation, not a function.

Integrity constraints can also be added with the `#forbid` and `#demand`
directives. If we want to insist that no two characters have the same weapon,
we can write.

    #forbid weapon Char1 is W, weapon Char2 is W, Char1 != Char2.

Note that it's necessary to say `Char1 != Char2`. If we left that out, Dusa
could match both `Char1` and `Char2` to `"Arya"` and therefore invalidate the
database for violating an integrity constraint.

A `#demand` predicate expresses something that must be true in order for the
database to be valid. This can be used like an assertion in programming,
invalidating the database if an expected fact doesn't hold. If we want to make
sure we derive Marna as an ancestor of Arya, we can write this:

    #demand ancestor "Arya" "Marna".

[Explore this example](https://dusa.rocks/#program=%23%20Game%20of%20datalog%0A%0Aparent%20%22Arya%22%20%22Catelyn%22.%0Aparent%20%22Arya%22%20%22Eddard%22.%0Aparent%20%22Bran%22%20%22Eddard%22.%0Aparent%20%22Brandon%22%20%22Rickard%22.%0Aparent%20%22Eddard%22%20%22Lyarra%22.%0Aparent%20%22Eddard%22%20%22Rickard%22.%0Aparent%20%22Rickard%22%20%22Edwyle%22.%0Aparent%20%22Rickard%22%20%22Marna%22.%0Aparent%20%22Sansa%22%20%22Catelyn%22.%0Aparent%20%22Sansa%22%20%22Eddard%22.%0A%0A%23%20Some%20family%20relationships%0A%0Agrandparent%20X%20Z%20%3A-%20parent%20X%20Y%2C%20parent%20Y%20Z.%0A%0Aancestor%20X%20Y%20%3A-%20parent%20X%20Y.%0Aancestor%20X%20Z%20%3A-%20parent%20X%20Y%2C%20ancestor%20Y%20Z.%0A%0Asibling%20A%20B%20%3A-%20parent%20A%20P%2C%20parent%20B%20P%2C%20A%20!%3D%20B.%0A%0A%23%20A%20few%20favorite%20weapons%0A%0Aweapon%20%22Arya%22%20is%20%22smallsword%22.%0Aweapon%20%22Eddard%22%20is%20%22greatsword%22.%0Aweapon%20%22Sansa%22%20is%20%22bow%22.%0A%0A%23%20Constraints%20act%20as%20assertions%20about%20the%20database%0A%0A%23forbid%20weapon%20Char1%20is%20W%2C%20weapon%20Char2%20is%20W%2C%20Char1%20!%3D%20Char2.%0A%23demand%20ancestor%20%22Arya%22%20%22Marna%22.)
