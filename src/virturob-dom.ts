type VirturobDomType = "divider" | "list" | "paragraph";

type VirturobDomNode =
  | string
  | { type: "divider"; children: [] }
  | { type: "list"; children: [] }
  | { type: "paragraph"; children: [] };

function parse(s: string): { nodes: VirturobDomNode[], rest: string } {
  
  while (true) {
      s = s.trimStart();
      if (s === "") return [];
      if (s[0] === '"') {
        const slice = s.slice(1);
        const end = slice.indexOf('"');
        if (end === -1) {
          throw new Error("no matching end quote");
        }
      }

      return [];
  }
}