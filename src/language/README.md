# Language checking and transforming

This folder contains the code for checking surface-level programs and repeatedly transforming statically-checked programs into an intermediate representation. The structure of the directory has the structure of a standard multi-pass compiler, for good or ill. The static checks establish a rather sophisticated set of invariants while also attempting to give good feedback to the learner. None of the subsequent passes are permitted to be the source of errors.

## Compiler passes

### Flattening

The flattening transformation removes all builtins and predicates used in term positions. The result of flattening a program like this:

    #builtin NAT_SUCC s
    a is 4.
    b is (s X) :- a == X.
    c :- a > b.

is a program like this:

    a is 4.
    b is #2 :- a is #1, .EQUAL #1 X is (), .NAT_SUCC X is #2.
    c :- a is #1, b is #2, .CHECK_GT #1 #2 is #tt.

### Binarization

Binarization is a key part of the "machine model" our implementation uses. A program like this:

    a :- b, c, d, e.

will be transformed into a program with three types of rules by adding new two new types of predicates: _indices_, additional regular predicates indicated with the `$` prefix, and _intermediates_, indicated with the `@` prefix.

Each premise in the original program becomes either a unary or binary rule.

    @a-1 :- b.
    @a-2 :- @a-1, c.
    @a-3 :- @a-2, d.
    a :- @a-3, e.

The only indices introduced initially are the _seeds_, variable-free regular Datalog predicates.

    $a-0.

Seeds are used to handle variable-free rules. Rules with out premises, like this:

    p is { red, green }.
    q is { blue, purple }.

will become rules with one premise, a seed:

    p is { red, green } :- $p-0.
    q is { blue, purple } :- $q-0.

Binarized programs always maintain the property that intermediate predicates are at the _head_ are either a seed or are at the head of exactly one rule. Intermediate predicates must also either tied to a #forbid or #demand constraint or else at the premise of one or more rules..

Binarized programs treat _fact premises_ differently. The premise `p X Y is Z` in a source program can be referenced as a fact premise like `p X Y Z`, like `p X Y`, like `p X`, or just like `p`. This represents `p X Y is Z`, or `p X Y is _`, or `p X _ is _`, or `p _ _ is _`, and references the fact that we expect to index relations in a trie-like fashion so that all those lookups are very fast.

Our goal is to transform programs into ones where the first premise always _starts_ with the shared variables, and where the second premise is all variables without repeats, starting with the shared variables (in the same order they appear in the first premise), and then followed by the introduced variables. This generally requires the addition of new regular predicates, representing additional access patterns to the relation.

### Adding new index predicates

A binary rule like this...

    @p-4 X Y Z W :- @p-3 X Y Z, a X Y 17 (h X W) V

can't immediately be computed efficiently, because we want shared premises brought up front.

So we could introduce a new predicate $a2 and replace those two rules with these equivalent rules:

    $a2 X Y W :- a X Y 17 (h X W) V.
    @p-4 X Y Z W :- @p-3 X Y Z, $a2 X Y W.

BUT WAIT! What if we have another rule somewhere else:

    @q-3 X Y Z W :- @q-2 Y Z, a X Y 17 (h X W) V.

We can't rewrite this rule to use $a2, because we need the shared variable, `Y`, to come before `X`, which is an introduced variable here. But there was nothing about the first rule that forced `X` to be before `Y`: we could rewrite the whole program as:

    $a2 Y X W :- a X Y 17 (h X W) V.
    @p-4 X Y Z W :- @p-3 X Y Z, $a2 Y X W.
    @q-3 X Y Z W :- @q-2 Y Z, $a2 Y X W.

BUT WAIT! What if we have another rule somewhere else:

    @r-5 X Y W V :- @r-4 X Y W, a X Y 17 (h X W) V.

here, we want to tack a V on to the end of our introduced index to handle this rule:

    $a2 Y X W V :- a X Y 17 (h X W) V.
    @p-4 X Y Z W :- @p-3 X Y Z, $a2 Y X W _.
    @q-3 X Y Z W :- @q-2 Y Z, $a2 Y X W _.
    @r-5 X Y W V :- @r-4 X Y W, $a2 Y X W V.

We're not always going to be able to get away with this, of course. If a premise has a different shape, say `a X Y 16 Z W`, it's definitely going to need a different index. More subtly, a rule may require an incompatible set of "goes before" constraints, like this:

    @s-4 V Q X :- @s-3 V Q, a X Y 17 (h X W) V.

here, we're going to have to introduce a new predicate $a3, like this:

    $a3 V X :- a X Y 17 (h X W) V.
    @s-4 Z V Q X :- @s-3 V Q, $a3 V X.

(This part TODO, maybe?) BUT WAIT! What if there's already a predicate that could serve as this index, because the program already contains a predicate `c` that's only the conclusion of one rule and that has this form:

    c V X Y V :- a X Y 17 (h X W) V.

Ideally, in this case, we can reuse this existing predicate `c` as an index for `a` for this rule:

    @s-4 Z V Q X :- @s-3 V Q, c V X _ _.

Unfortunately (here's why it's a TODO), this cannot be done currently, because everything would go to hell if we asserted elements of type `c` through the programmatic API. This would be fixed by separating EDB from IDB and only allowing the EDB to be extended: https://github.com/users/robsimmons/projects/1?pane=issue&itemId=66307565
