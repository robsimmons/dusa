import * as React from "react";

export default function About() {
  return (
    <div className="page">
      <h1 className="title">About this site</h1>
      <p>
        Welcome to the Glitch React starter, where you can instantly create a
        React site that's fully customizable.
      </p>
      <p>
        This page is a great spot to tell the world a few details about the new
        React app you built on Glitch! The content is defined in the router.
        Check out your project's <code>readme</code> file to learn more about
        how to customize your contnet.
      </p>
      <ul>
        <li>
          🎉 Right now, your site is <strong>live on the web</strong> 🌐 with a
          real URL (a secure HTTPS address!) that updates as soon as you make
          changes to your site or app.
        </li>
        <li>
          💥 <strong>Add a domain</strong> to your new Glitch project! Just go
          to the <strong>Tools</strong> menu in the Glitch editor, and click on
          "Custom Domains"
        </li>
        <li>
          🌈 Use the <strong>Share</strong> button in the Glitch editor to
          invite others in to edit your new React project by typing in their
          email address or Glitch username. <br />( <strong>Tip:</strong> 👀Make
          your code, or even your entire app, private to just those you invite,
          just by{" "}
          <a href="https://glitch.com/pricing">upgrading your Glitch account</a>
          .)
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
