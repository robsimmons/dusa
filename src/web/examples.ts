export const CHARACTER_CREATION_EXAMPLE = `
# Character creation
# and a bit of Tracery-style template story creation

name "Celeste".
name "Nimbus".
name "Terra".
name "Luna".

# Pick names for three characters: a hero, sidekick, and villan
character hero is? Name :- name Name.
character sidekick is? Name :- name Name.
character villain is? Name :- name Name.

# No two characters can have the same name
#forbid character Char1 is N, character Char2 is N, Char1 != Char2.

# everyone must have a different training
training C is { warrior, mage, assassin, bard } :- character C is _.
#forbid training Char1 is T, training Char2 is T, Char1 != Char2.

# hero and villain can't be from the same home
home C is { highlands, seaside_town, city, foothills } :- character C is _.
#forbid home hero is H, home villain is H.

# Building the story with string concatenation
#builtin STRING_CONCAT concat.

lowerCase warrior is "warrior".
upperCase warrior is "Warrior".
lowerCase mage is "mage".
upperCase mage is "Mage".
lowerCase assassin is "assassin".
upperCase assassin is "Assassin".
lowerCase bard is "bard".
upperCase bard is "Bard".

homeName Char is "the Highlands" :- home Char is highlands.
homeName Char is "Seaside Village" :- home Char is seaside_town.
homeName Char is "the Foothills" :- home Char is foothills.
homeName Char is (concat (upperCase (training Char)) " City") :-
   home Char is city.

a_story is (concat 
  "Our hero " 
  (character hero) 
  ", a talented " 
  (lowerCase (training hero)) 
  " hailing from " 
  (homeName hero) 
  ", sets off for adventure with their trusty " 
  (lowerCase (training sidekick)) 
  " sidekick " 
  (character sidekick) 
  " from " 
  (homeName sidekick) 
  ". Together they defeat the " 
  (lowerCase (training villain)) 
  " villain " 
  (character villain) 
  " of "
  (homeName villain)
  "!").`.trim();

export const CKY_PARSING_EXAMPLE = `
# CKY Parsing
#builtin INT_PLUS plus
#builtin STRING_CONCAT concat

token 1 is "mary".
token 2 is "saw".
token 3 is "bob".
token 4 is "with". 
token 5 is "binoculars".  

word "binoculars" noun.  
word "bob" noun.
word "mary" noun.
word "saw" noun.
word "saw" verb.
word "with" prep.

unary  nounPh noun.          # noun phrase <- noun
binary senten nounPh verbPh. # senten <- noun phrase + verb phrase
binary verbPh verb   nounPh. # verb phrase <- verb + noun phrase
binary verbPh verbPh prepPh. # etc.
binary prepPh prep   nounPh.
binary nounPh nounPh prepPh.

parse X I (plus 1 I) Tok :-
  token I is Tok, 
  word Tok X.

# Unary rules are like X <- Y
parse X I J Str :- 
  unary X Y, 
  parse Y I J Str.

# Binary rules are like X <- Y Z
parse X I K (concat "(" StrY " " StrZ ")") :-
  binary X Y Z,
  parse Y I J StrY,
  parse Z J K StrZ.

# (mary ((saw bob) (with binoculars))) - mary has the binoculars
# (mary (saw (bob (with binoculars)))) - bob has the binoculars
goal Str :- parse senten 1 6 Str.
`.trim();

export const ROCK_PAPER_SCISSORS = `
# Rock, paper, scissors

# We can play the regular version...
outcome rock crushes scissors.
outcome scissors cuts paper.
outcome paper covers rock.

# ...or choose to play the expanded variant
variant is { normal, expanded }.
outcome rock crushes lizard :- variant is expanded.
outcome lizard poisons spock :- variant is expanded.
outcome spock smashes scissors :- variant is expanded.
outcome scissors decapitates lizard :- variant is expanded.
outcome lizard eats paper :- variant is expanded.
outcome paper disproves spock :- variant is expanded.
outcome spock vaporizes rock :- variant is expanded.

player player1.
player player2.
move Move :- outcome Move _ _.

#builtin INT_PLUS plus.
round 1.
plays P N is? Move :- round N, player P, move Move.

# If the players make the same move, we go to the next round
round (plus Round 1) :-
  plays player1 Round is Move,
  plays player2 Round is Move.

# If the players make different moves, outcomes tells us who won.
# The "wins" and "round" constants are just a cheap hack to make
# the result look like a sentence without string concatenation.
eventually Winner "wins in round" Round "when" Move1 Defeats Move2 :-
  outcome Move1 Defeats Move2,
  plays Winner Round is Move1,
  plays _ Round is Move2.

# Only return games where there are three or more rounds
#demand round 3.
`.trim();

export const GRAPH_GENERATION_EXAMPLE = `
# Generating graphs
#builtin INT_MINUS minus

vertex 6.
vertex (minus N 1) :- vertex N, N > 0.

# For each potential edge, we mark it present or absent
# The relation is symmetric: edge X Y == edge Y X
edge X Y is { extant, absent } :- vertex X, vertex Y, X != Y.
edge X Y is Z :- edge Y X is Z.

path N N :- vertex N.
path X Z :- path X Y, edge Y Z is extant.

#demand path 0 1.
#demand path 5 6.
#forbid path 0 6.
`.trim();
