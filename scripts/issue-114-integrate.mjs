import { readFile, writeFile } from "node:fs/promises";

const path = "app/page.tsx";
let source = await readFile(path, "utf8");

const importLine = 'import BuildWorkspace from "./build-workspace";';
if (!source.includes(importLine)) {
  const anchor = 'import DashboardCommandCentre from "./dashboard-command-centre";';
  if (!source.includes(anchor)) throw new Error("Dashboard import anchor not found");
  source = source.replace(anchor, `${anchor}\n${importLine}`);
}

const buildMarkup = `        {activeTab === "build" ? (\n          <BuildWorkspace\n            project={project}\n            onProjectChange={commit}\n            onOpenBlock={(number) => openBlock(number, "planner")}\n          />\n        ) : null}\n\n`;

if (!source.includes('activeTab === "build"')) {
  const anchor = '        {activeTab === "planner" ? (';
  if (!source.includes(anchor)) throw new Error("Planner render anchor not found");
  source = source.replace(anchor, `${buildMarkup}${anchor}`);
}

await writeFile(path, source);
console.log("Issue #114 Build workspace integration is present.");
