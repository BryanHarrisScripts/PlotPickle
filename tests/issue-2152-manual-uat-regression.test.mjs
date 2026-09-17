import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#2152 keeps persisted Library selection separate from the explicit current-session story", async () => {
  const session = await read("core/storage/project-library-session-browser.ts");
  const library = await read("modules/library/ui/library-workspace.tsx");

  assert.match(session, /PROJECT_LIBRARY_SESSION_CHANGED_EVENT/u);
  assert.match(session, /PROJECT_LIBRARY_ACTIVE_PROFILE_KEY/u);
  assert.match(session, /currentSessionLibraryProject/u);
  assert.match(session, /initializeProjectLibrary\(\)\.activeProject/u);
  assert.match(session, /activeProject\.id !== projectId/u);

  assert.match(library, /setActiveProject\(currentSessionLibraryProject\(\)\)/u);
  assert.doesNotMatch(library, /setActiveProject\(library\.activeProject\)/u);
  assert.match(library, /markCurrentSessionLibraryProject\(project\.id\)/u);
  assert.match(library, /markCurrentSessionLibraryProject\(openedProject\.id\)/u);
  assert.match(library, /markCurrentSessionLibraryProject\(imported\.id\)/u);
  assert.match(library, /clearCurrentSessionLibraryProject\(\)/u);
});

test("#2152 restores the Library BBS directory as readable full-width command rows", async () => {
  const library = await read("modules/library/ui/library-workspace.tsx");

  assert.match(library, /data-library-directory="keyboard-directory"/u);
  assert.match(library, /role="listbox" aria-label="Library directory"/u);
  assert.match(library, /display: "block"/u);
  assert.match(library, /background: selected \? "var\(--pp-skin-accent-deep\)" : "transparent"/u);
  assert.match(library, /whiteSpace: "pre-wrap"/u);
  for (const shortcut of ["N", "I", "L", "E", "P", "A", "R"]) {
    assert.match(library, new RegExp(`shortcut: "${shortcut}"`, "u"));
  }
});

test("#2152 removes normal Library review-state chrome while preserving bounded Story Map review state", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");
  const libraryStart = host.indexOf("if (libraryOpen)");
  const outlineStart = host.indexOf("if (outlineOpen)");
  assert.ok(libraryStart >= 0 && outlineStart > libraryStart);
  const libraryBlock = host.slice(libraryStart, outlineStart);

  assert.match(libraryBlock, /aria-label="Library"/u);
  assert.doesNotMatch(libraryBlock, /IN REVIEW|reviewBadge|data-review-state/u);

  const outlineBlock = host.slice(outlineStart, host.indexOf("if (storyboardOpen)"));
  assert.match(outlineBlock, /data-review-state="in-review"/u);
  assert.match(outlineBlock, /IN REVIEW/u);
});

test("#2152 PlotPickle Score follows only the explicit current-session story", async () => {
  const score = await read("app/skin-v1/plotpickle-score-panel.tsx");

  assert.match(score, /currentSessionLibraryProject/u);
  assert.match(score, /PROJECT_LIBRARY_SESSION_CHANGED_EVENT/u);
  assert.match(score, /calculatePlotPickleScore/u);
  assert.match(score, /if \(!project \|\| !result\) return null/u);
  for (const metric of ["ALIGNMENT", "VERBOSITY", "EROSION", "PROGRESSION", "COVERAGE"]) {
    assert.match(score, new RegExp(`\\["${metric}"`, "u"));
  }
});
