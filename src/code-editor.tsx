import React from 'react';
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, ViewUpdate, lineNumbers, tooltips } from '@codemirror/view';
import { ParserState, dinnikTokenizer } from './datalog/parser/dinnik-tokenizer';
import { StringStream } from './datalog/parsing/string-stream';
import { classHighlighter, tags } from '@lezer/highlight';
import { Diagnostic, linter } from '@codemirror/lint';
import { Position, SourceLocation } from './datalog/parsing/source-location';
import { parseWithStreamParser } from './datalog/parsing/parser';

const program = `
character celeste.
character nimbus.
character terra.
character luna.

# Ensure two characters have different races
char1 is { X... } :- character X.
char2 is { X... } :- character X.
:- char1 is C1, char2 is C2, C1 == C2.
:- char1 is C1, char2 is C2, char1 is R, char2 is R.

home C is { uplands, lowlands, catlands, doghouse } :- character C.
race C is { cat, dog, horse, bird } :- character C.
home C is uplands :- race C is bird.
race C is dog :- home C is doghouse.
:- home nimbus is H1, home celeste is H2, H1 != H2.
:- race nimbus is R1, race nimbus is R2, R1 != R2.
:- home luna is H, home terra is H.
:- home C1 is doghouse, home C2 is doghouse, C1 != C2.
:- race C is bird, home C is catlands.
`.trim();

const bogusPosition = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 2 },
};
/** Create a Codemirror-compliant parser from our streamparser.
 * The token method is given a Codemirror-style StringStream,
 * and we have to use that to implement the StringStream interface
 * that our parser expects. Because we're not using the syntax
 * tree, we can feed bogus SourceLocation information to matchedLocation.
 */
const parser = StreamLanguage.define<{ state: ParserState }>({
  name: 'Dinnik',
  startState: () => ({ state: dinnikTokenizer.startState }),
  token: (stream, cell) => {
    const stream2: StringStream = {
      eat(pattern) {
        const result = stream.match(pattern);
        if (!result) return null;
        if (result === true) {
          if (typeof pattern === 'string') return pattern;
          return 'bogus';
        }
        return result[0];
      },
      peek(pattern) {
        const fragment = stream.string.slice(stream.pos);
        if (typeof pattern === 'string') {
          return fragment.startsWith(pattern) ? pattern : null;
        }
        return fragment.match(pattern)?.[0] || null;
      },
      eatToEol() {
        const pos = stream.pos;
        stream.skipToEnd();
        return stream.string.slice(pos);
      },
      sol: () => stream.sol(),
      eol: () => stream.eol(),
      matchedLocation: () => bogusPosition,
    };

    const result = dinnikTokenizer.advance(stream2, cell.state);
    cell.state = result.state;
    return result.tag || null;
  },
  blankLine: (cell) => {
    const stream: StringStream = {
      eat: () => null,
      peek: () => null,
      eatToEol: () => '',
      sol: () => true,
      eol: () => true,
      matchedLocation: () => bogusPosition,
    };
    const result = dinnikTokenizer.advance(stream, cell.state);
    cell.state = result.state;
  },
  copyState: ({ state }) => ({ state }),
  indent: () => null,
  languageData: {},
  tokenTable: {},
});

export const highlighter = HighlightStyle.define([{ tag: tags.className, backgroundColor: 'red' }]);

export interface CodeEditorProps {
  getContents: React.MutableRefObject<null | (() => string)>;
  updateListener: (update: ViewUpdate) => void;
}

function position(state: EditorState, pos: Position) {
  return state.doc.line(pos.line).from + pos.column - 1;
}

function dinnikLinter(view: EditorView): readonly Diagnostic[] {
  const contents = view.state.doc.toString();
  const tokens = parseWithStreamParser(dinnikTokenizer, contents);
  return tokens.issues.map((issue) => {
    return {
      from: position(view.state, issue.loc.start),
      to: position(view.state, issue.loc.end),
      severity: 'error',
      message: issue.msg,
    };
  });
}

export default function CodeEditor(props: CodeEditorProps) {
  const editor = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const state = EditorState.create({
      doc: program + program + program + program,
      extensions: [
        parser,
        syntaxHighlighting(classHighlighter),
        lineNumbers(),
        EditorView.lineWrapping,
        EditorView.updateListener.of(props.updateListener),
        linter(dinnikLinter),
        tooltips({ parent: document.body }),
      ],
    });
    const view = new EditorView({ state, parent: editor.current ?? undefined });
    props.getContents.current = () => {
      return view.state.doc.toString();
    };
    return () => {
      view.destroy();
      props.getContents.current = null;
    };
  }, []);

  return <div className="dk-editor-parent" ref={editor}></div>;
}
