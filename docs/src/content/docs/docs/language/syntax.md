---
title: Syntax specification
---

- TODO out-of-date, fix

The syntax of Dusa is not whitespace-sensitive. Comments, which begin with a pound
sign followed by a space or end of line and continue to the end of the line, are
treated like whitespace.

## Tokens

- A `<variable>` matches `/[A-Z][a-zA-Z0-9_]*/`
- A `<wildcard>` matches `/_[a-zA-Z0-9_]*/` and represents variable names that you wish to be ignored.
- An `<identifier>` matches `/[a-z][a-zA-Z0-9_]*/`
- A `<string-literal>` is a regular string constant with no escape characters: two double quotes `"`
  surrounding any ASCII character in the range 32-126 except for `"` and `\`.
- An `<int-literal>` matches `/0|-?[1-9][0-9]*/`

## Context-free grammar

    <program>      ::= <declaration> <program> | ""
    <declaration>  ::= "#builtin" <builtin> <identifier> [ "." ]
                    |  "#demand" <premises> "."
                    |  "#forbid" <premises> "."
                    |  <conclusion> ":-" <premises> "."

    <premises>     ::= <premise> | <premise> "," <premises>
    <premise>      ::= <term> "!=" <term>
                    |  <term> "==" <term>
                    |  <attribute>
                    |  <attribute> "is" <term>

    <conclusion>   ::= <attribute>
                    |  <attribute> "is" <term>
                    |  <attribute> "is" "{" <options> "}"
    <conc-options> ::= <term> | <term> "?" | <conc-option> "," <conc-options>
    <conc-option>  ::- <term> | "?"

    <attribute>   ::= <identifier> | <identifier> <arguments>
    <arguments>   ::= <atomic-term> | <atomic-term> <arguments>
    <atomic-term> ::= <wildcard> | <variable>
                   |  <string-literal> | <int-literal>
                   |  <identifier> | <builtin-identifier>
                   |  "(" <term> ")"
    <term>        ::= <atomic-term>
                   |  <identifier> <arguments>
                   |  <builtin-identifier> <arguments>
    <builtin>     ::= "INT_PLUS" | "INT_MINUS"
                   |  "NAT_ZERO" | "NAT_SUCC"
                   |  "STRING_CONCAT"
