import { makeStream, StringStream } from './string-stream.js';
import { SourceLocation } from './source-location.js';

export interface StreamParser<State, Tree> {
  startState: State;

  /** Called to advance the stream state and the parser state.
   *
   * Will be called exactly once on an empty line. Except in that
   * case, stream.eol() will never be true when this function is
   * initially called.
   */
  advance(stream: StringStream, state: State): ParserResponse<State, Tree>;

  /** Once the end of the file is reached, this function is called
   * repeatedly until it returns null in order for any cleanup
   * needed to happen.
   */
  handleEof(state: State): null | ParserResponse<State, Tree>;
}

export type Tag =
  | 'invalid' // disallowed syntax
  | 'comment' // # hello
  | 'variableName' // X, Y, Z
  | 'literal' // foo, plus, a, f, succ, z
  | 'unit' // ()
  | 'string' // "Hello"
  | 'escape' // "Hello\n\tthere."
  | 'meta' // #define,  #builtin, etc.
  | 'keyword' // is, is?
  | 'integer' // 123, -12
  | 'punctuation' // '...', '{', '}', '.', ':-', etc.
  | 'variableName'; // X, _, _XY_ZZY
export interface Issue {
  type: 'Issue';
  msg: string;
  severity: 'warning' | 'error';
  loc?: SourceLocation;
}

export interface ParserResponse<State, Tree> {
  state: State;
  tag?: Tag;
  tree?: Tree;
  issues?: Issue[];
}

/** Parse a document with the stream parser. */
export function parseWithStreamParser<State, Tree>(
  parser: StreamParser<State, Tree>,
  str: string,
): {
  issues: Issue[];
  document: Tree[];
} {
  const lines = str.split('\n');
  let state: State = parser.startState;
  const output: Tree[] = [];
  const issues: Issue[] = [];

  let currentIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let currentColumn = 1;
    do {
      const stream = makeStream(line, i + 1, currentColumn, currentIndex + currentColumn - 1);
      const response = parser.advance(stream, state);
      state = response.state;
      if (response.tree) {
        output.push(response.tree);
      }
      if (response.issues) {
        issues.push(...response.issues);
      }
      currentColumn = stream.currentColumn();
    } while (currentColumn <= line.length);
    currentIndex += line.length + 1;
  }

  for (;;) {
    const response = parser.handleEof(state);
    if (!response) {
      break;
    }
    state = response.state;
    if (response.tree) {
      output.push(response.tree);
    }
    if (response.issues) {
      issues.push(...response.issues);
    }
  }

  return { issues, document: output };
}
