import React, { useState, useEffect } from "react";
import { Link } from "wouter";

// Import and apply CSS stylesheet
import "./styles/styles.css";

// Where all of our pages come from
import Router from "./components/router.jsx";

// The component that adds our Meta tags to the page
import Seo from './components/seo.jsx';


export default function Home() {
  return (
    <>
      <Seo />
      <main role="main" className="wrapper">
        <div className="content">
          <Router />
        </div>
      </main>
      <footer className="footer">
        <ul className="links">
          <li><Link href="/">Home</Link></li>
          <li><Link href="/about">About</Link></li>
        </ul>
        <a
          className="btn--remix"
          href="https://glitch.com/edit/#!/remix/glitch-hello-react"
        >
          <img src="https://cdn.glitch.com/a9975ea6-8949-4bab-addb-8a95021dc2da%2FLogo_Color.svg?v=1602781328576" alt="Glitch logo" />
          Remix on Glitch
        </a>
      </footer>
    </>
  );
}
