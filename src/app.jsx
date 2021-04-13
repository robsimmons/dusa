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
        <div className="links">
          <Link href="/">Home</Link>
          <span className="divider">|</span>
          <Link href="/about">About</Link>
        </div>
        <a
          className="btn--remix"
          target="_top"
          href="https://glitch.com/edit/#!/remix/glitch-hello-react"
        >
          <img src="https://cdn.glitch.com/605e2a51-d45f-4d87-a285-9410ad350515%2FLogo_Color.svg?v=1618199565140" alt="" />
          Remix on Glitch
        </a>
      </footer>
    </>
  );
}
