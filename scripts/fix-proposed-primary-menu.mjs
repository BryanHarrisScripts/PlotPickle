import { readFileSync, writeFileSync } from "node:fs";

const path = "app/page.tsx";
let source = readFileSync(path, "utf8");

const input = '              <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json,.json,.txt,.fountain,.spmd,.fdx,text/plain,text/xml,application/xml" onChange={importFile} />\n';
if (!source.includes(input)) throw new Error("Dashboard file input was not found.");
source = source.replace(input, "");

const headerEnd = `      </header>\n\n      <div className="project-strip">`;
const globalInput = `      </header>\n\n      <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json,.json,.txt,.fountain,.spmd,.fdx,text/plain,text/xml,application/xml" onChange={importFile} />\n\n      <div className="project-strip">`;
if (!source.includes(headerEnd)) throw new Error("Topbar ending was not found.");
source = source.replace(headerEnd, globalInput);

writeFileSync(path, source);

const testPath = "tests/proposed-primary-menu.test.mjs";
let tests = readFileSync(testPath, "utf8");
tests = tests.replace(
  '  assert.match(page, /className="dashboard-actions"/);\n  assert.doesNotMatch(page, /<small>{tab\\.description}<\\/small>/);',
  '  assert.match(page, /className="dashboard-actions"/);\n  assert.equal((page.match(/ref={fileInputRef}/g) ?? []).length, 1);\n  assert.match(page, /<\\/header>[\\s\\S]*ref={fileInputRef}[\\s\\S]*<div className="project-strip">/);\n  assert.doesNotMatch(page, /<small>{tab\\.description}<\\/small>/);',
);
writeFileSync(testPath, tests);
