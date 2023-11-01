export const EXAMPLE_PROGRAM = `
# Character creation

character celeste.
character nimbus.
character terra.
character luna.

# Ensure two characters have different species
char1 is { X... } :- character X.
char2 is { X... } :- character X.
:- char1 is C, char2 is C. 
:- char1 is C1, char2 is C2,
   species C1 is S, species C2 is S.

# Characters have a home and a species
home C is {
  uplands,
  lowlands,
  catlands,
  doghouse
} :- character C.
species C is {
  cat,
  dog,
  horse,
  bird
} :- character C.

# Birds only live in the uplands
home C is uplands :- species C is bird.

# Only dogs live in the doghouse
species C is dog :- home C is doghouse.

# Nimbus and celeste must have the same home & species
home celeste is H :- home nimbus is H.
species celeste is S :- species nimbus is S.

# Luna and terra can't have the same home or species
:- home luna is H, home terra is H.
:- species luna is S, species terra is S.

# Only room for one in the doghouse
:- home C1 is doghouse, home C2 is doghouse, C1 != C2.
`.trim();
