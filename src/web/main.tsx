import { setup } from 'sketchzone';

import { codemirrorExtensions } from './codemirror.js';
import {
  CHARACTER_CREATION_EXAMPLE,
  CKY_PARSING_EXAMPLE,
  GRAPH_GENERATION_EXAMPLE,
  ROCK_PAPER_SCISSORS,
} from './examples.js';
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
  codemirrorExtensions: codemirrorExtensions,
  defaultEntries: [
    CHARACTER_CREATION_EXAMPLE,
    CKY_PARSING_EXAMPLE,
    ROCK_PAPER_SCISSORS,
    GRAPH_GENERATION_EXAMPLE,
  ],
  appName: 'Dusa',
  infoUrl: '/docs/',
});
