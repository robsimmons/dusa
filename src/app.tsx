import React from "react";

import "./styles.css";

import { VirtuRobDomNode, parse } from "./virturob-dom";

export default function App() {
  //const [currentVD, setCurrentVD] = React.useState<VirtuRobDomNode[]>([]);
  const [parseOutput, setParseOutput] = React.useState<
    | { success: true; value: VirtuRobDomNode[] }
    | { success: false; value: string }
  >({ success: true, value: [] });
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
      setParseOutput({ success: true, value: parse(text) });
    } catch (e) {
      setParseOutput({ success: false, value: `${e}` });
    }
  }, text);

  return (
    <>
      <textarea
        onChange={(event) => setText(event.target.value)}
        value={text}
      />
      {!parseOutput.success && (
        <div className="errorMsg">{parseOutput.value}</div>
      )}
      <div ref={ref}></div>
    </>
  );
}
