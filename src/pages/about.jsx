import * as React from "react";
/* ADD IMPORTS FROM TODO ON THE NEXT LINE */


/**
* The About function defines the component that makes up the About page
* This component is attached to the /about path in router.jsx
*/

export default function About() {
  /* DECLARE STYLE AND TRIGGER FOR WIGGLE EFFECT FROM TODO ON NEXT LINE */
  
  return (
    <div className="page">
      {/* REPLACE H1 ELEMENT BELOW WITH CODE FROM TODO */}
      <h1 className="title">
        About this site
      </h1>
      {/* REPLACE OPENING P TAG BELOW WITH CODE FROM TODO */}
      <p>
        Welcome to the Glitch React starter, where you can instantly create a
        React site that's fully customizable.
      </p>
      <p>
        <em>
          If you're completely new to React, learning the{" "}
          <a href="https://reactjs.org/docs/hello-world.html">main concepts</a>{" "}
          will get you off to a great start. You'll also see comments and links
          to supporting resources throughout the code.
        </em>
      </p>
      <p>
        This page is a great spot to tell the world a few details about the new
        React app you built on Glitch! Check out your project's{" "}
        <code>readme</code> file to learn more about how to customize your
        content.
      </p>
      <ul>
        <li>
          🎉 Right now, your site is <strong>live on the web</strong> 🌐 with a
          real URL (a secure HTTPS address!) that updates as soon as you make
          changes.
        </li>
        <li>
          💥 <strong>Add a domain</strong> to your new Glitch project! Just go
          to the <strong>Tools</strong> menu in the Glitch editor, and click{" "}
          <strong>Custom Domains</strong>.
        </li>
        <li>
          🌈 Use the <strong>Share</strong> button in the Glitch editor to
          invite others in to edit your new React project by typing in their
          email address or Glitch username. <br /> <strong>Tip:</strong> 👀Make
          your code, or even your entire app, private to just those you invite,
          by{" "}
          <a href="https://glitch.com/pricing">upgrading your Glitch account</a>
          .
        </li>
      </ul>

      <p>
        {" "}
        The Glitch community is glad to welcome you, and the Internet is better
        when it's made by real people. We can't wait to see what you create!
      </p>
      <p>
        Built with <a href="https://reactjs.org/">React</a> and{" "}
        <a href="https://vitejs.dev/">Vite</a> on{" "}
        <a href="https://glitch.com/">Glitch</a>.
      </p>
    </div>
  );
}
