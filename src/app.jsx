import React, { useState, useEffect } from "react";
import { Link } from "wouter";

// Import and apply CSS stylesheet
import "./styles/styles.css";

// Where all of our pages come from
import Router from "./components/router.jsx";


export default function Home() {
  return (
    <>
      <div className="wrapper">
        <div className="content">
          <Router />
        </div>
      </div>
      <footer className="footer">
        <div className="links">
          <Link href="/">Home</Link>
          <span className="divider">|</span>
          <Link href="/how-to-use">How to Use</Link>
        </div>
        <a
          className="btn--remix"
          href="https://glitch.com/edit/#!/remix/glitch-hello-eleventy"
        >
          <img src="https://cdn.glitch.com/a9975ea6-8949-4bab-addb-8a95021dc2da%2FLogo_Color.svg?v=1602781328576" />
          Remix on Glitch
        </a>
      </footer>
    </>
  );
}
