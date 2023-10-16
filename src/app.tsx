import React from "react";

import "./styles.css";

import { VirtuRobDomNode, parse, createDom } from "./virturob-dom";

export default function App() {
  const [currentVD, setCurrentVD] = React.useState<{
    text: string;
    value: VirtuRobDomNode[];
  }>({ text: "", value: [] });
  const [parseOutput, setParseOutput] = React.useState<
    | { success: true; value: VirtuRobDomNode[]; instructions: string[] }
    | { success: false; value: string }
  >({ success: true, value: [], instructions: [] });
  const [text, setText] = React.useState(
    `(div 
  (unordered_list 
    (list_item "abc")
    (list_item "def")
    (list_item (div "xyz"))) 
  "whatever 1" 
  (div "whatever 2") 
  "whatever 3")`
  );
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    try {
      const vDom = parse(text);
      setParseOutput({
        success: true,
        value: vDom,
        instructions: [
          'const root = document.getElementById("robs-root");',
        ].concat(createDom([], vDom)),
      });
    } catch (e) {
      setParseOutput({ success: false, value: `${e}` });
    }
  }, [text]);

  function runInstructions() {
    if (!parseOutput.success) {
      return;
    }
    eval(parseOutput.instructions.join("\n"));
  }

  return (
    <main>
      <div className="currently-rendered">
        <h3>Current DOM ZONE contents as a VirtuRob DOM</h3>
        <textarea disabled value={}></textarea>
      </div>
      <div />

      <div className="next-in-dom">
        <h3>New VirtRob Dom</h3>
        <textarea
          onChange={(event) => setText(event.target.value)}
          value={text}
        />
      </div>
      <div className="instructions">
        {!parseOutput.success && (
          <div className="errorMsg">{parseOutput.value}</div>
        )}
        {parseOutput.success && (
          <>
            <h3>Instructions for updating THE DOM ZONE</h3>
            <button onClick={runInstructions}>Run These Instructions</button>
            <pre>{parseOutput.instructions.join("\n")}</pre>
          </>
        )}
      </div>
      <div></div>

      <div>
        <h3>THE DOM ZONE</h3>
        <div id="robs-root" ref={ref}></div>
      </div>
    </main>
  );
}
