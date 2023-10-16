type VirtualDomNode =
  | string
  | { type: "divider"; children: [] }
  | { type: "list"; children: [] }
  | { type: "paragraph"; children: [] };
