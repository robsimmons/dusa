import React from "react";
import { VirtuRobDomNode, diffDom } from "./virturob-dom";
import { parse } from "./parser";

import "./styles.css";

export default function App() {
  const [x, setX] = React.useState(null);
  
  React.useEffect(() => {
    setX('world');
  }, []);
  
  return <>Hello {x}</>;
}
