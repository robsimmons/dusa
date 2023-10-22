import CodeEditor from './code-editor';
import './defaults.css';
import './dinnik.css';
import './code-editor.css';
import React from 'react';
import { dinnikTokenizer } from './datalog/parser/dinnik-tokenizer';
import { parse } from './datalog/parser/dinnik-parser';
import { parseWithStreamParser } from './datalog/parsing/parser';
import { ViewUpdate } from '@codemirror/view';

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
  const [rhs, setRhs] = React.useState<string>('Blah');

  const debounceRef = React.useRef<number | undefined>();

  function updateListener(update: ViewUpdate) {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const contents = update.state.doc.toString();
      const tokens = parseWithStreamParser(dinnikTokenizer, contents);
      if (tokens.issues.length > 0) {
        setRhs(JSON.stringify(tokens.issues));
      }
    }, 5000);
  }

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
              <CodeEditor getContents={getContents} updateListener={updateListener} />
              <div className="dk-edit-menu">
                <button
                  className="dk-go"
                  onClick={() => {
                    if (getContents.current === null) {
                      setRhs('Error');
                    } else {
                      const contents = getContents.current();
                      const tokens = parseWithStreamParser(dinnikTokenizer, contents);
                      try {
                        setRhs(JSON.stringify(parse(tokens.document)));
                      } catch (e) {
                        setRhs(`${e}`);
                      }
                    }
                  }}
                >
                  <span className="fa-solid fa-right-to-bracket"></span>
                </button>
              </div>
            </div>
            <div className="dk-drag"></div>
            <div className="dk-view">{rhs}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
