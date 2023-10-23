import React from 'react';
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, ViewUpdate, lineNumbers, tooltips } from '@codemirror/view';
import { ParserState, dinnikTokenizer } from './datalog/parser/dinnik-tokenizer';
import { StringStream } from './datalog/parsing/string-stream';
import { classHighlighter, tags } from '@lezer/highlight';
import { Diagnostic, linter } from '@codemirror/lint';
import { Position } from './datalog/parsing/source-location';
import { parseWithStreamParser } from './datalog/parsing/parser';

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
  contents: string;
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
  const editorDiv = React.useRef<HTMLDivElement | null>(null);
  const editorView = React.useRef<EditorView | null>(null);

  React.useEffect(() => {
    console.log(props.updateListener);
    const state = EditorState.create({
      doc: props.contents,
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
    const view = new EditorView({ state, parent: editorDiv.current ?? undefined });
    props.getContents.current = () => {
      return view.state.doc.toString();
    };
    editorView.current = view;
    return () => {
      editorView.current = null;
      view.destroy();
      props.getContents.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (!editorView.current) {
      console.error('Cannot set contents, no editor view');
      return;
    }
    editorView.current.state.update({
      changes: {
        from: 0,
        to: editorView.current.state.doc.length,
        insert: props.contents,
      },
    });
  }, [props.contents]);

  return <div className="dk-editor-parent" ref={editorDiv}></div>;
}
