import * as React from "react";

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
  const handleChangeHello = () => {
    // Choose a new Hello from our languages
    const newHello = randomLanguage();
    // And set it in our components state
    setHello(newHello);
  };
  return (
    <>
      <span className="title">{hello}!</span>
      <img
        src="/illustration.svg"
        className="illustration"
        onClick={handleChangeHello}
        alt="Illustration click to change language"
      />
      <nav className="navigation">
        <button className="btn--remix" onClick={handleChangeHello}>
          Pssst, click me
        </button>
      </nav>
    </>
  );
}
