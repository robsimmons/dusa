import React, { Component } from "react";
import cx from "classnames";

const Icon = ({ name }) => {
  const className = cx("w-6 m-2 hover:shadow-xl");

  const icons = {
    twitter: (
      <img
        src="/twitter-icon.svg"
        style={{ height: "20px" }}
        className={className}
        alt="Twitter"
      />
    ),
    github: (
      <img
        src="/github-icon.svg"
        style={{ height: "20px" }}
        className={className}
        alt="Twitter"
      />
    ),
    linkedin: (
      <img
        src="/linkedin-icon.svg"
        style={{ height: "20px" }}
        className={className}
        alt="Twitter"
      />
    ),
    personal: (
      <img
        src="/personal-icon.svg"
        style={{ height: "20px" }}
        className={className}
        alt="Twitter"
      />
    ),
    up: <img src="/up-icon.svg" />,
  };

  return <>{icons[name]}</>;
};

export default Icon;
