import { SPECIAL_DEFAULTS } from './dusa-builtins';
import { Issue, ParserResponse, StreamParser } from '../parsing/parser';
import { SourceLocation } from '../parsing/source-location';
import { StringStream } from '../parsing/string-stream';

type StateRoot =
  | {
      type: 'Normal' | 'Beginning' | 'Builtin3';
      defaults: typeof SPECIAL_DEFAULTS;
    }
  | {
      type: 'Builtin1';
      hashloc: SourceLocation;
      defaults: typeof SPECIAL_DEFAULTS;
    }
  | {
      type: 'Builtin2';
      hashloc: SourceLocation;
      defaults: typeof SPECIAL_DEFAULTS;
      builtin: keyof typeof SPECIAL_DEFAULTS;
    };

const punct = ['...', ',', '.', '{', '}', '(', ')', ':-', '!=', '==', '?'] as const;
type PUNCT = (typeof punct)[number];

export type Token =
  | { loc: SourceLocation; type: PUNCT }
  | { loc: SourceLocation; type: 'is' }
  | { loc: SourceLocation; type: 'in' }
  | { loc: SourceLocation; type: 'const'; value: string }
  | { loc: SourceLocation; type: 'builtin'; value: string; builtin: keyof typeof SPECIAL_DEFAULTS }
  | { loc: SourceLocation; type: 'var'; value: string }
  | { loc: SourceLocation; type: 'wildcard'; value: string }
  | { loc: SourceLocation; type: 'triv' }
  | { loc: SourceLocation; type: 'int'; value: number }
  | { loc: SourceLocation; type: 'string'; value: string }
  | { loc: SourceLocation; type: 'hashdirective'; value: string };

export type ParserState = StateRoot;

const META_TOKEN = /^[0-9+\-A-Za-z_][A-Za-z0-9+\-_]*/;
const CONST_TOKEN = /^[a-z][a-zA-Z0-9_]*$/;
const WILDCARD_TOKEN = /^_[a-zA-Z0-9_]*$/;
const VAR_TOKEN = /^[A-Z][a-zA-Z0-9_]*$/;
const INT_TOKEN = /^-?(0|[1-9][0-9]*)$/;
const STRING_CONTENTS = /^[ !#-[\]-~]*/;
const TRIV_TOKEN = /^\(\)/;

function issue(stream: StringStream, msg: string): Issue {
  return {
    type: 'Issue',
    msg,
    loc: stream.matchedLocation(),
  };
}

export const dusaTokenizer: StreamParser<ParserState, Token> = {
  startState: { type: 'Beginning', defaults: SPECIAL_DEFAULTS },
  advance: (stream, state): ParserResponse<ParserState, Token> => {
    let tok: string | null;

    if (stream.eol()) {
      return { state };
    }

    if (stream.eat(/^\s+/)) {
      return { state };
    }

    if (stream.eat(/^#(| .*)$/)) {
      return { state, tag: 'comment' };
    }

    switch (state.type) {
      case 'Beginning':
        if ((tok = stream.eat('#'))) {
          tok = stream.eat(META_TOKEN);
          if (!tok) {
            stream.eat(/^.*$/);
            return {
              state: state,
              issues: [
                issue(
                  stream,
                  `Expect # to be followed by a constant (directive) or space (comment)`,
                ),
              ],
              tag: 'invalid',
            };
          }

          if (tok === 'builtin') {
            return {
              state: { ...state, type: 'Builtin1', hashloc: stream.matchedLocation() },
              tag: 'meta',
            };
          }

          return {
            state: { ...state, type: 'Normal' },
            tag: 'meta',
            tree: { type: 'hashdirective', value: tok, loc: stream.matchedLocation() },
          };
        }

        return { state: { ...state, type: 'Normal' } };

      case 'Builtin1':
        tok = stream.eat(META_TOKEN);
        if (!Object.keys(SPECIAL_DEFAULTS).some((name) => name === tok)) {
          return {
            state: { type: 'Normal', defaults: state.defaults },
            issues: [
              {
                type: 'Issue',
                msg: `Expected token following #builtin to be one of ${Object.keys(
                  SPECIAL_DEFAULTS,
                ).join(', ')}`,
                loc: { start: state.hashloc.start, end: stream.matchedLocation().end },
              },
            ],
            tag: 'invalid',
          };
        }

        return {
          state: { ...state, type: 'Builtin2', builtin: tok as keyof typeof SPECIAL_DEFAULTS },
          tag: 'meta',
        };

      case 'Builtin2':
        tok = stream.eat(META_TOKEN);
        if (tok === null || !tok.match(CONST_TOKEN)) {
          return {
            state: { type: 'Normal', defaults: state.defaults },
            issues: [
              {
                type: 'Issue',
                msg: `Expected constant following #builtin ${state.builtin}`,
                loc: { start: state.hashloc.start, end: stream.matchedLocation().end },
              },
            ],
            tag: 'invalid',
          };
        }

        return {
          state: { type: 'Builtin3', defaults: { ...state.defaults, [state.builtin]: tok } },
          tag: 'macroName',
        };

      case 'Builtin3':
        return {
          state: { ...state, type: 'Beginning' },
          tag: stream.eat('.') ? 'punctuation' : undefined,
        };

      case 'Normal':
        if ((tok = stream.eat('#'))) {
          tok = stream.eat(META_TOKEN);
          return {
            state,
            issues: [
              {
                type: 'Issue',
                msg: `A hash command like '#${tok}' can only appear at the beginning of a declaration`,
                loc: stream.matchedLocation(),
              },
            ],
            tag: 'invalid',
          };
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
              state: p === '.' ? { ...state, type: 'Beginning' } : state,
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
            for (const [builtin, key] of Object.entries(state.defaults)) {
              if (tok === key) {
                return {
                  state,
                  tag: 'macroName',
                  tree: {
                    type: 'builtin',
                    value: tok,
                    builtin: builtin as keyof typeof state.defaults,
                    loc: stream.matchedLocation(),
                  },
                };
              }
            }

            return {
              state,
              tag: 'variableName',
              tree: { type: 'const', value: tok, loc: stream.matchedLocation() },
            };
          }

          if (tok.match(WILDCARD_TOKEN)) {
            return {
              state,
              tag: 'variableName.local',
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
  handleEof: (): ParserResponse<ParserState, Token> | null => {
    return null;
  },
};
