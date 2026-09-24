import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2422 opens Library on Load and offers Import Export in the requested keyboard order", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const rows = [...source.matchAll(/\{ id: "([\w-]+)", shortcut: "([A-Z])", label: "([A-Z ]+)"/gu)]
    .slice(0, 7).map((match) => match.slice(1, 4));
  assert.deepEqual(rows, [
    ["load", "L", "LOAD"], ["new", "N", "NEW"], ["import-export", "I", "IMPORT EXPORT"],
    ["examples", "E", "EXAMPLES"], ["presets", "P", "PRESETS"],
    ["avery", "A", "AVERY"], ["archive", "R", "ARCHIVE"],
  ]);
  assert.match(source, /useState<LibraryDestination>\("load"\)/u);
  assert.match(source, /data-library-destination=\{destination\}/u);
  assert.match(source, /onClick=\{openActiveProject\}[\s\S]*>Back to Dashboard<\/button>/u);
});

test("#2422 exports a canonical backup and imports it as a separate story while preserving legacy PPF import", async () => {
  const [source, backup] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("core/storage/library-project.ts"),
  ]);
  assert.match(backup, /source\.format !== PPF_FOUNDATION_VERSION/u);
  assert.match(backup, /return normalizeLibraryProject\(value\)/u);
  assert.match(source, /parseLibraryBackup\(await file\.text\(\)\)/u);
  assert.match(source, /importLibraryProject\(\{[\s\S]*sourceProject: backup/u);
  assert.match(source, /fetch\("\/api\/library\/import\/ppf"/u);
  assert.match(source, /serializeLibraryBackup\(project\)/u);
  assert.match(source, /anchor\.download = libraryBackupFileName\(project\.title\)/u);
  assert.match(source, /Local image files are stored separately/u);
});
