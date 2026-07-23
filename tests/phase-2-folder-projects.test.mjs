import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const folderSource = await readFile(new URL("../lib/project-folder.ts", import.meta.url), "utf8");
const gatewaySource = await readFile(new URL("../build/folder-project-gateway.ts", import.meta.url), "utf8");
const viteSource = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");

test("Phase 2 defines manifest-based folder projects", () => {
  assert.match(folderSource, /PROJECT_FOLDER_FORMAT = "plotpickle-project"/);
  assert.match(folderSource, /PROJECT_FOLDER_VERSION = "2\.0\.0"/);
  assert.match(folderSource, /"manifest\.json"/);
  assert.match(folderSource, /screenplay\/module\.json/);
  assert.match(folderSource, /characters\/module\.json/);
  assert.match(folderSource, /canon\/rights\.json/);
  assert.match(folderSource, /parseProjectFolder/);
});

test("Phase 2 stores canonical projects as folders while retaining portable backups", () => {
  assert.match(gatewaySource, /projects-v2/);
  assert.match(gatewaySource, /storage: "folder"/);
  assert.match(gatewaySource, /createPortableProjectFile\(previous\)/);
  assert.match(gatewaySource, /BACKUP_LIMIT = 20/);
  assert.match(gatewaySource, /atomicJson/);
});

test("The folder gateway precedes the legacy GitHub gateway", () => {
  assert.ok(viteSource.indexOf("folderProjectGateway()") < viteSource.indexOf("localProjectGateway()"));
});
