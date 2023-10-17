// Parsing the VirtuRob DOM as a Scheme-like language

import { VirtuRobDomType, VirtuRobDomNode } from "./virturob-dom";

export function parse(s: string): VirtuRobDomNode[] {
  const result = recursiveDescentParser(s);
  if (result.rest.trim() !== "") {
    throw new Error(`Unexpeced character '${result.rest.trim()[0]}'`);
  }
  return result.nodes;
}

function recursiveDescentParser(s: string): {
  nodes: VirtuRobDomNode[];
  rest: string;
} {
  const result: VirtuRobDomNode[] = [];
  while (true) {
    s = s.trimStart();
    if (s[0] === '"') {
      const slice = s.slice(1);
      const end = slice.indexOf('"');
      if (end === -1) {
        throw new Error("no matching end quote");
      }
      const newString = slice.slice(0, end);
      if (!newString.match(/^[a-zA-Z0-9 `~!@#$%^&*()_\-+=,.?':;]*$/)) {
        throw new Error("unexpected string contents");
      }
      result.push(newString);
      s = slice.slice(end + 1);
    } else if (s[0] === "(") {
      s = s.slice(1).trimStart();
      const match = s.match(/^[a-zA-Z0-9_-]+/);
      if (!match) {
        throw new Error("No dom type identifier found");
      }
      const domType: VirtuRobDomType | null =
        match[0] === "div"
          ? "div"
          : match[0] === "unordered_list"
          ? "unordered_list"
          : match[0] === "list_item"
          ? "list_item"
          : match[0] === "paragraph"
          ? "paragraph"
          : null;
      if (domType === null) {
        throw new Error(`Invalid dom type '${match[0]}'`);
      }
      const recursiveCallResult = recursiveDescentParser(
        s.slice(match[0].length)
      );
      s = recursiveCallResult.rest.trimStart();
      if (s[0] !== ")") {
        throw new Error("Closing parenthesis expected and not found");
      }
      result.push({ type: domType, children: recursiveCallResult.nodes });
      s = s.slice(1);
    } else {
      return { nodes: result, rest: s };
    }
  }
}
