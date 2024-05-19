import ReactDOM from 'react-dom/client';
import { setup, type DOCUMENT, type Inspector as INSPECTOR } from 'sketchzone';

import { codemirrorExtensions } from './codemirror.js';
import {
  CHARACTER_CREATION_EXAMPLE,
  CKY_PARSING_EXAMPLE,
  GRAPH_GENERATION_EXAMPLE,
  ROCK_PAPER_SCISSORS,
} from './examples.js';
import Inspector from './Inspector.js';

function createAndMountInspector(elem: HTMLDivElement, doc: DOCUMENT): INSPECTOR {
  const root = ReactDOM.createRoot(elem);
  root.render(<Inspector doc={doc} visible={true} />);

  return {
    destroy: async () => {
      root.unmount();
      elem.innerText = '';
    },
    unmount: async () => {
      root.render(<Inspector doc={doc} visible={false} />);
    },
    remount: async () => {
      root.render(<Inspector doc={doc} visible={true} />);
    },
  };
}

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
