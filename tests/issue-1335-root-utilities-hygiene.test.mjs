import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const at = (path) => new URL(path, root);

const activeUtilities = [
  "Utilities/Repair-PlotPickle.bat",
  "Utilities/Repair-PlotPickle.cmd",
  "Utilities/Update-PlotPickle.bat",
  "Utilities/Update-PlotPickle.cmd",
  "Utilities/Run-PlotPickle-Full-Check.bat",
  "Utilities/Verify-PlotPickle.cmd",
  "Utilities/Run-PlotPickle-ComfyUI-Check.bat",
  "Utilities/Check-ComfyUI.cmd",
  "Utilities/Start-Production-Supervisor.bat",
  "Utilities/Sync-PlotPickle-BUZZ.cmd",
  "Utilities/Clean-PlotPickle-BUZZ.cmd",
];

const archivedUtilities = [
  "Run-Lighthouse.arc",
  "Setup-PlotPickle-BUZZ.arc",
  "Sync-PlotPickle-BUZZ.arc",
];

test("#1335 keeps only the intentional Windows start launcher runnable at repository root", async () => {
  const entries = await readdir(root, { withFileTypes: true });
  const rootWindowsScripts = entries
    .filter((entry) => entry.isFile() && /\.(?:bat|cmd|ps1)$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(rootWindowsScripts, ["Start-PlotPickle.bat"]);
});

test("#1335 keeps supported maintenance launchers discoverable under Utilities", async () => {
  for (const path of activeUtilities) await access(at(path));

  const readme = await readFile(at("Utilities/README.md"), "utf8");
  assert.match(readme, /Start-PlotPickle\.bat/);
  assert.match(readme, /Stale or historical launchers/);
});

test("#1335 archives retired launchers with non-executable .arc suffixes", async () => {
  const entries = await readdir(at("Utilities/archive"), { withFileTypes: true });
  const runnable = entries
    .filter((entry) => entry.isFile() && /\.(?:bat|cmd|ps1)$/i.test(entry.name))
    .map((entry) => entry.name);
  assert.deepEqual(runnable, []);

  for (const name of archivedUtilities) {
    assert.ok(entries.some((entry) => entry.isFile() && entry.name === name), `Missing archived launcher: ${name}`);
  }
});

test("#1335 packages Utilities without copying maintenance launchers back to the Windows root", async () => {
  const packager = await readFile(at("scripts/package-platform.mjs"), "utf8");
  assert.match(packager, /"Utilities"/);
  assert.doesNotMatch(packager, /\["Repair-PlotPickle\.bat",\s*"Update-PlotPickle\.bat",\s*"Run-PlotPickle-ComfyUI-Check\.bat"\]/);
});
