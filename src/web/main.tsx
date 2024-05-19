import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';

import { setup } from 'sketchzone';
import { syntaxHighlighting } from '@codemirror/language';
import { classHighlighter } from '@lezer/highlight';
import {
  CHARACTER_CREATION_EXAMPLE,
  CKY_PARSING_EXAMPLE,
  GRAPH_GENERATION_EXAMPLE,
  ROCK_PAPER_SCISSORS,
} from './examples.js';

import { parser } from './codemirror.js';
import createAndMountInspector from './inspector.js';

setup({
  createAndMountInspector,
  extractTitleFromDoc: (doc) => {
    if (doc.startsWith('# ')) {
      const newLineIndex = doc.indexOf('\n');
      return newLineIndex === -1 ? doc.slice(2) : doc.slice(2, newLineIndex);
    }
    return '<untitled>';
  },
  codemirrorExtensions: [
    parser,
    syntaxHighlighting(classHighlighter),
    lineNumbers(),
    history(),
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap]),
  ],
  defaultEntries: [
    CHARACTER_CREATION_EXAMPLE,
    CKY_PARSING_EXAMPLE,
    ROCK_PAPER_SCISSORS,
    GRAPH_GENERATION_EXAMPLE,
  ],
  appName: 'Dusa',
  infoUrl: '/docs/',
});
