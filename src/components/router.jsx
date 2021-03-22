import * as React from 'react';
import { Link, Route } from "wouter";
import Home from '../pages/home';


const Router = () => (
  <>
    <Route path="/" component={Home} />
  </>
);

export default Router;