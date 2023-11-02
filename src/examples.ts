export const CHARACTER_CREATION_EXAMPLE = `
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

export const CKY_PARSING_EXAMPLE = `
# CKY Parsing

token "Mary" 1.
token "saw" 2.
token "Bob" 3.
token "with" 4. 
token "binoculars" 5.  

word "Bob" noun.
word "Mary" noun.
word "binoculars" noun.  
word "saw" verb.
word "with" prep.

unary  nounPh noun.          # nounPh <- noun
binary senten nounPh verbPh. # senten <- nounPh verbPh
binary verbPh verb   nounPh. # verbPh <- verb nounPh
binary verbPh verbPh prepPh. # etc.
binary prepPh prep   nounPh.
binary nounPh nounPh prepPh.

parse X (t W) I (s I) :-
  token W I, 
  word W X.

parse X T I J :- 
  unary X Y,
  parse W T I J.

parse X (cons T1 T2) I K :-
  binary X Y Z,
  parse Y T1 I J,
  parse Z T2 J K.

goal T :- parse senten T 1 6.

# Mary sees the Bob that has binoculars
# goal (cons (t "Mary") (cons (t "saw") (cons (t "Bob") (cons (t "with") (t "binoculars")))))
#
# Mary, using binoculars, sees Bob
# goal (cons (t "Mary") (cons (cons (t "saw") (t "Bob")) (cons (t "with") (t "binoculars"))))
`.trim();
