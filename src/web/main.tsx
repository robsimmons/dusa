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


await setup({
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

/* import React from 'react';
import ReactDOM from 'react-dom/client';
import Tabs from './Tabs.js';
import Config from './Config.js';
import { editorChangeListener, getEditorContents, setEditorContents } from './codemirror.js';
import { sessionManager } from './sessions.js';
import Program from './SolutionsExplorer.js';
import * as Tooltip from '@radix-ui/react-tooltip';
import { LS_SESSION_DIVIDER_PROPORTION } from './constants.js';

async function addSession() {
  syncronizeCodeMirror();
  await sessionManager.add();
  setEditorContents(sessionManager.activeText);
  renderTabs();
  renderView();
}

async function selectSession(uuid: string) {
  syncronizeCodeMirror();
  await sessionManager.setActiveKey(uuid);
  setEditorContents(sessionManager.activeText);
  renderTabs();
  renderView();
}

async function deleteSession(uuid: string) {
  syncronizeCodeMirror();
  const index = sessionManager.list.indexOf(uuid);
  if (index === -1) return;
  if (uuid === sessionManager.activeKey) {
    if (index === sessionManager.list.length - 1) {
      await sessionManager.setActiveKey(sessionManager.list[index - 1]);
    } else {
      await sessionManager.setActiveKey(sessionManager.list[index + 1]);
    }
    setEditorContents(sessionManager.activeText);
  }
  sessionManager.list = sessionManager.list
    .slice(0, index)
    .concat(sessionManager.list.slice(index + 1));
  renderTabs();
  renderView();
}

let alerted = false;
function share() {
  syncronizeCodeMirror();
  window.location.hash = `#program=${encodeURIComponent(sessionManager.activeText)}`;
  try {
    navigator.clipboard.writeText(`${window.location}`).then(
      () => {
        if (!alerted) {
          alerted = true;
          alert('Sharable link copied to clipboard');
        }
      },
      () => {
        alert(
          'Unable to copy sharable URL to clipboard, but you can copy the link from your address bar',
        );
      },
    );
  } catch {
    alert(
      'Unable to copy sharable URL to clipboard, but you can copy the link from your address bar',
    );
  }
}

const config = ReactDOM.createRoot(document.getElementById('config-root')!);
config.render(
  <React.StrictMode>
    <Tooltip.Provider>
      <Config share={share} />
    </Tooltip.Provider>
  </React.StrictMode>,
);

const tabs = ReactDOM.createRoot(document.getElementById('dk-tabs')!);
function renderTabs() {
  tabs.render(
    <React.StrictMode>
      <Tabs
        activeSessionKey={sessionManager.activeKey}
        sessions={sessionManager.tabInfo}
        addSession={addSession}
        deleteSession={deleteSession}
        selectSession={selectSession}
      />
    </React.StrictMode>,
  );
}
setEditorContents(sessionManager.activeText);
renderTabs();

const view = ReactDOM.createRoot(document.getElementById('react-root')!);
function renderView() {
  view.render(
    <React.StrictMode>
      <Program
        session={sessionManager.session}
        load={() => {
          syncronizeCodeMirror();
          sessionManager.loadProgram().then(() => {
            renderView();
          });
        }}
        run={() => {
          sessionManager.runProgram().then(() => {
            renderView();
          });
        }}
        pause={() => {
          sessionManager.suspendProgram().then(() => {
            renderView();
          });
        }}
        setSolution={(index) => {
          sessionManager.setSolution(index).then(() => {
            renderView();
          });
        }}
      />
    </React.StrictMode>,
  );
}
renderView();

function inspectionLoop() {
  sessionManager.queryProgram().then((isRunning) => {
    if (isRunning) renderView();
    setTimeout(inspectionLoop, 100);
  });
}
inspectionLoop();

const EDITOR_SYNC_DEBOUNCE_MS = 100;
let currentSyncTimeout: ReturnType<typeof setTimeout> | null = null;
editorChangeListener.current = () => {
  if (currentSyncTimeout !== null) {
    clearTimeout(currentSyncTimeout);
  }
  renderView();
  currentSyncTimeout = setTimeout(() => {
    currentSyncTimeout = null;
    syncronizeCodeMirror();
  }, EDITOR_SYNC_DEBOUNCE_MS);
};

function syncronizeCodeMirror() {
  if (currentSyncTimeout !== null) {
    clearTimeout(currentSyncTimeout);
    currentSyncTimeout = null;
  }
  sessionManager.activeText = getEditorContents();
  renderTabs();
  renderView();
}

let referenceSessionDividerStatus: null | {
  mouseDownX: number;
  currentDeltaX: number;
  initialTextWidth: number;
  initialEngineWidth: number;
} = null;
const MIN_PANE_PIXEL = 250;
function sessionDividerMove(event: MouseEvent) {
  const { mouseDownX, initialTextWidth, initialEngineWidth } = referenceSessionDividerStatus!;
  const deltaX = event.clientX - mouseDownX;
  let newTextWidth = initialTextWidth + deltaX;
  if (initialTextWidth + deltaX < MIN_PANE_PIXEL) {
    newTextWidth = MIN_PANE_PIXEL;
  } else if (initialEngineWidth - deltaX < MIN_PANE_PIXEL) {
    newTextWidth = initialTextWidth + initialEngineWidth - MIN_PANE_PIXEL;
  }
  bodyRoot.style.setProperty('--text-editor-panel-width', `${newTextWidth}px`);
  referenceSessionDividerStatus!.currentDeltaX = newTextWidth - initialTextWidth;
}

function sessionDividerStop() {
  window.removeEventListener('mousemove', sessionDividerMove);
  window.removeEventListener('mouseup', sessionDividerStop);
  const { currentDeltaX, initialTextWidth, initialEngineWidth } = referenceSessionDividerStatus!;
  const newTextWidth = initialTextWidth + currentDeltaX;
  const newEngineWidth = initialEngineWidth - currentDeltaX;
  setDividerProportion(newTextWidth / newEngineWidth);
  localStorage.setItem(LS_SESSION_DIVIDER_PROPORTION, `${newTextWidth / newEngineWidth}`);
}

function setDividerProportion(fr: number) {
  bodyRoot.style.setProperty('--text-editor-panel-width', `minmax(${MIN_PANE_PIXEL}px, ${fr}fr)`);
}

const bodyRoot = document.getElementById('root')!;
const sessionRoot = document.getElementById('session')!;
const codemirrorRoot = document.getElementById('codemirror-root')!;
const sessionDivider = document.getElementById('session-divider')!;
const engineRoot = document.getElementById('react-root')!;
sessionDivider.addEventListener('mousedown', (event) => {
  event.preventDefault();
  referenceSessionDividerStatus = {
    mouseDownX: event.clientX,
    currentDeltaX: 0,
    initialTextWidth: codemirrorRoot.getBoundingClientRect().width,
    initialEngineWidth: engineRoot.getBoundingClientRect().width,
  };
  window.addEventListener('mousemove', sessionDividerMove);
  window.addEventListener('mouseup', sessionDividerStop);
  const actualWidth = codemirrorRoot.getBoundingClientRect().width;
  const bodyStyle = document.getElementById('root')!.style;
  bodyStyle.setProperty('--text-editor-panel-width', `${actualWidth}px`);
});

let dividerProportion = parseFloat(localStorage.getItem(LS_SESSION_DIVIDER_PROPORTION) ?? '1');
if (isNaN(dividerProportion)) dividerProportion = 1;
setDividerProportion(dividerProportion);
sessionRoot.style.setProperty('display', 'grid');
*/
