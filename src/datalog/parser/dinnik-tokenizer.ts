import { Issue, ParserResponse, StreamParser } from '../parsing/parser';
import { SourceLocation } from '../parsing/source-location';
import { StringStream } from '../parsing/string-stream';

interface StateRoot {
  type: 'Root';
}

const punct = ['...', ',', '.', '{', '}', '(', ')', ':-', '!=', '=='] as const;
type PUNCT = (typeof punct)[number];

export type Token =
  | { loc: SourceLocation; type: PUNCT }
  | { loc: SourceLocation; type: 'is' }
  | { loc: SourceLocation; type: 'in' }
  | { loc: SourceLocation; type: 'const'; value: string }
  | { loc: SourceLocation; type: 'var'; value: string }
  | { loc: SourceLocation; type: 'triv' }
  | { loc: SourceLocation; type: 'int'; value: number }
  | { loc: SourceLocation; type: 'string'; value: string };

export type ParserState = StateRoot;

const META_TOKEN = /^[0-9+\-A-Za-z_][A-Za-z0-9+\-_]*/;
const CONST_TOKEN = /^[a-z][a-zA-Z0-9_]*$/;
const VAR_TOKEN = /^[A-Z][a-zA-Z0-9_]*$/;
const INT_TOKEN = /^-?(0|[1-9][0-9]*)$/;
//const NUM_TOKEN = /^[+-]?(([0-9]+(\.[0-9])?)|([0-9]*\.[0-9]+))$/;
const STRING_CONTENTS = /^[a-zA-Z0-9`~!@#$%^&*()\-_+=,<.>?;:'{[}\]| ]*/;
const TRIV_TOKEN = /^\(\)/;

function issue(stream: StringStream, msg: string): Issue {
  return {
    type: 'Issue',
    msg,
    loc: stream.matchedLocation(),
  };
}

export const dinnikTokenizer: StreamParser<ParserState, Token> = {
  startState: { type: 'Root' },
  advance: (stream, state): ParserResponse<ParserState, Token> => {
    let tok;
    switch (state.type) {
      case 'Root':
        if (stream.eol()) {
          return { state };
        }

        if (stream.eat(/^\s+/)) {
          return { state };
        }

        if (stream.eat(/^#(| .*)$/)) {
          return { state, tag: 'comment' };
        }

        if (stream.eat(TRIV_TOKEN)) {
          return { state, tag: 'literal' };
        }

        if (stream.eat('"')) {
          const value = stream.eat(STRING_CONTENTS)!;
          if (stream.eat('"')) {
            return {
              state,
              tag: 'string',
              tree: { type: 'string', value, loc: stream.matchedLocation() },
            };
          }

          if ((tok = stream.eat(/^[^"]+"?/))) {
            return {
              state,
              tag: 'invalid',
              issues: [
                issue(
                  stream,
                  `Expected double-quote to end string, found unexpected character '${tok[0]}' instead`,
                ),
              ],
            };
          }

          return {
            state,
            tag: 'invalid',
            issues: [issue(stream, 'End of string not found at end of line')],
          };
        }

        for (const p of punct) {
          if (stream.eat(p)) {
            return {
              state,
              tag: 'punctuation',
              tree: { type: p, loc: stream.matchedLocation() },
            };
          }
        }

        if (stream.eat(/^\s+/)) {
          return { state };
        }

        if ((tok = stream.eat(META_TOKEN))) {
          if (tok === 'is') {
            return {
              state,
              tag: 'keyword',
              tree: { type: 'is', loc: stream.matchedLocation() },
            };
          }
          if (tok.match(VAR_TOKEN)) {
            return {
              state,
              tag: 'variableName.special',
              tree: { type: 'var', value: tok, loc: stream.matchedLocation() },
            };
          }
          if (tok.match(INT_TOKEN)) {
            return {
              state,
              tag: 'literal',
              tree: { type: 'int', value: parseInt(tok), loc: stream.matchedLocation() },
            };
          }
          if (tok.match(CONST_TOKEN)) {
            return {
              state,
              tag: 'variableName',
              tree: { type: 'const', value: tok, loc: stream.matchedLocation() },
            };
          }
          return {
            state,
            tag: 'invalid',
            issues: [issue(stream, `Invalid identifier '${tok}'`)],
          };
        }

        tok = stream.eat(/^[^\s]/)!;
        return {
          state,
          tag: 'invalid',
          issues: [issue(stream, `Unexpected symbol '${tok}'`)],
        };
    }
  },
  handleEof: (_): ParserResponse<ParserState, Token> | null => {
    return null;
  },
};
