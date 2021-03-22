import * as React from 'react';
import { Link, Route } from "wouter";

const Router = () => (
  <div>
    <Link href="/users/1">
      <a className="link">Profile.</a>
    </Link>

    <Route path="/about">About Us</Route>
  </div>
);

export default Router;