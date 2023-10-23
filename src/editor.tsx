import CodeEditor from './code-editor';
import './defaults.css';
import './dinnik.css';
import './code-editor.css';
import React from 'react';
import DinnikViewer from './viewer';

/* 
interface DkTabProps {
  title: string;
  active?: boolean;
}

              <DkTab title="Graph Connectivity" />
              <DkTab title="ASP-like" />
              <DkTab title="Integers" active />
              <DkTab title="Natural Numbers" />

              function DkTab(props: DkTabProps) {
  return (
    <div className={`dk-tab${props.active ? ' dk-tab-active' : ''}`}>
      <button className="dk-tab-button">{props.title}</button>
      <button className="dk-tab-close">x</button>
    </div>
  );
}
*/

const EXAMPLE_PROGRAM = `
character celeste.
character nimbus.
character terra.
character luna.

# Ensure two characters have different races
char1 is { X... } :- character X.
char2 is { X... } :- character X.
:- char1 is C1, char2 is C2, 
   C1 == C2.
:- char1 is C1, char2 is C2,
   char1 is R, char2 is R.

# Characters have one of four homes and one of four races
home C is {
  uplands,
  lowlands,
  catlands,
  doghouse
} :- character C.
race C is {
  cat,
  dog,
  horse,
  bird
} :- character C.

# Birds only live in the uplands
home C is uplands :- race C is bird.

# Only dogs live in the doghouse
race C is dog :- home C is doghouse.

# Nimbus and celeste must have the same home & race
:- home nimbus is H1, home celeste is H2, H1 != H2.
:- race nimbus is R1, race celeste is R2, R1 != R2.

# Luna and terra can't live in the same place
:- home luna is H, home terra is H.

# Only room for one in the doghouse
:- home C1 is doghouse, home C2 is doghouse, C1 != C2.`.trim();

export default function Editor() {
  const getContents = React.useRef<() => string>(() => '');
  const [programModified, setProgramModified] = React.useState<boolean>(true);
  const [contents, setContents] = React.useState<string | null>(null);

  React.useEffect(() => {
    const program = localStorage.getItem('default-text') ?? EXAMPLE_PROGRAM;
    setContents(program);
  }, []);

  return (
    <div className="dk-main">
      <div className="dk-frame">
        <div className="dk-sessions">
          <div className="dk-header">
            <div className="dk-tabs"></div>
            <div className="dk-logo">Dinnik</div>
          </div>
          <div className="dk-session">
            <div className="dk-edit">
              {contents !== null && (
                <CodeEditor
                  contents={contents}
                  getContents={getContents}
                  updateListener={(update) => {
                    setProgramModified(true);
                    // TODO: debounce this a little bit
                    localStorage.setItem('default-text', update.state.doc.toString());
                  }}
                />
              )}
            </div>
            <div className="dk-drag"></div>
            <DinnikViewer
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

/**
 * 
 * <!--
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
                </button> -->
 * 
 */
