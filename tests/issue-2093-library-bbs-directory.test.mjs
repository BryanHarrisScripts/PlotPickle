import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2093 makes Library a single-surface Matrix/BBS keyboard directory", async () => {
  const workspace = await read("modules/library/ui/library-workspace.tsx");

  assert.match(workspace, /useState<LibraryDestination \| null>\(null\)/u);
  assert.match(workspace, /data-library-layout="single-surface"/u);
  assert.match(workspace, /data-library-directory="keyboard-directory"/u);
  assert.match(workspace, /data-skin-menu="library"/u);
  assert.match(workspace, /role="listbox" aria-label="Library directory"/u);
  assert.match(workspace, /data-library-back="directory"[\s\S]*Back to Library/u);
  assert.match(workspace, /event\.key === "Escape"[\s\S]*returnToDirectory\(\)/u);
  assert.doesNotMatch(workspace, /<nav aria-label="Library navigation"/u);
  assert.doesNotMatch(workspace, /className=\{styles\.libraryNav\}/u);
});

test("#2093 scopes all seven visible character shortcuts to the Library directory", async () => {
  const workspace = await read("modules/library/ui/library-workspace.tsx");

  for (const [id, shortcut, label] of [
    ["new", "N", "NEW"],
    ["import", "I", "IMPORT"],
    ["load", "L", "LOAD"],
    ["examples", "E", "EXAMPLES"],
    ["presets", "P", "PRESETS"],
    ["avery", "A", "AVERY"],
    ["archive", "R", "ARCHIVE"],
  ]) {
    assert.match(workspace, new RegExp(`id: "${id}", shortcut: "${shortcut}", label: "${label}"`));
  }

  assert.match(workspace, /event\.key\.length === 1[\s\S]*DESTINATIONS\.findIndex\(\(item\) => item\.shortcut === shortcut\)/u);
  assert.match(workspace, /event\.key === "ArrowDown"[\s\S]*selectDirectoryItem\(index \+ 1\)/u);
  assert.match(workspace, /event\.key === "ArrowUp"[\s\S]*selectDirectoryItem\(index - 1\)/u);
  assert.match(workspace, /event\.key === "Home"[\s\S]*selectDirectoryItem\(0\)/u);
  assert.match(workspace, /event\.key === "End"[\s\S]*selectDirectoryItem\(DESTINATIONS\.length - 1\)/u);
  assert.match(workspace, /event\.key === "Enter" \|\| event\.key === " "[\s\S]*activateDestination\(index\)/u);
  assert.match(workspace, /data-library-shortcut=\{item\.shortcut\}/u);
});

test("#2093 preserves Library project authority while changing only navigation", async () => {
  const workspace = await read("modules/library/ui/library-workspace.tsx");

  for (const contract of [
    "createLibraryUserProject",
    "importLibraryProject",
    "switchActiveLibraryProject",
    "createLibraryWorkingCopy",
    "archiveLibraryProject",
    "AverySessionHistory",
    "ArchiveStoriesPanel",
  ]) {
    assert.ok(workspace.includes(contract), `Expected preserved Library behavior: ${contract}`);
  }

  assert.match(workspace, /sourceKind: pending\.sourceKind/u);
  assert.match(workspace, /setPending\(\{ kind: "story", item \}\)/u);
  assert.match(workspace, /accept="\.ppf,application\/octet-stream"/u);
  assert.match(workspace, /Your current work will be saved as a local story before PlotPickle switches projects\./u);
});
