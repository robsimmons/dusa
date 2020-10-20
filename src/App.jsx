import React, { useState, useEffect } from "react";

// Import and apply our CSS stylesheet
import "./styles.css";

// You can import SVG files directly
import illustration from "./illustration.svg";

// Our language strings
const hellos = ["Hello React", "Bonjour React", "Hola React"];


export default function Home() {
  const [hello, setHello] = useState(hellos[0]);
  const handleChangeHello = () => {
    const newHello = hellos[1];
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
            alt="Browser screen showing"
          />
          <span>Pssst: Click the illustration to change the Hello World language!</span>
        </div>
      </div>
      <div className="navigation">
        <div>
          <button className="btn--remix">
            <img src="https://cdn.glitch.com/a9975ea6-8949-4bab-addb-8a95021dc2da%2FLogo_Color.svg?v=1602781328576" />
            Remix on Glitch
          </button>
        </div>
      </div>
    </>
  );
}
