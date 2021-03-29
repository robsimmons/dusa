import * as React from "react";

export default function About() {
  return (
    <div className="page">
      <span className="title">About this site</span>
      <p>
        Here's a great spot to tell the world a few details about the new React app you built on Glitch!
      </p>
      <ul>
        <li>🎉 Detail one</li>
        <li>💥 Detail two</li>
        <li>🌈 Detail three</li>
      </ul>
      <p>
        Built with <a href="https://reactjs.org/">React</a> and <a href="https://vitejs.dev/">Vite</a> on <a href="https://glitch.com/">Glitch</a>.
      </p>
    </div>
  );
}
