export const CHARACTER_CREATION_EXAMPLE = `
# Character creation
# and a bit of Tracery-style template story creation

name "Celeste".
name "Nimbus".
name "Terra".
name "Luna".

# Pick names for three characters: a hero, sidekick, and villan
character hero is { Name? } :- name Name.
character sidekick is { Name? } :- name Name.
character villain is { Name? } :- name Name.

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
homeName Char is (concat TrainingCity " City") :-
   home Char is city,
   training Char is Training,
   upperCase Training is TrainingCity.

a_story is (concat 
  "Our hero " 
  HeroName 
  ", a talented " 
  HeroTraining 
  " hailing from " 
  HeroHome 
  ", sets off for adventure with their trusty " 
  SidekickTraining 
  " sidekick " 
  SidekickName 
  " from " 
  SidekickHome 
  ". Together they defeat the " 
  VillainTraining 
  " villain " 
  VillainName 
  " of "
  VillainHome
  "!")
:- character hero is HeroName, 
   character sidekick is SidekickName, 
   character villain is VillainName, 
   homeName hero is HeroHome, 
   homeName sidekick is SidekickHome, 
   homeName villain is VillainHome, 
   training hero is HT, 
     lowerCase HT is HeroTraining,
   training sidekick is ST, 
     lowerCase ST is SidekickTraining,
   training villain is VT, 
     lowerCase VT is VillainTraining.
`.trim();

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

export const GRAPH_GENERATION_EXAMPLE = `
# Generating graphs
#builtin NAT_SUCC s

vertex 6.
vertex N :- vertex (s N).

edge X Y is { extant, absent } :- vertex X, vertex Y, X != Y.
edge X Y is Z :- edge Y X is Z.

reachable N N :- vertex N.
reachable Start Y :- reachable Start X, edge X Y is extant.

#demand reachable 0 1.
#demand reachable 5 6.
#forbid reachable 0 6.
`.trim();