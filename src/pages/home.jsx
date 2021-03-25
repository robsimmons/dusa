import * as React from "react";
import { animated } from 'react-spring'
import { useWiggle } from '../hooks/wiggle'

// Our language strings
const strings = [
  "Hello React",
  "Bonjour React",
  "Hola React",
  "안녕 React",
  "Hej React"
];

// Utility function to choose a random value from the language array
function randomLanguage() {
  return strings[Math.floor(Math.random() * strings.length)];
}

export default function Home() {
  const [hello, setHello] = React.useState(strings[0]);
  const [style, trigger] = useWiggle({ x: 10, y: 10, scale: 1 })
  
  
  const handleChangeHello = () => {
    // Choose a new Hello from our languages
    const newHello = randomLanguage();
    // And set it in our components state
    setHello(newHello);
  };
  return (
    <>
      <span className="title">{hello}!?</span>
      <animated.div onMouseEnter={trigger} style={style}>
      <img
        src="/illustration.svg"
        className="illustration"
        onClick={handleChangeHello}
        alt="Illustration click to change language"
      />
      </animated.div>
      <nav className="navigation">
        <a className="btn--click-me" onClick={handleChangeHello}>
          Pssst, click me
        </a>
      </nav>
    </>
  );
}
