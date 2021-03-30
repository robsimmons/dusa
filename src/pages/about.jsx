import * as React from "react";

export default function About() {
  return (
    <div className="page">
      <span className="title">About this site</span>
      <p>Welcome to the Glitch React starter, where you can instantly create a React site that's fully customizable.</p>
      <p>
        This page is defined in the router. It's a great spot to tell the world a few details about the new React app you built on Glitch!
      </p>
      <ul>
        <li>🎉 Right now, your site is <strong>live on the web</strong> 🌐 with a real URL (a secure HTTPS address!) that updates as soon as you make changes to your site or app.</li>
        <li>💥 <strong>Add a domain</strong> to your new Glitch project! Just go to the <strong>Tools</strong> menu in the Glitch editor, and click on "Custom Domains"</li>
        <li>🌈 Detail three</li>
      </ul>
      <p>
        Built with <a href="https://reactjs.org/">React</a> and <a href="https://vitejs.dev/">Vite</a> on <a href="https://glitch.com/">Glitch</a>.
      </p>
    </div>
  );
}
