import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2072 gives Library one vertical destination per task in the required order", async () => {
  const workspace = await read("modules/library/ui/library-workspace.tsx");

  assert.match(workspace, /const DESTINATIONS[\s\S]*id: "new", shortcut: "N", label: "NEW"[\s\S]*id: "import", shortcut: "I", label: "IMPORT"[\s\S]*id: "load", shortcut: "L", label: "LOAD"[\s\S]*id: "examples", shortcut: "E", label: "EXAMPLES"[\s\S]*id: "presets", shortcut: "P", label: "PRESETS"[\s\S]*id: "avery", shortcut: "A", label: "AVERY"[\s\S]*id: "archive", shortcut: "R", label: "ARCHIVE"/);
  assert.match(workspace, /data-library-directory="keyboard-directory"/);
  assert.match(workspace, /role="listbox" aria-label="Library directory"/);
  assert.match(workspace, /onKeyDown=\{\(event\) => handleDirectoryKeyDown\(event, index\)\}/);
  assert.match(workspace, /event\.key === "ArrowDown"/);
  assert.match(workspace, /event\.key === "ArrowUp"/);
  assert.match(workspace, /event\.key === "Home"/);
  assert.match(workspace, /event\.key === "End"/);
  assert.match(workspace, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(workspace, /pp-skin-v1-menu-item pp-skin-v1-dashboard-row pp-skin-v1-submenu-item/);
  assert.doesNotMatch(workspace, /<nav aria-label="Library navigation"/);
  assert.doesNotMatch(workspace, /className=\{styles\.libraryNav\}/);
  assert.doesNotMatch(workspace, /className=\{styles\.tabs\}/);
});

test("#2072 keeps NEW, IMPORT, LOAD, EXAMPLES, PRESETS, AVERY and ARCHIVE behavior separated", async () => {
  const workspace = await read("modules/library/ui/library-workspace.tsx");

  for (const [surface, heading] of [["new", "NEW"], ["import", "IMPORT"], ["load", "LOAD"], ["avery", "AVERY"], ["archive", "ARCHIVE"]]) {
    assert.match(workspace, new RegExp(`data-library-surface="${surface}"[\\s\\S]*?<h2[^>]*>${heading}<\\/h2>`));
  }
  assert.match(workspace, /data-library-surface=\{destination\}[\s\S]*isExamples \? "EXAMPLES" : "PRESETS"/);
  assert.match(workspace, /destination === "new"[\s\S]*<NewStoryCard onCreate=\{createNewStory\}/);
  assert.match(workspace, /destination === "import"[\s\S]*accept="\.ppf,application\/octet-stream"[\s\S]*Import \.PPF/);
  assert.match(workspace, /destination === "load"[\s\S]*stories\.map[\s\S]*<StoryCard/);
  assert.match(workspace, /function StoryCard[\s\S]*Archive story/);
  assert.match(workspace, /destination === "examples" \|\| destination === "presets"/);
  assert.match(workspace, /destination === "avery"[\s\S]*<AverySessionHistory \/>/);
  assert.match(workspace, /data-library-surface="archive"[\s\S]*<ArchiveStoriesPanel \/>/);
  assert.doesNotMatch(workspace, /averyDisclosure/);
  assert.doesNotMatch(workspace, /<details[^>]*>[\s\S]*Avery Writer-in-Residence sessions/);
});

test("#2072 presents Avery as read-only synthetic work with compact status KPIs", async () => {
  const [avery, styles] = await Promise.all([
    read("modules/library/ui/avery-session-history/index.tsx"),
    read("modules/library/ui/avery-session-history/avery-session-history.module.css"),
  ]);

  assert.match(avery, /className=\{styles\.kpiGrid\} aria-label="Avery status"/);
  assert.match(avery, /<span>Sessions<\/span>/);
  assert.match(avery, /<span>Synthetic stories<\/span>/);
  assert.match(avery, /<span>Latest activity<\/span>/);
  assert.match(avery, /<span>Status<\/span>/);
  assert.match(styles, /\.kpiGrid\s*\{[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(avery, /Could a first-time writer reach BUILD\?/);
  assert.doesNotMatch(avery, /build incomplete/i);
  assert.doesNotMatch(avery, /Archive story|restoreArchivedLibraryProject|archiveLibraryProject/);
  assert.doesNotMatch(avery, /PROJECT_LIBRARY|projectLibrary/);
});
