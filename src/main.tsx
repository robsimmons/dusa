import React from 'react';
import ReactDOM from 'react-dom/client';
import Tabs from './Tabs.tsx';
import Config from './Config.tsx';
import { editorChangeListener, getEditorContents, setEditorContents } from './codemirror';
import { sessionManager } from './sessions.ts';
import Program from './Program.tsx';

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

const config = ReactDOM.createRoot(document.getElementById('config-root')!);
config.render(<React.StrictMode><Config/></React.StrictMode>)

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

const EDITOR_SYNC_DEBOUNCE_MS = 10;
let currentSyncTimeout: ReturnType<typeof setTimeout> | null = null;
editorChangeListener.current = () => {
  if (currentSyncTimeout !== null) {
    clearTimeout(currentSyncTimeout);
  }
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
