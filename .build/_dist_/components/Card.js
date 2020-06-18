import React from "/web_modules/react.js";
import Icon from "./Icon.js";

function URLify(string) {
  var urls = string.match(/(((https?):\/\/)[\-\w@:%_\+.~#?,&\/\/=]+)/g);

  if (urls) {
    urls.forEach(function (url) {
      string = string.replace(url, '<a target="_blank" href="' + url + '">' + url + "</a>");
    });
  }

  return string.replace("(", "<br/>(");
}

const description = summary => {
  return {
    __html: URLify(summary)
  };
};

const Card = ({
  record: {
    name,
    role,
    location,
    remote,
    github,
    twitter,
    linkedin,
    summary,
    personal
  }
}) => {
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white relative shadow overflow-hidden sm:rounded-lg hover:bg-glitch hover:shadow-xl shadow transition duration-500 ease-in-out"
  }, /*#__PURE__*/React.createElement("div", {
    className: "m-6"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-2xl leading-6 font-medium text-gray-900 mb-4 w-full"
  }, name), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end w-full"
  }, linkedin && /*#__PURE__*/React.createElement("a", {
    href: `${linkedin}`,
    target: "_blank"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "linkedin"
  })), github && /*#__PURE__*/React.createElement("a", {
    href: `${github}`,
    target: "_blank"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "github"
  })), twitter && /*#__PURE__*/React.createElement("a", {
    href: `${twitter}`,
    target: "_blank"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "twitter"
  })), personal && /*#__PURE__*/React.createElement("a", {
    href: `${personal}`,
    target: "_blank"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "personal"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "text-gray-800 text-sm"
  }, location, " ", remote && /*#__PURE__*/React.createElement("span", null, "Remote")), /*#__PURE__*/React.createElement("div", null, personal && /*#__PURE__*/React.createElement("a", {
    href: personal,
    target: "_blank"
  }, personal)), /*#__PURE__*/React.createElement("div", {
    className: "pt-6",
    dangerouslySetInnerHTML: description(summary)
  }))));
};

export default Card;