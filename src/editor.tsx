import CodeEditor from './code-editor';
import './defaults.css';
import './dinnik.css';
import './code-editor.css';
import React from 'react';
import DinnikViewer from './viewer';

interface DkTabProps {
  title: string;
  active?: boolean;
}

function DkTab(props: DkTabProps) {
  return (
    <div className={`dk-tab${props.active ? ' dk-tab-active' : ''}`}>
      <button className="dk-tab-button">{props.title}</button>
      <button className="dk-tab-close">x</button>
    </div>
  );
}

const EX = `a is { 1, 2, 3, 4, 5, 6, 7 }.
b is { -1, 2, -3, 4, -5, 6, -6 }.
c is { 1, 2, 3, 4, 5, 6, 7 }.
c is (plus A B) :- a is A, b is B.`;

export default function Editor() {
  const getContents = React.useRef<(() => string) | null>(null);
  const [program, setProgram] = React.useState<string | null>(null);

  return (
    <div className="dk-main">
      <div className="dk-frame">
        <div className="dk-sessions">
          <div className="dk-header">
            <div className="dk-tabs">
              <DkTab title="Graph Connectivity" />
              <DkTab title="ASP-like" />
              <DkTab title="Integers" active />
              <DkTab title="Natural Numbers" />
            </div>
            <div className="dk-logo">Dinnik</div>
          </div>
          <div className="dk-session">
            <div className="dk-edit">
              <CodeEditor getContents={getContents} updateListener={() => {}} />
              <div className="dk-edit-menu">
                <button
                  className="dk-go"
                  onClick={() => {
                    if (getContents.current === null) {
                      setProgram(null);
                    } else {
                      setProgram(getContents.current());
                    }
                  }}
                >
                  <span className="fa-solid fa-right-to-bracket"></span>
                </button>
              </div>
            </div>
            <div className="dk-drag"></div>
            <DinnikViewer program={program} />
          </div>
        </div>
      </div>
    </div>
  );
}
