import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";

/**
* Root of react site 
*
* Imports Helmet provider for the page head
* And App which defines the content and navigation
*/



// Render the site https://reactjs.org/docs/react-dom.html#render
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>
);
