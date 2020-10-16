import * as React from "react";
import { render } from "@testing-library/react";
import App from "./App";

test("renders title element", () => {
  const { getByText } = render(<App />);
  const titleElement = getByText(/Hello react/i);
  expect(titleElement).toBeInTheDocument();
});
