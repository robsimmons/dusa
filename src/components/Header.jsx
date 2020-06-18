import React from "react";
import Role from "./Role";

const Header = ({ roleList, filterRole, toggleFilterRole }) => (
  <div id="home" className="p-4 pt-0 md:p-8 md:ml-8">
    <div className="container mx-auto flex md:py-6 grid sm:grid-cols-1 md:grid-cols-2 gap-4 items-center">
      <div
        className="md:border-r-2 justify-center"
        style={{ borderColor: "#5A78FF" }}
      >
        <div className="pl-4 pr-8">
          <h1 className="inline text-3xl sm:text-4xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold tracking-wide leading-snug">
            React Prototype!!
          </h1>
          <h2 className="text-xl font-bold">A subheader, cool</h2>
        </div>
      </div>
      <div className="pl-4 pb-8">
        <strong>Welcome to my prototype.</strong> This is an prototype of:
        <ul className="list-disc ml-6">
          <li>React with hot module reloading</li>
          <li>PostCSS</li>
          <li>Snowpack</li>
          <li>Tailwind CSS</li>
          <li>
            API Fetching (airtable-api.glitch.me:{" "}
            <strong>not in this project</strong>)
          </li>
          <li>
            Production bundle & deployment (right now goes to firebase, but as
            an example of the kind of workflow we could build, was easier than
            sending to s3)
          </li>
        </ul>
        <p>
          This is the <strong>development server</strong>, which runs all of the
          above. Once you run <strong>npm run deploy</strong> it will bundle it
          all up, and deploy it to firebase.
        </p>
      </div>
    </div>
  </div>
);

export default Header;
