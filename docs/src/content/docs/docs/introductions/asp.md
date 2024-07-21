---
title: Dusa is answer set programming
description: Introducing Dusa usage for ASP programmers.
---

Answer set programming is a way of writing Datalog-like programs to compute
acceptable models (answer sets) that meet certain constraints. Whereas
traditional [datalog](/docs/introductions/datalog/) aims to compute just one
solution, answer set programming introduces choices that let multiple possible
solutions diverge.

Dusa allows choices by supporting mutually exclusive assignments to a
functional predicate. Any assignment which satisfies all integrity constraints
is a valid solution. (Answer set programming calls them "answer sets" or
"models," Dusa calls them "solutions," but they're the same concept.)

## Generating suspects

If we have three suspects, Amy, Harry, and Sally, we can assign each of them
guilt or innocence with the following program:

    guilt amy is { innocent, guilty }.
    guilt harry is { innocent, guilty }.
    guilt sally is { innocent, guilty }.

This makes "guilt" a _functional predicate_: each of the three suspects can have
one guilt quality: **either** `guilt amy is innocent` can hold, **or**
`guilt amy is guilty` can hold, but Dusa won't let both of these hold at the
same time (and the rule forces the attribute `guilt amy` to take one of these
two values).

Dusa will, in no particular order, generate eight different solutions,
corresponding to the two different guilt assignments for the three suspects.

- `guilt amy is innocent`, `guilt harry is innocent`, `guilt sally is innocent`
- `guilt amy is innocent`, `guilt harry is innocent`, `guilt sally is guilty`
- `guilt amy is innocent`, `guilt harry is guilty`, `guilt sally is innocent`
- `guilt amy is innocent`, `guilt harry is guilty`, `guilt sally is guilty`
- `guilt amy is guilty`, `guilt harry is innocent`, `guilt sally is innocent`
- `guilt amy is guilty`, `guilt harry is innocent`, `guilt sally is guilty`
- `guilt amy is guilty`, `guilt harry is guilty`, `guilt sally is innocent`
- `guilt amy is guilty`, `guilt harry is guilty`, `guilt sally is guilty`

The word `is` is a keyword separating the attribute `guilt amy` from the value
`guilty` or `innocent`.

### Constraints

It's not a good murder mystery if everyone is guilty or everyone is innocent!
We can reject any solutions that don't have someone guilty with `#demand`
constraints:

    #demand guilt _ is guilty.
    #demand guilt _ is innocent.

These declarations demand that someone (the underscore means we don't care who)
is innocent, and that else is guilty. This will cause us to reject the two solutions
where everyone is innocent or guilty.

Those two constraints above are equivalent to the single constraint:

    #demand guilt Someone is guilty, guilt SomeoneElse is innocent.

When a `#demand` constraint has multiple parts separated by commas, all must
hold for the demand to be met. The uppercase `Someone` and `SomeoneElse` are
variables that can be replaced by any suspect (Amy, Harry, or Sally).

If we want to ensure that there's only one innocent, we could write a `#forbid`
constraint to forbid any solution where two or more suspects are innocent.

If every clause of a `#forbid` constraint can be satisfied, then the solution will be
rejected.

    #forbid guilt Someone is innocent,
        guilt SomeoneElse is innocent,
        Someone != SomeoneElse.

It's very important that we add `Someone != SomeoneElse`. If we do not, Dusa
can assign the _same_ suspect to `Someone` and `SomeoneElse`, which means that
this rule would forbid any solution where _anyone_ was innocent.

### Rules

Let's say that we want to add a new character, Harold, to our little band of
potential criminals. Harold's innocence is tied to others: if Amy innocent, then
Harold is guilty, and if Harry is guilty, then Harold is guilty.

This is a job for rules, which describe if-then conditions... but we write them
backwards, as is traditional. The logic above is handled like this:

    guilt harold is guilty :- guilt amy is innocent.
    guilt harold is guilty :- guilt harry is guilty.

This doesn't say that Harold is potentially guilty and potentially innocent, it
provides specific conditions where Harold **must** be guilty.

But that's not everything! To complete our story, we want to say that Harold is
innocent **unless** Amy is innocent or Harry is guilty. We can capture this
"unless" reasoning with an **open** rule. (All the rules we've seen so far have
been **closed**, because they insist on only particular values for attributes.)

The open rule we want looks like this:

    guilt harold is? innocent.

In the case where nothing forces Harold to be guilty, this rule will conclude
that Harold is innocent. However, in the case where one of the other rules
forces Harold to be guilty, this indifferent rule won't contradict that
other conclusion.

[Explore this example](https://dusa.rocks/#jsonz=lZHBqsIwEEV_5Rq3tR8giAt54Opt3BYktqMNJDMljaiI_25rG1p9orws5547dzJzVUHNlVTEKlGF5EdH3FamWHnjKOOMD0djA7S7wNS4wjBL3kAJHsIFtzQypfb-O1Vraz9RGU-xEUfC1FKdkqAeStHWkAU5zUUHYTvw6VstGvuUX0E4CSqSyhK0p3Hnvfidie7N3_AkYzTvSf-x9TsmuieLMdgPsdZebDFMDjrrPDQbOpXEIBNK8i3XHyC2hvhh351zdIau43L84Rctps1neDrwPxwv8am63QE)

## Boolean satisfiability

Answer set programming is sometimes compared to boolean satisfiability solving,
and is sometimes implemented with general purpose boolean satisfiability
solvers. We can use Dusa as a (pretty bad) boolean satisfiability solver by assigning
every proposition we come across the value `true` or `false`. The [Wikipedia article
describing a basic SAT-solving algorithm,
DPLL](https://en.wikipedia.org/wiki/DPLL_algorithm) describes this SAT instance:

    (a' + b  + c ) * (a  + c  + d ) *
    (a  + c  + d') * (a  + c' + d ) *
    (a  + c' + d') * (b' + c' + d ) *
    (a' + b  + c') * (a' + b' + c )

We can ask Dusa to solve this problem by negating each the OR-ed together
clauses and making each one a `#forbid` constraint. (Needing one of the
literals in a clause to hold is the same as needing all of the negations to
hold.)

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

[Explore this example](https://dusa.rocks/#jsonz=lZBLCsMwDAWvIpStyQG67Dm8kX8gcOUSO4sScvdSpy0mdUu6E0_DPKEFC54wXb2gQpfsfPHySAY4pxQ9CWQqnAOT4cjlpkULAWdYoEyzVxAoZg_rqMX0Y9uPXT_WMoQ0GXZQW7Y1VHWFFNj3PO7gD-BP2L0af7HPi9whcQvvxKbZHxN_-0Xv4pZtSzYxrnc)

## Rock-paper-scissors

Rock-paper-scissors is a two-person game. The two players simultaneously choose
rock, paper, or scissors, and the pair of choices determines the winner: paper
covers rock, rock crushes scissors, and scissors cut paper.

### One round

We can use Dusa to simulate a single round of rock-paper-scissors.

    player player1.
    player player2.
    throw Player is { rock, paper, scissors } :- player Player.

There's no "is" in the `player _` proposition: this is a relational proposition,
instead of the functional propositions we've seen so far.

This Dusa program has nine different solutions:

- Player 1 throws rock, player 2 throws rock (Tie)
- Player 1 throws rock, player 2 throws paper (Player 2 wins, paper covers rock)
- Player 1 throws rock, player 2 throws scissors (Player 1 wins, rock crushes
  scissors)
- Player 1 throws paper, player 2 throws rock (Player 1 wins, paper covers rock)
- ...and so on...

We can capture the information about _who_ wins a new relational proposition
`outcome _ _ _`, with three facts, and two more rules:

    outcome rock crushes scissors.
    outcome scissors cuts paper.
    outcome paper covers rock.

    tie :- throw player1 is Throw, throw player2 is Throw.
    winner Win :- outcome Victor _ Loser, throw Win is Victor, throw _ is Loser.

[Explore this example](https://dusa.rocks/#jsonz=bY_dCsIwDIVfJdTbOdBLn0HQC9GbwZAaseiS0bSKiO9us27zB6-afjnnJHmYYBaGWyRTmAPb2CApmcCKEDxHOgAfU2HPBbT7Fn0BYp0Ie6moovayv6OH_MzKHzBPIJw832CdsRN4_A-DJyymva1XlzqAY7DcYGcC66OcUEZT-e6POTYGyeEf3e4Plq-YFBrVZQeHOjRv2J-gK24UFF98PvLkvDmiFLdzpPZhxtbZwB5qWLLoZdmuomTNzQHWijpZaZ4v)

### Multiple rounds

Often, we want to play rock paper scissors until someone wins.
To play multiple rounds, we replace the predicate `throw Player is Move` with
the predicate `throw Player Round is Move` which records the player's move in
a particular round. There's always a round one, and there are always two players, `player1` and `player2`.

    round 1.
    player player1.
    player player2.
    throw Player Round is { rock, paper, scissors } :-
        player Player,
        round Round.

As before, as soon as a player casts a winning move, they win.

    outcome rock crushes scissors.
    outcome scissors cuts paper.
    outcome paper covers rock.
    winner Win :-
        outcome Victor _ Loser,
        throw Win Round is Victor,
        throw _ Round is Loser.

If (and only if) the players pick the same answer, then we need to play another
round. This uses [built-in addition](/docs/langauge/builtin/) to use concise round
numbers 1, 2, 3...

    #builtin INT_PLUS plus
    round (plus Round 1) :-
        throw player1 Round is Throw,
        throw player2 Round is Throw.

Now we have a working simulator for arbitrary games of rock-paper-scissors! If
we want to control the amount of drama we're exploring, we can use constraints
to control the number of rounds. These two constraints require there to be at least
three rounds but no more than eight.

    #demand round 3.
    #forbid round 8.

[Explore this example](https://dusa.rocks/#jsonz=bVDLTsMwEPyVVXIBKURquaD-AVKLKihwiRSljqtaJF7LDypU9d9Ze_OAQi6xZ8YzO3vOfLbK0EidFVmLIvRSRySHTei8Mp0Ei0G3DvBAJ_FRgGmMtAU4oZxD6yqd74MirYbHp129Xb--gOkC4ZU2XfMlLfBvUV4BSwL80eIJtgw_xyRQDs7_R8EFVneVBvoGI35YAINpUnYpYzwGL7CXyQyEDe4o3WRWzvzkL4J3HPqDTXcQ-ClJEa2IOymtCXyn0uNEo_xNCY8Walijo9GY5JpRPnVk3S--ntn0OJXgUnF5fLqJyx2Ei9spnh2GTc8-uwgXfyXLK0mKylvZNwRy0D1h-QHtXo3IQ5ldvgE)
