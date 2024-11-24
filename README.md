# Dusa Language

Dusa is an implementation of
[finite-choice logic programming](https://arxiv.org/abs/2405.19040), which
takes ideas from logic programming in both Datalog and answer set programming.

[![Run static checks](https://github.com/robsimmons/dusa/actions/workflows/check.yml/badge.svg)](https://github.com/robsimmons/dusa/actions/workflows/check.yml)
[![Coverage Status](https://coveralls.io/repos/github/robsimmons/dusa/badge.svg?branch=main)](https://coveralls.io/github/robsimmons/dusa?branch=main)
[![NPM Module](https://img.shields.io/npm/v/dusa.svg)](https://www.npmjs.com/package/dusa)

- Dusa lives online at [dusa.rocks](https://dusa.rocks/).
- Documentation lives at [dusa.rocks/docs](https://dusa.rocks/docs/)
- [Source code on GitHub](https://github.com/robsimmons/dusa)
- [Issue tracker at GitHub](https://github.com/robsimmons/dusa/issues)

Dusa was initially developed by Rob Simmons and Chris Martens while Rob
attended [Recurse Center](https://www.recurse.com/) in Fall 2023. Recurse
Center is a great place to think about ambitious projects like this in a
supportive environment full of interesting people!

## Command-line quickstart

The `dusa` command-line program can be run directly from
[`npx`](https://docs.npmjs.com/cli/v8/commands/npx), the only requirement is
that you are using Node v22 or above. The examples used here can be found
[on github](https://github.com/robsimmons/dusa/tree/main/examples).

The command-line utility requires one positional argument, a Dusa program, and
if given no other arguments will return a single solution in JSON format.

```
npx dusa examples/mutual-exclusion.dusa
```

The `-n` flag controls the number of solutions returned. This command will
return 2 solutions:

```
npx dusa examples/mutual-exclusion.dusa -n0
```

Including the `-q <pred>` flag will print only certain predicates instead of
the full database of facts.

```
npx dusa examples/cky-parsing.dusa -n0 -q goal
npx dusa examples/character-creation.dusa -n3 -q a_story
npx dusa examples/rock-paper-scissors.dusa -n5 -q eventually
```

Including the `-c <pred>` flag will print only the number of facts about a
certain predicate that exist, instead of a list of all the values associated
with that fact.

```
npx dusa examples/rock-paper-scissors.dusa -n3 -c move
npx dusa examples/rock-paper-scissors.dusa -n3 -c move -q eventually
```

You can assert additional facts on the command line with `-a`. Adding two
edges to the graph coloring example in examples/graph-coloring.dusa removes
all solutions.

```
npx dusa examples/graph-coloring.dusa -n5 -q isBlue
npx dusa examples/graph-coloring.dusa -n5 -q isBlue -a '{"name":"edge", "args":[{"name":"a"}, {"name":"d"}]}' -a '{"name":"edge", "args":[{"name":"c"}, {"name":"d"}]}'
```

The `-f` option allows you to include files containing lists of JSON facts.

```
npx dusa examples/canonical-reps.dusa -f examples/graph-data-32.json -q isRep
```

## License

All documentation and examples in the `docs` and `examples` directories and
subdirectories therein are MIT-licensed, but the Dusa implementation in
JavaScript is, at present, only licensed under the GNU General Public License
v3.0 (see LICENSE).

Dusa is presently under the GPL is to make it easy for many people to use the
software while maintaining some ownership of software that took a fair amount
of time and expertise to develop. If the GPL is an issue for you or your
company but you'd like to use it, I'd be delighted to discuss making that
possible, and if you want to sponsor me to relicense Dusa more permissively,
I wouldn't take _much_ convincing. --- Rob
