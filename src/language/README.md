# Language checking and transforming

This folder contains the code for checking surface-level programs and repeatedly transforming statically-checked programs into an intermediate representation. The structure of the directory has the structure of a standard multi-pass compiler, and all the compromises that come with that. The static checks establish a rather sophisticated set of invariants while also attempting to give good feedback to the learner; none of the subsequent passes are permitted to be the source of errors.

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

will be transformed into a program with some introduced predicates, where where every rule has either no premises (the 'seeds') or else has two premises, an introduced premise and a premise that comes from the original program:

    $intro-0.
    $intro-1 :- $intro-0, b.
    $intro-2 :- $intro-1, c.
    $intro-3 :- $intro-2, d.
    a :- $intro-3, e.
