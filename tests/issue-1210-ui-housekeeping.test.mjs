import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");

test("#1210 Profile stays auth-safe while presenting compact lore chrome and an expanded three-column surface", async () => {
  const [ui, css, relic] = await Promise.all([
    read("app/profile-access/profile-access-boundary.tsx"),
    read("app/profile-access/profile-access-boundary.module.css"),
    read("public/assets/workflow-relics/profile.svg"),
  ]);

  assert.match(ui, /<summary>Profile<\/summary>/u);
  for (const action of ["Add profile", "Lock", "Switch profile", "Log out"]) assert.match(ui, new RegExp(action, "u"));
  assert.match(ui, /status\.profile\.displayName/u);
  assert.match(css, /\.activeHuman\s*>\s*div\s*\{[\s\S]*display:\s*none/u);
  assert.match(css, /\.activeHuman:has\(details\[open\]\)\s*>\s*div\s*\{[\s\S]*display:\s*grid/u);
  assert.match(css, /profile\.svg/u);
  for (const label of ["Identity", "Access", "Profile actions"]) assert.match(css, new RegExp(label, "u"));
  assert.match(css, /details\[open\][\s\S]*grid-template-columns:\s*repeat\(2/u);
  assert.match(css, /@media\s*\(max-width:\s*700px\)[\s\S]*grid-template-columns:\s*1fr/u);
  assert.match(relic, /<title id="title">Profile relic<\/title>/u);
  assert.match(relic, /linearGradient id="gold"[\s\S]*linearGradient id="iron"[\s\S]*radialGradient id="gem"/u);
});

test("#1210 Library uses the lore relic family without changing Library navigation", async () => {
  const [shell, relic] = await Promise.all([
    read("app/plotpickle-workspace-shell.tsx"),
    read("public/assets/workflow-relics/library.svg"),
  ]);

  assert.match(shell, /id:\s*"library"[\s\S]*relic:\s*"\/assets\/workflow-relics\/library\.svg"[\s\S]*selectable:\s*true/u);
  assert.match(relic, /viewBox="0 0 96 96"/u);
  assert.match(relic, /<title id="title">Library relic<\/title>/u);
  assert.match(relic, /open brass-bound book/u);
  assert.match(relic, /linearGradient id="gold"[\s\S]*linearGradient id="iron"[\s\S]*radialGradient id="gem"/u);
});

test("#1210 advanced Settings submenus are guarded by PlotPickle semantic dark surfaces", async () => {
  const [settings, guard] = await Promise.all([
    read("app/settings-panel.tsx"),
    read("app/settings-dark-surface-guard.css"),
  ]);

  assert.match(settings, /aria-label="PlotPickle Settings systems"/u);
  assert.match(settings, /id=\{`settings-system-\$\{system\.id\}`\}/u);
  assert.match(guard, /nav\[aria-label="PlotPickle Settings systems"\]/u);
  assert.match(guard, /\[id\^="settings-system-"\][\s\S]*var\(--pp-settings-surface\)/u);
  assert.match(guard, /button\[aria-current="page"\][\s\S]*--pp-settings-teal/u);
  assert.match(guard, /:hover:not\(:disabled\)[\s\S]*--pp-settings-hover/u);
  assert.match(guard, /:focus-visible[\s\S]*--pp-settings-orange/u);
});
