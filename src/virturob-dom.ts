// Tiny oversimplified Virtual DOM, DOM diffing, and repair calculation

export type VirtuRobDomType =
  | "div"
  | "unordered_list"
  | "list_item"
  | "paragraph";

export type VirtuRobDomNode =
  | string
  | { type: VirtuRobDomType; children: VirtuRobDomNode[] };

function chainToString(chain: number[]) {
  return `root${chain.map((index) => `.children[${index}]`).join("")}`;
}

export function getDomType(node: VirtuRobDomNode): string {
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

export function appendDomElement(
  chain: number[],
  node: VirtuRobDomNode
): string {
  return (
    chainToString(chain) +
    `.append(document.createElement("${getDomType(node)}"));`
  );
}

export function populateDomElement(chain: number[], node: VirtuRobDomNode) {
  if (typeof node === "string") {
    return [chainToString(chain) + `.innerText = "${node}";`];
  } else {
    return createDom(chain, node.children);
  }
}

export function createDom(chain: number[], nodes: VirtuRobDomNode[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    result.push(appendDomElement(chain, nodes[i]));
    result.push(...populateDomElement([...chain, i], nodes[i]));
  }
  return result;
}

function diffDomElement(
  chain: number[],
  oldVD: VirtuRobDomNode,
  newVD: VirtuRobDomNode
): string[] {
  if (typeof oldVD === "string" && typeof newVD === "string") {
    if (oldVD === newVD) return [];
    return [chainToString(chain) + `.innerText = "${newVD}"`];
  }
  if (
    typeof oldVD === "string" ||
    typeof newVD === "string" ||
    oldVD.type !== newVD.type
  ) {
    return [
      chainToString(chain) +
        `.replaceWith(document.createElement("${getDomType(newVD)}"));`,
      ...populateDomElement(chain, newVD),
    ];
  }
  return diffDom(chain, oldVD.children, newVD.children);
}

export function diffDom(
  chain: number[],
  oldVD: VirtuRobDomNode[],
  newVD: VirtuRobDomNode[]
): string[] {
  const result: string[] = [];
  for (let i = 0; i < Math.min(oldVD.length, newVD.length); i++) {
    result.push(...diffDomElement([...chain, i], oldVD[i], newVD[i]));
  }
  if (oldVD.length < newVD.length) {
    for (let i = oldVD.length; i < newVD.length; i++) {
      result.push(appendDomElement(chain, newVD[i]));
      result.push(...populateDomElement([...chain, i], newVD[i]));
    }
  } else {
    for (let i = newVD.length; i < oldVD.length; i++) {
      result.push(chainToString([...chain, newVD.length]) + `.remove()`);
    }
  }
  return result;
}
