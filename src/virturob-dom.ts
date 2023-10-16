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
      if (!newString.match(/^[a-zA-Z0-9 !@#$%^&*()_\-+=]*$/)) {
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

export function getDomType(type: VirtuRobDomNode) {
  return typeof node === "string"
      ? "span"
      : node.type === "div"
      ? "div"
      : node.type === "unordered_list"
      ? "ul"
      : node.type === "list_item"
      ? "li"
      : node.type === "paragraph"
      ? "p"
      : "textarea";
}

export function createDomElement(
  chain: number[],
  index: number,
  node: VirtuRobDomNode
): string[] {
  const domType: string = getDomType(node);
  const creationLine =
    chainToString(chain) + `.append(document.createElement("${domType}"));`;

}

export function populateDomElement(
chain: number[],
  index: number,
    node: VirtuRobDomNode) {
  if (typeof node === "string") {
    return [
      creationLine,
      chainToString(chain) + `.children[${index}].innerText = "${node}";`,
    ];
  } else {
    return [creationLine, ...createDom([...chain, index], node.children)];
  }
      
    }

export function createDom(chain: number[], nodes: VirtuRobDomNode[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    result.push(...createDomElement(chain, i, nodes[i]));
  }
  return result;
}

function diffDomElement(chain: number[], oldVD: VirtuRobDomNode, newVD: VirtuRobDomNode): string[] {
  if (typeof oldVD === 'string' && typeof newVD === 'string') {
    if (oldVD === newVD) return [];
    return [chainToString(chain) + `.innerText = "${newVD}"`];
  }
  if (typeof oldVD === 'string' || typeof newVD === 'string' || oldVD.type !== newVD.type) {
    return []
  }
}

export function diffDom(chain: number[], oldVD: VirtuRobDomNode[], newVD: VirtuRobDomNode[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < Math.min(oldVD.length, newVD.length); i++) {
    result.append(...diffDomElement([...chain, i], oldVD[i], newVD[i]));
  }
  return result;
}
