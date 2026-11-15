import indexHtml from "../index.html?raw";

export function mountPageMarkup(): void {
  const markup = (indexHtml.split("<body>")[1] ?? "").replace(/<script[\s\S]*<\/script>/, "");
  const parsed = new DOMParser().parseFromString(`<body>${markup}`, "text/html");
  document.body.replaceChildren(
    ...Array.from(parsed.body.childNodes, (node) => document.importNode(node, true)),
  );
}
