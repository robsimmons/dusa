export type VirtuRobDomType =
  | "div"
  | "unordered_list"
  | "list_item"
  | "paragraph";

export type VirtuRobDomNode =
  | string
  | { type: VirtuRobDomType; children: VirtuRobDomNode[] };

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
      if (!newString.match(/^[a-zA-Z0-9 _-.!?()*&^%$#@+=]*$/)) {
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

function chainToString(chain: number[]) {
  return `root${chain.map((index) => `.children[${index}]`).join("")}`;
}

export function createDomElement(
  chain: number[],
  index: number,
  node: VirtuRobDomNode
): string[] {
  
    const domType: string =
      typeof n
      node.type === "div"
        ? "div"
        : node.type === "unordered_list"
        ? "ul"
        : node.type === "list_item"
        ? "li"
        : node.type === "paragraph"
        ? "p"
        : "span";
  
  
  
  if (typeof node === "string") {
    return [
      `temp = document.createElement("span");`,
      `temp.innerText = "${node}";,`,
      chainToString(chain) + `.append(temp);`,
    ];
  } else {
    return [
      chainToString(chain) + `.append(document.createElement(${domType}));`,
      ...createDom([...chain, index], node.children),
    ];
  }
}

export function createDom(chain: number[], nodes: VirtuRobDomNode[]): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    result.push(chainToString(chain) + `.append()`);
  }
  return result;
}
