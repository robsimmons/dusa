import CodeEditor from './code-editor';
import './defaults.css';
import './dinnik.css';
import './code-editor.css';
import React from 'react';
import DinnikViewer from './DinnikViewer';
import { createSession, deleteSession, getSessions, rememberCurrentSession } from './localstorage';
import { ViewUpdate } from '@codemirror/view';

interface DkTabProps {
  title: string;
  active: boolean;
  solo: boolean;
  onSelect: () => void;
  onDelete: () => void;
}
function DkTab(props: DkTabProps) {
  return (
    <div className={`dk-tab${props.active ? ' dk-tab-active' : ''}`}>
      <button
        className={`dk-tab-button${props.solo ? ' dk-tab-button-solo' : ''}`}
        onClick={props.onSelect}
      >
        {props.title}
      </button>
      {!props.solo && (
        <button className="dk-tab-close" onClick={props.onDelete}>
          <span className="fa-solid fa-xmark" />
        </button>
      )}
    </div>
  );
}

const initialSessions = getSessions();

function getTitleFromContent(content: string) {
  if (content.startsWith('# ')) {
    const index = content.indexOf('\n');
    const title = content.slice(2, index === -1 ? content.length : index).trim();
    return title === '' ? undefined : title;
  }
  return undefined;
}

export default function Editor() {
  const sessions = React.useRef(initialSessions.sessions);
  const [sessionList, setSessionList] = React.useState<{ key: string; title?: string }[]>(
    initialSessions.sessionList.map((key) => {
      const content = sessions.current[key] || '';
      return { key, title: getTitleFromContent(content) };
    }),
  );
  const [currentSession, setCurrentSession] = React.useState(initialSessions.current);

  const getContents = React.useRef<() => string>(() => '');
  const [programModified, setProgramModified] = React.useState<boolean>(true);
  const updateListener = React.useCallback(
    (update: ViewUpdate) => {
      console.log(update);
      setProgramModified(true);
      // TODO: debounce this a little bit
      const contents = update.state.doc.toString();
      localStorage.setItem(`dinnik-session-${currentSession}`, contents);
      sessions.current[currentSession] = contents;
      const newTitle = getTitleFromContent(contents);
      if (sessionList.some(({ key, title }) => key === currentSession && title !== newTitle)) {
        console.log(`setting session list`);
        setSessionList(
          sessionList.map((item) =>
            item.key === currentSession ? { key: item.key, title: newTitle } : item,
          ),
        );
      }
    },
    [setProgramModified, currentSession],
  );

  React.useEffect(() => {
    rememberCurrentSession(currentSession);
  }, [currentSession]);

  return (
    <div className="dk-main">
      <div className="dk-frame">
        <div className="dk-sessions">
          <div className="dk-header">
            <div className="dk-tabs">
              {sessionList.map(({ key, title }) => {
                return (
                  <DkTab
                    title={title ?? '<untitled>'}
                    key={key}
                    active={key === currentSession}
                    solo={sessionList.length <= 1}
                    onSelect={() => setCurrentSession(key)}
                    onDelete={() => {
                      const { removed, newSessionList } = deleteSession(sessionList, key);
                      setSessionList(newSessionList);
                      if (key === currentSession) {
                        setCurrentSession(
                          removed === newSessionList.length
                            ? newSessionList[removed - 1].key
                            : newSessionList[removed].key,
                        );
                      }
                    }}
                  />
                );
              })}
              <button
                onClick={() => {
                  const uuid = createSession(sessionList);
                  setCurrentSession(uuid);
                  setSessionList((sessionList) => [...sessionList, { key: uuid }]);
                }}
              >
                addSession
              </button>
            </div>
            <div className="dk-logo">Dinnik</div>
          </div>
          <div className="dk-session">
            <div className="dk-edit">
              {
                <CodeEditor
                  key={currentSession}
                  contents={sessions.current[currentSession] || ''}
                  getContents={getContents}
                  updateListener={updateListener}
                />
              }
            </div>
            <div className="dk-drag"></div>
            <DinnikViewer
              uuid={currentSession}
              getProgram={() => {
                setProgramModified(false);
                return getContents.current();
              }}
              programModified={programModified}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
