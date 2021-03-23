import * as React from "react";
import { Link, Route } from "wouter";
import Home from "../pages/home";
import HowToUse from '../pages/how-to-use'
import NextSteps from '../pages/next-steps'

const Router = () => (
  <>
    <Route path="/" component={Home} />
    <Route path="/how-to-use" component={HowToUse} />
  </>
);

export default Router;
