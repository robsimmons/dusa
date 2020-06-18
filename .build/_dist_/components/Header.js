import React from "/web_modules/react.js";
import Role from "./Role.js";

const Header = ({
  roleList,
  filterRole,
  toggleFilterRole
}) => /*#__PURE__*/React.createElement("div", {
  id: "home",
  className: "p-4 pt-0 md:p-8 md:ml-8"
}, /*#__PURE__*/React.createElement("div", {
  className: "container mx-auto flex md:py-6 grid sm:grid-cols-1 md:grid-cols-2 gap-4 items-center"
}, /*#__PURE__*/React.createElement("div", {
  className: "md:border-r-2 justify-center",
  style: {
    borderColor: "#5A78FF"
  }
}, /*#__PURE__*/React.createElement("div", {
  className: "pl-4 pr-8"
}, /*#__PURE__*/React.createElement("h1", {
  className: "inline text-3xl sm:text-4xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold tracking-wide leading-snug"
}, "React Prototype!!!"), /*#__PURE__*/React.createElement("h2", {
  className: "text-xl font-bold"
}, "A subheader, cool"))), /*#__PURE__*/React.createElement("div", {
  className: "pl-4 pb-8"
}, /*#__PURE__*/React.createElement("strong", null, "Welcome to my prototype."), " This is an prototype of:", /*#__PURE__*/React.createElement("ul", {
  className: "list-disc ml-6"
}, /*#__PURE__*/React.createElement("li", null, "React with hot module reloading"), /*#__PURE__*/React.createElement("li", null, "PostCSS"), /*#__PURE__*/React.createElement("li", null, "Snowpack"), /*#__PURE__*/React.createElement("li", null, "Tailwind CSS"), /*#__PURE__*/React.createElement("li", null, "API Fetching (airtable-api.glitch.me:", " ", /*#__PURE__*/React.createElement("strong", null, "not in this project"), ")"), /*#__PURE__*/React.createElement("li", null, "Production bundle & deployment (right now goes to firebase, but as an example of the kind of workflow we could build, was easier than sending to s3)")), /*#__PURE__*/React.createElement("p", null, "This is the ", /*#__PURE__*/React.createElement("strong", null, "development server"), ", which runs all of the above. Once you run ", /*#__PURE__*/React.createElement("strong", null, "npm run deploy"), " it will bundle it all up, and deploy it to firebase."))));

export default Header;