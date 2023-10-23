import { makeStream, StringStream } from './string-stream';
import { SourceLocation } from './source-location';

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

export type Tag = string;
export interface Issue {
  type: 'Issue';
  msg: string;
  loc: SourceLocation;
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let currentColumn = 1;
    do {
      const stream = makeStream(line, i + 1, currentColumn);
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
  }

  while (true) {
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
