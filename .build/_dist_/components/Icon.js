import React, { Component } from "/web_modules/react.js";
import cx from "/web_modules/classnames.js";

const Icon = ({
  name
}) => {
  const className = cx("w-6 m-2 hover:shadow-xl");
  const icons = {
    twitter: /*#__PURE__*/React.createElement("img", {
      src: "/twitter-icon.svg",
      style: {
        height: "20px"
      },
      className: className,
      alt: "Twitter"
    }),
    github: /*#__PURE__*/React.createElement("img", {
      src: "/github-icon.svg",
      style: {
        height: "20px"
      },
      className: className,
      alt: "Twitter"
    }),
    linkedin: /*#__PURE__*/React.createElement("img", {
      src: "/linkedin-icon.svg",
      style: {
        height: "20px"
      },
      className: className,
      alt: "Twitter"
    }),
    personal: /*#__PURE__*/React.createElement("img", {
      src: "/personal-icon.svg",
      style: {
        height: "20px"
      },
      className: className,
      alt: "Twitter"
    }),
    up: /*#__PURE__*/React.createElement("img", {
      src: "/up-icon.svg"
    })
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, icons[name]);
};

export default Icon;