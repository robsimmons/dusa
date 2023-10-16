import React from "react";

import "./styles.css";

import { VirtuRobDomNode, parse, createDom } from "./virturob-dom";

export default function App() {
  //const [currentVD, setCurrentVD] = React.useState<VirtuRobDomNode[]>([]);
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
        instructions: createDom([], vDom),
      });
    } catch (e) {
      setParseOutput({ success: false, value: `${e}` });
    }
  }, [text]);

  function runInstructions() {
    if (!parseOutput.success) {
      return;
    }
    eval(
      'const root = document.getElementById("robs-root");' +
      'console.log(root);' + 'window.foo = 99;' +
        parseOutput.instructions.join("\n")
    );
  }

  return (
    <main>
      <div className="currently-rendered">
        <h3>Currently In The Dom</h3>
        <textarea disabled value={'a'}></textarea>
      </div>
      
      <div className="next-in-dom">
        <h3>New Stuff For Dom</h3>
            <textarea
        onChange={(event) => setText(event.target.value)}
        value={text}
      />

      </div>
      {!parseOutput.success && (
        <div className="errorMsg">{parseOutput.value}</div>
      )}
      {parseOutput.success && (
        <>
          <pre>{parseOutput.instructions.join("\n")}</pre>
          <button onClick={runInstructions}>Run These Instructions</button>
        </>
      )}

      <div id="robs-root" ref={ref}></div>
    </main>
  );
}
