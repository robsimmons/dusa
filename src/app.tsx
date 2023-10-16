import React from "react";

import './styles.css'



export default function App() {
  const [text, setText] = React.useState(
    `(div 
  (list "abc" "def" (div "xyz")) 
  "whatever 1" 
  (div "whatever 2") 
  "whatever 3")`
  );
  
  return (
    <>
      <textarea onChange={(event) => setText(event.target.value)} value={text} />
    </>
  );
}
