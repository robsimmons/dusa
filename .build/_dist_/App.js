import React, { useState, useEffect } from "/web_modules/react.js";
import Header from "./components/Header.js";
import Card from "./components/Card.js";
import Icon from "./components/Icon.js";
import "./styles.css";
import { initialData } from "./data/airtable.js";
const backgroundColor = "#9BE7D8";
const headerColor = "#5A78FF";
export default function Home() {
  const [data, setData] = useState([]); // Lets load our initial data

  useEffect(() => {
    setData(initialData);

    async function fetchData() {
      const res = await fetch("https://airtable-api.glitch.me/api");
      res.json().then(res => {
        setData(res);
      });
    }

    fetchData();
  }, []);
  if (!data) return null;
  return /*#__PURE__*/React.createElement("main", {
    id: "0",
    className: "0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-4 md:absolute md:top-1 md:left-1"
  }, /*#__PURE__*/React.createElement("a", {
    href: "https://glitch.com"
  }, /*#__PURE__*/React.createElement("img", {
    className: "inline pb-6 mr-2 md:mr-6 w-12 ",
    src: "https://cdn.gomix.com/2bdfb3f8-05ef-4035-a06e-2043962a3a13%2Flogo-day.svg?v=1489265200041"
  }))), /*#__PURE__*/React.createElement(Header, null), /*#__PURE__*/React.createElement("section", {
    style: {
      backgroundColor
    },
    className: `py-4 px-4 md:py-12 md:px-12`
  }, /*#__PURE__*/React.createElement("div", {
    className: "container mx-auto pl-6 flex"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-full pb-6"
  }, /*#__PURE__*/React.createElement("h2", {
    className: `font-extrabold p-0 m-0 text-2xl md:text-3xl`,
    style: {
      color: headerColor
    }
  }, "My Friends")), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end"
  }, /*#__PURE__*/React.createElement("a", {
    className: "cursor-pointer",
    href: `#home`
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "up"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "grid sm:grid-cols-1 md:grid-cols-2 gap-4 container mx-auto"
  }, data.map(record => /*#__PURE__*/React.createElement(Card, {
    key: record.name,
    record: record
  })))), /*#__PURE__*/React.createElement("footer", {
    className: "bg-gray-200 text-center m-4"
  }, /*#__PURE__*/React.createElement("a", {
    href: "https://glitch.com"
  }, /*#__PURE__*/React.createElement("img", {
    className: "inline pb-4 mr-2 md:mr-6 w-12",
    src: "https://cdn.gomix.com/2bdfb3f8-05ef-4035-a06e-2043962a3a13%2Flogo-day.svg?v=1489265200041",
    alt: "Glitch Logo"
  }))));
}