import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, ViewUpdate, keymap, lineNumbers, tooltips } from '@codemirror/view';
import { ParserState, dusaTokenizer } from './datalog/dusa-tokenizer';
import { StringStream } from './datalog/parsing/string-stream';
import { classHighlighter, tags } from '@lezer/highlight';
import { Diagnostic, linter } from '@codemirror/lint';
import { SourcePosition } from './datalog/parsing/source-location';
import { Issue, parseWithStreamParser } from './datalog/parsing/parser';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { parseTokens } from './datalog/dusa-parser';
import { ParsedDeclaration, check } from './datalog/syntax';

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
  name: 'Dusa',
  startState: () => ({ state: dusaTokenizer.startState }),
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

    const result = dusaTokenizer.advance(stream2, cell.state);
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
    const result = dusaTokenizer.advance(stream, cell.state);
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

function position(state: EditorState, pos: SourcePosition) {
  return state.doc.line(pos.line).from + pos.column - 1;
}

function issueToDiagnostic(issues: Issue[]): readonly Diagnostic[] {
  return issues
    .map((issue) => {
      if (!issue.loc) return null;
      return {
        from: position(view.state, issue.loc.start),
        to: position(view.state, issue.loc.end),
        severity: 'error',
        message: issue.msg,
      };
    })
    .filter((issue): issue is Diagnostic => issue !== null);
}

function dusaLinter(view: EditorView): readonly Diagnostic[] {
  const contents = view.state.doc.toString();
  const tokens = parseWithStreamParser(dusaTokenizer, contents);
  if (tokens.issues.length > 0) {
    return issueToDiagnostic(tokens.issues);
  }
  const parsed = parseTokens(tokens.document);
  const parsedIssues = parsed.filter((decl): decl is Issue => decl.type === 'Issue');
  const parsedDecls = parsed.filter((decl): decl is ParsedDeclaration => decl.type !== 'Issue');
  if (parsedIssues.length > 0) {
    return issueToDiagnostic(parsedIssues);
  }
  const checkedDecls = check(parsedDecls);
  return issueToDiagnostic(checkedDecls.errors ?? []);
}

export const editorChangeListener: { current: null | ((update: ViewUpdate) => void) } = {
  current: null,
};

const state = EditorState.create({
  doc: '',
  extensions: [
    parser,
    syntaxHighlighting(classHighlighter),
    lineNumbers(),
    history(),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (editorChangeListener.current !== null) {
        editorChangeListener.current(update);
      }
    }),
    linter(dusaLinter),
    tooltips({ parent: document.body }),
    keymap.of([...defaultKeymap, ...historyKeymap]),
  ],
});
const view = new EditorView({ state, parent: document.getElementById('codemirror-root')! });

export function setEditorContents(contents: string) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: contents },
  });
}

export function getEditorContents() {
  return view.state.doc.toString();
}
