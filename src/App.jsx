import React, { useState, useEffect } from "react";
import './styles.css'

import illustration from './illustration.svg';


export default function Home() {
  return (
    <>
    <div className="wrapper">
      <div className="content">
        <span className="title">Hello react!</span>
      </div>
      <img src={illustration} className="illustration" />
    </div>
    <div className="navigation">
      <div>
        <button className="btn--remix">
          <img
            src="https://cdn.glitch.com/a9975ea6-8949-4bab-addb-8a95021dc2da%2FLogo_Color.svg?v=1602781328576"
          />
          Remix on Glitch
        </button>
      </div>
    </div>
  </>
  );
}
