import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const folderSource = await readFile(new URL("../lib/project-folder.ts", import.meta.url), "utf8");
const gatewaySource = await readFile(new URL("../build/folder-project-gateway.ts", import.meta.url), "utf8");
const viteSource = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");

test("Phase 2 folder projects remain readable after modular evolution", () => {
  assert.match(folderSource, /PROJECT_FOLDER_FORMAT = "plotpickle-project"/);
  assert.match(folderSource, /PROJECT_FOLDER_VERSION = "2\.2\.0"/);
  assert.match(folderSource, /manifest\.formatVersion === "2\.0\.0"/);
  assert.match(folderSource, /"2\.0\.0", "2\.1\.0", PROJECT_FOLDER_VERSION/);
  assert.match(folderSource, /"manifest\.json"/);
  assert.match(folderSource, /screenplay\/module\.json/);
  assert.match(folderSource, /canon\/rights\.json/);
  assert.match(folderSource, /parseProjectFolder/);
});

test("canonical projects remain folders with portable backups and staged writes", () => {
  assert.match(gatewaySource, /projects-v2/);
  assert.match(gatewaySource, /storage: "modular-folder"/);
  assert.match(gatewaySource, /createPortableProjectFile\(previous\)/);
  assert.match(gatewaySource, /BACKUP_LIMIT = 20/);
  assert.match(gatewaySource, /atomicFile/);
  assert.match(gatewaySource, /temporaryFolder/);
});

test("The folder gateway precedes the legacy GitHub gateway", () => {
  assert.ok(viteSource.indexOf("folderProjectGateway()") < viteSource.indexOf("localProjectGateway()"));
});
