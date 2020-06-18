import React from "/web_modules/react.js";
import classNames from "/web_modules/classnames.js";

const Role = ({
  data,
  toggleFilterRole,
  filterRole
}) => {
  const className = classNames("rounded", "p-1 px-3 m-1", "cursor-pointer", "no-underline", "border-2 border-gray-900", "text-black font-bold", {
    "bg-white": filterRole !== data
  }, {
    "bg-gray-300": filterRole == data
  }, "transition duration-200 ease-in-out hover:bg-glitch");
  return /*#__PURE__*/React.createElement("a", {
    href: `#${data.id}`
  }, /*#__PURE__*/React.createElement("button", {
    className: className
  }, data.name));
};

export default Role;