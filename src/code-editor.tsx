import React from 'react';
import { StreamLanguage } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';

/** Create a Codemirror-compliant parser from our streamparser.
 * The token method is given a Codemirror-style StringStream,
 * and we have to use that to implement the StringStream interface
 * that our parser expects. Because we're not using the syntax
 * tree, we can feed bogus SourceLocation information to matchedLocation.
 */
const parser = StreamLanguage.define<{ state: ParserState }>({
  name: 'Camperdown',
  startState: () => ({ state: camperdownParser.startState }),
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

    const result = camperdownParser.advance(stream2, cell.state);
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
    const result = camperdownParser.advance(stream, cell.state);
    cell.state = result.state;
  },
  copyState: ({ state }) => ({ state }),
  indent: () => null,
  languageData: {},
  tokenTable: {},
});

export default function CodeEditor() {
  const editor = React.useRef(null);

  React.useEffect(() => {
    const state = EditorState.create({
      doc: 'xyz\nabc\nef\n\nx\n\nabc\n\n\na',
      extensions: [lineNumbers()],
    });
    const view = new EditorView({ state, parent: editor.current ?? undefined });
    return () => view.destroy();
  }, []);

  return <div className="dk-editor-parent" ref={editor}></div>;
}
