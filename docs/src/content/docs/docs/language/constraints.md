---
title: Constraints
---

Constraints are critical to understanding solutions in Dusa. A solution in Dusa must
have four properties:

1. Whenever the premises of a closed rule are satisfied, one of the mutually exclusive
   conclusions must be present in the solution.
2. Whenever all the premises of an open rule are satisfied, either one of the mutually
   exclusive conclusions must be present in the solution, or else the addition of any
   mutually exclusive conclusion must violate a functional constraint.
3. There must be no way to satisfy all the premises of any `#forbid` constraint.
4. There must be some way to satisfy all the premises of every `#demand` constraint.

## Functional constraints

Functional constraints are at the core of Dusa. Choices in rules expand the search
space of solutions, and constraints trim the search space back down.

If any attribute is forced to take two distinct values, the solution is invalidated.

    species is { bear, bird }.
    name is yogi :- species is bear.
    name is tweety :- species is bird.
    name is big :- species is bird.

This program has only one solution, containing the [facts](/docs/language/facts/)
`species is bear` and `name is yogi`. If the solution contains `species is bird`,
then the third and forth rules insist that the name is both `tweety` and `big`. This
is treated as contradictory, so any solution positing that the species is bird will be
rejected.

## Forbid constraints

If all the premises to any `#forbid` declaration can be simultaneously satisfied, the
database is invalidated.

    species is { bear, bird }.
    name is yogi :- species is bear.
    name is tweety :- species is bird.
    #forbid name is tweety.

This program again has only one solution, containing the facts `species is bear` and
`name is yogi`. Positing that the species is bird won't cause a functional constraint
to fail, but it will cause the solution to contain `name is tweety` to be derived,
which is rejected by the constraint.

### Syntactic sugar

Forbid constraints are technically syntactic sugar. Instead of a `#forbid` declaration:

    #forbid <premises>.

We could introduce a functional proposition `contradiction` and derive a contradictory
value for the proposition if the undesirable properties hold.

    contradiction is absent.
    contradiction is present :- <premises>.

## Demand constraints

Conversely, an ostensible solution will be invalidated unless all the premises to
every `#demand` declaration can be simultaneously satisfied.

    species is { bear, bird }.
    name is yogi :- species is bear.
    name is tweety :- species is bird.
    #demand name is yogi.

Once again, this program again has only one solution, containing the facts
`species is bear` and `name is yogi`. If the name is not Yogi, the database will
be rejected, and so we will not see any solutions with birds, who can only be named
tweety.

### Syntactic sugar

Demand constraints are technically syntactic sugar. Instead of two `#demand`
declarations:

    #demand <premises_1>.
    #demand <premises_2>.

We could introduce a functional proposition `required _ is _` that is given a default
assignment by an [open rule](/docs/language/rules), but forbid that default assignment,
accepting the solution only if an alterantive value is derived.

    required 1 is { unsatisfied? }.
    required 2 is { unsatisfied? }.
    required 1 is satisfied :- <premises_1>.
    required 2 is satisfied :- <premises_2>.
    #forbid required _ is unsatisfied.
