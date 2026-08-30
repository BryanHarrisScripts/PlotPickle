import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const registryPath = "app/navigation/global-shortcuts.ts";
const shellPath = "app/plotpickle-workspace-shell.tsx";
const releaseBoundaryPath = "app/navigation/release-experience-boundary.tsx";
const profilePath = "app/profile-access/profile-identity-overlay.tsx";

const expected = [
  ["N", "Node"],
  ["C", "Community"],
  ["O", "Library"],
  ["L", "Learn"],
  ["G", "Wyrmwood"],
  ["P", "Plan"],
  ["B", "Build"],
  ["S", "Storyboard"],
  ["V", "Previs"],
  ["W", "Write"],
  ["E", "Edit"],
  ["F", "Feedback"],
  ["R", "Refine"],
  ["D", "Reports"],
  ["K", "Dashboard"],
  ["T", "Settings"],
  ["H", "Profile"],
];

test("#1528 keeps one canonical registry for all 17 approved single-letter destinations", async () => {
  const registry = await read(registryPath);
  for (const [key, label] of expected) {
    assert.match(registry, new RegExp(`key: "${key}", label: "${label}"`));
  }
  assert.equal([...registry.matchAll(/key: "[A-Z]", label:/g)].length, 17);
  assert.match(registry, /href: "\/storyboard"/);
  assert.match(registry, /href: "\/previs"/);
  assert.match(registry, /href: "\/pageflow"/);
  assert.match(registry, /href: "\/edit"/);
  assert.match(registry, /href: "\/pitch-review"/);
  assert.match(registry, /href: "\/diagnostics"/);
  assert.match(registry, /href: "\/production"/);
});

test("#1528 installs one shell-owned keydown listener and uses the normal navigation mechanisms", async () => {
  const shell = await read(shellPath);
  assert.match(shell, /window\.addEventListener\("keydown", onKeyDown\)/);
  assert.match(shell, /window\.removeEventListener\("keydown", onKeyDown\)/);
  assert.equal([...shell.matchAll(/addEventListener\("keydown"/g)].length, 1);
  assert.match(shell, /shortcutForKey\(event\.key\)/);
  assert.match(shell, /globalShortcutBlocked\(event\)/);
  assert.match(shell, /onNavigate\(shortcut\.action\.workspace\)/);
  assert.match(shell, /router\.push\(shortcut\.action\.href\)/);
  assert.doesNotMatch(shell, /window\.location\.(?:href|assign|replace)/);
});

test("#1528 never steals letters from typing, controls, modified chords, repeat keys, or modal interaction", async () => {
  const registry = await read(registryPath);
  for (const token of ["input", "textarea", "select", "button", "a[href]", "contenteditable", "role='textbox'", "role='searchbox'", "role='combobox'", "data-disable-global-shortcuts='true'"]) {
    assert.ok(registry.includes(token), `missing shortcut guard for ${token}`);
  }
  assert.match(registry, /event\.defaultPrevented \|\| event\.repeat/);
  assert.match(registry, /event\.ctrlKey \|\| event\.metaKey \|\| event\.altKey \|\| event\.shiftKey/);
  assert.match(registry, /dialog\[open\]/);
  assert.match(registry, /aria-modal='true'/);
  assert.match(registry, /data-command-palette-open='true'/);
});

test("#1528 keeps navigation labels uncluttered and moves shortcut discovery to Settings Help", async () => {
  const [shell, releaseBoundary] = await Promise.all([read(shellPath), read(releaseBoundaryPath)]);
  assert.match(shell, /WORKFLOW_SHORTCUTS\.map/);
  assert.match(shell, /<small>\{item\.detail\}<\/small>/);
  assert.doesNotMatch(shell, /item\.detail\} · \$\{item\.key/);
  assert.doesNotMatch(shell, /data-global-shortcut-help/);
  assert.doesNotMatch(shell, /<kbd>\{shortcut\.key\}<\/kbd>/);
  assert.match(releaseBoundary, /SettingsKeyboardShortcutsHost/);
  assert.match(releaseBoundary, /GLOBAL_SHORTCUTS\.map/);
  assert.match(releaseBoundary, /dataset\.settingsKeyboardShortcuts/);
  assert.match(releaseBoundary, /<kbd>\{shortcut\.key\}<\/kbd>/);
});

test("#1528 opens Node and Human Profile as UI actions without changing story canon", async () => {
  const [registry, shell, profile] = await Promise.all([read(registryPath), read(shellPath), read(profilePath)]);
  assert.match(registry, /PLOTPICKLE_OPEN_NODE_EVENT/);
  assert.match(registry, /PLOTPICKLE_OPEN_PROFILE_EVENT/);
  assert.match(shell, /window\.dispatchEvent\(new Event\(PLOTPICKLE_OPEN_NODE_EVENT\)\)/);
  assert.match(shell, /window\.dispatchEvent\(new Event\(PLOTPICKLE_OPEN_PROFILE_EVENT\)\)/);
  assert.match(profile, /window\.addEventListener\(PLOTPICKLE_OPEN_PROFILE_EVENT, openProfile\)/);
  assert.match(profile, /detailsRef\.current\.open = true/);
  assert.doesNotMatch(`${registry}\n${shell}`, /applyStoryCommand|saveFoundationProject|persist.*canon/i);
});
