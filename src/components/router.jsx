import * as React from "react";
import { Link, Route } from "wouter";
import Home from "../pages/home";
import About from '../pages/about'

const Router = () => (
  <>
    <Route path="/" component={Home} />
    <Route path="/about" component={About} />
  </>
);

export default Router;
