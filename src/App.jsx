import React, { useState, useEffect } from "react";

// Import and apply our CSS stylesheet
import "./styles.css";

// You can import SVG files directly
import illustration from "./illustration.svg";

// Our language strings
const strings = ["Hello React", "Bonjour React", "Hola React", "안녕 React", "Hej React"];

// Utility function to choose a random value from the language array
function randomLanguage() {
  return strings[Math.floor(Math.random() * strings.length)];
}

export default function Home() {
  const [hello, setHello] = useState(strings[0]);
  const handleChangeHello = () => {
    // Choose a new Hello from our languages
    const newHello = randomLanguage();
    // And set it in our components state
    setHello(newHello);
  };
  return (
    <>
      <div className="wrapper">
        <div className="content">
          <span className="title">{hello}!</span>
          <img
            src={illustration}
            className="illustration"
            onClick={handleChangeHello}
            alt="Illustration click to change language"
          />
        </div>
      </div>
      <nav className="navigation">
        <button className="btn--remix" onClick={handleChangeHello}>
          Pssst, click me
        </button>
        <button className="btn--remix">
          <img src="https://cdn.glitch.com/a9975ea6-8949-4bab-addb-8a95021dc2da%2FLogo_Color.svg?v=1602781328576" />
          Remix on Glitch
        </button>
      </nav>
    </>
  );
}
