import { Issue, ParserResponse, StreamParser } from '../parsing/parser.js';
import { SourceLocation, SourcePosition } from '../parsing/source-location.js';
import { StringStream } from '../parsing/string-stream.js';

type StateRoot =
  | {
      type: 'Normal';
    }
  | {
      type: 'InString';
      start: SourcePosition;
      end: SourcePosition;
      collected: string;
    };

const punct = [
  '...',
  ',',
  '.',
  '{',
  '}',
  '(',
  ')',
  ':-',
  '->',
  '!=',
  '==',
  '?',
  '>=',
  '>',
  '<=',
  '<',
] as const;
type PUNCT = (typeof punct)[number];

export type Token =
  | { loc: SourceLocation; type: PUNCT }
  | { loc: SourceLocation; type: 'is' }
  | { loc: SourceLocation; type: 'is?' }
  | { loc: SourceLocation; type: 'in' }
  | { loc: SourceLocation; type: 'const'; value: string }
  | { loc: SourceLocation; type: 'var'; value: string }
  | { loc: SourceLocation; type: 'wildcard'; value: string }
  | { loc: SourceLocation; type: 'triv' }
  | { loc: SourceLocation; type: 'int'; value: bigint }
  | { loc: SourceLocation; type: 'string'; value: string }
  | { loc: SourceLocation; type: 'hashdirective'; value: string };

export type ParserState = StateRoot;

const META_ID_TOKEN = /^[A-Za-z_][A-Za-z0-9_']*/;
const META_NUM_TOKEN = /^[+-]?[0-9][A-Za-z0-9_]*/;
const CONST_TOKEN = /^[a-z][a-zA-Z0-9_]*$/;
const WILDCARD_TOKEN = /^_[a-zA-Z0-9_']*$/;
const VAR_TOKEN = /^[A-Z][a-zA-Z0-9_']*$/;
const INT_TOKEN = /^-?(0|[1-9][0-9]*)$/;
const TRIV_TOKEN = /^\(\)/;

function issue(stream: StringStream, msg: string): Issue {
  return {
    type: 'Issue',
    msg,
    severity: 'error',
    loc: stream.matchedLocation(),
  };
}

export const dusaTokenizer: StreamParser<ParserState, Token> = {
  startState: { type: 'Normal' },
  advance: (stream, state): ParserResponse<ParserState, Token> => {
    let tok: string | null;

    if (stream.eol()) {
      if (state.type === 'InString') {
        console.log();
        return {
          state: { type: 'Normal' },
          tag: 'invalid',
          issues: [
            {
              type: 'Issue',
              msg: 'End of string not found at end of line',
              severity: 'error',
              loc: { start: state.start, end: state.end },
            },
          ],
        };
      }

      return { state };
    }

    if (state.type !== 'InString') {
      if (stream.eat(/^\s+/)) {
        return { state };
      }

      if (stream.eat(/^#(| .*)$/)) {
        return { state, tag: 'comment' };
      }
    }

    switch (state.type) {
      case 'InString':
        if ((tok = stream.eat('"'))) {
          return {
            state: { type: 'Normal' },
            tag: 'string',
            tree: {
              type: 'string',
              value: state.collected,
              loc: { start: state.start, end: stream.matchedLocation().end },
            },
          };
        }

        if ((tok = stream.eat(/^[^"\n\r\\]+/))) {
          return {
            state: {
              ...state,
              collected: state.collected + tok,
              end: stream.matchedLocation().end,
            },
            tag: 'string',
          };
        }

        if (stream.eat('\\')) {
          if (
            (tok = stream.eat(/^([0bfnrtv'"\\]|x[0-9a-fA-F][0-9a-fA-F]|u\{[0-9a-fA-F]{1,6}\})/))
          ) {
            switch (tok[0]) {
              case '0':
                tok = '\0';
                break;
              case 'b':
                tok = '\b';
                break;
              case 'f':
                tok = '\f';
                break;
              case 'n':
                tok = '\n';
                break;
              case 'r':
                tok = '\r';
                break;
              case 't':
                tok = '\t';
                break;
              case 'v':
                tok = '\v';
                break;
              case "'":
                tok = "'";
                break;
              case '"':
                tok = '"';
                break;
              case '\\':
                tok = '\\';
                break;
              case 'x':
                tok = String.fromCharCode(parseInt(tok.slice(1), 16));
                break;
              default: {
                // case 'u'
                const charCode = parseInt(tok.slice(2, tok.length - 1), 16);
                if (0xd800 <= charCode && charCode < 0xe000) {
                  return {
                    state,
                    issues: [
                      {
                        type: 'Issue',
                        msg: `Cannot encode lone surrogate ${tok}`,
                        severity: 'error',
                        loc: stream.matchedLocation(),
                      },
                    ],
                  };
                }
                if (charCode > 0x10ffff) {
                  return {
                    state,
                    issues: [
                      {
                        type: 'Issue',
                        msg: `Bad Unicode code point ${tok}`,
                        severity: 'error',
                        loc: stream.matchedLocation(),
                      },
                    ],
                  };
                } else {
                  tok = String.fromCodePoint(charCode);
                  break;
                }
              }
            }
            return {
              state: {
                ...state,
                collected: state.collected + tok,
                end: stream.matchedLocation().end,
              },
              tag: 'escape',
            };
          }
          if ((tok = stream.eat(/^./))) {
            return {
              state,
              tag: 'invalid',
              issues: [
                {
                  type: 'Issue',
                  msg: `Invalid escape sequence \\${tok}`,
                  severity: 'error',
                  loc: stream.matchedLocation(),
                },
              ],
            };
          }
          return {
            state: { type: 'Normal' },
            tag: 'invalid',
            issues: [
              {
                type: 'Issue',
                msg: 'Backslash not supported at end of line',
                severity: 'error',
                loc: stream.matchedLocation(),
              },
            ],
          };
        }

        throw new Error('Expected-to-be-unimpossible state in string parsing reached');

      case 'Normal':
        if ((tok = stream.eat('#'))) {
          tok = stream.eat(META_ID_TOKEN) ?? stream.eat(META_NUM_TOKEN);
          if (!tok) {
            stream.eat(/^.*$/);
            return {
              state: state,
              issues: [
                issue(
                  stream,
                  `The symbol '#' should be followed by a constant (directive) or space (comment).`,
                ),
              ],
              tag: 'invalid',
            };
          }

          return {
            state: { ...state, type: 'Normal' },
            tag: 'meta',
            tree: { type: 'hashdirective', value: tok, loc: stream.matchedLocation() },
          };
        }

        if (stream.eat(TRIV_TOKEN)) {
          return { state, tag: 'unit', tree: { type: 'triv', loc: stream.matchedLocation() } };
        }

        if (stream.eat('"')) {
          return {
            state: {
              ...state,
              type: 'InString',
              start: stream.matchedLocation().start,
              end: stream.matchedLocation().end,
              collected: '',
            },
            tag: 'string',
          };
        }

        for (const p of punct) {
          if (stream.eat(p)) {
            return {
              state: state,
              tag: 'punctuation',
              issues: [],
              tree: { type: p, loc: stream.matchedLocation() },
            };
          }
        }

        if (stream.eat(/^\s+/)) {
          return { state };
        }

        if ((tok = stream.eat(META_ID_TOKEN) ?? stream.eat(META_NUM_TOKEN))) {
          if (tok === 'is') {
            if (stream.eat('?')) {
              return {
                state,
                tag: 'keyword',
                tree: { type: 'is?', loc: stream.matchedLocation() },
              };
            }
            return {
              state,
              tag: 'keyword',
              tree: { type: 'is', loc: stream.matchedLocation() },
            };
          }
          if (tok.match(VAR_TOKEN)) {
            return {
              state,
              tag: 'variableName',
              tree: { type: 'var', value: tok, loc: stream.matchedLocation() },
            };
          }
          if (tok.match(INT_TOKEN)) {
            return {
              state,
              tag: 'integer',
              tree: { type: 'int', value: BigInt(tok), loc: stream.matchedLocation() },
            };
          }
          if (tok.match(CONST_TOKEN)) {
            return {
              state,
              tag: 'literal',
              tree: { type: 'const', value: tok, loc: stream.matchedLocation() },
            };
          }
          if (tok.match(WILDCARD_TOKEN)) {
            return {
              state,
              tag: 'variableName',
              tree: { type: 'wildcard', value: tok, loc: stream.matchedLocation() },
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
  handleEof: (state): ParserResponse<ParserState, Token> | null => {
    if (state.type === 'InString') {
      console.log();
      return {
        state: { type: 'Normal' },
        tag: 'invalid',
        issues: [
          {
            type: 'Issue',
            msg: 'End of string not found at end of input',
            severity: 'error',
            loc: { start: state.start, end: state.end },
          },
        ],
      };
    }
    return null;
  },
};
