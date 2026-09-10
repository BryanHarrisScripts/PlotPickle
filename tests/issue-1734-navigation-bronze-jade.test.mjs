import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#1734 groups Dashboard, Library and Profile without duplicating the visible Profile utility", async () => {
  const [shell, overlay] = await Promise.all([
    read("app/plotpickle-workspace-shell.tsx"),
    read("app/profile-access/profile-identity-overlay.module.css"),
  ]);
  const dashboard = shell.indexOf('id: "dashboard"');
  assert.match(shell, /activeArea === "home"[\s\S]*data-shell-local-destination="profile"/u);
  assert.match(shell, /data-shell-local-order=\{activeArea === "home" \? "dashboard library profile" : undefined\}/u);
  assert.match(shell, /aria-haspopup="dialog"/u);
  assert.match(shell, /runShortcut\(profileShortcut\)/u);
  assert.match(await read("app/navigation/global-shortcuts.ts"), /id: "profile"[\s\S]*relic: "\/assets\/workflow-relics\/profile\.svg"/u);
  assert.match(overlay, /\.trigger\s*\{[\s\S]*width:\s*1px;[\s\S]*clip-path:\s*inset\(50%\)/u);
  assert.match(overlay, /\.close\s*\{[\s\S]*min-width:\s*44px;[\s\S]*min-height:\s*44px;/u);
  assert.equal(dashboard, -1, "route ownership must remain in the canonical shortcut registry");
});

test("#1734 preserves Settings as the distinct far-right area and keeps project truth in the lower row", async () => {
  const [shell, css, shortcuts] = await Promise.all([
    read("app/plotpickle-workspace-shell.tsx"),
    read("app/plotpickle-workspace-shell.module.css"),
    read("app/navigation/global-shortcuts.ts"),
  ]);
  assert.match(shortcuts, /\{ id: "settings", label: "Settings", detail: "Utilities" \}/u);
  assert.match(shell, /navigationAreaOption\.id === "settings" \? styles\.utilityArea/u);
  assert.match(css, /\.utilityArea\s*\{[\s\S]*margin-left:\s*auto;[\s\S]*border-left:/u);
  assert.ok(shell.indexOf("styles.destinationScroller") < shell.indexOf("<ShellProjectTruth"));
  for (const label of ["Project", "Context", "Status"]) assert.ok(shell.includes(`${label}</small><strong>`));
});

test("#1734 defines the approved shell palette centrally and consumes tokens only in shell CSS", async () => {
  const [tokens, css, gate] = await Promise.all([
    read("app/design-tokens.css"),
    read("app/plotpickle-workspace-shell.module.css"),
    read("scripts/ui-stylelint-gate.mjs"),
  ]);
  for (const token of [
    "--pp-shell-bronze: #c19a6b", "--pp-shell-bronze-deep: #8c6d3d", "--pp-shell-moss: #4b6e4f",
    "--pp-shell-jade: #3c834e", "--pp-shell-rune: #55d466", "--pp-shell-stone: #808080",
    "--pp-shell-stone-deep: #5c5c5c", "--pp-shell-gilding: #b8860b", "--pp-shell-lore-green: #38a169",
    "--pp-shell-lore-green-bright: #48bb78", "--pp-shell-lore-green-soft: #81c784",
  ]) assert.ok(tokens.includes(token), `missing centralized token ${token}`);
  assert.match(css, /var\(--pp-shell-bronze\)/u);
  assert.match(css, /var\(--pp-shell-jade\)/u);
  assert.match(css, /var\(--pp-shell-rune\)/u);
  assert.match(css, /font-family:\s*var\(--pp-font-navigation\)/u);
  assert.match(gate, /body\|display\|code\|interface\|navigation\|lore/u);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/iu);
});

test("#1734 retains accessible target sizing and responsive horizontal reachability", async () => {
  const css = await read("app/plotpickle-workspace-shell.module.css");
  assert.match(css, /\.profileDestination\s*\{[\s\S]*width:\s*64px;[\s\S]*min-height:\s*64px;/u);
  assert.match(css, /\.areaList button\s*\{[\s\S]*min-height:\s*44px;/u);
  assert.match(css, /\.destinationScroller\s*\{[\s\S]*overflow-x:\s*auto;/u);
  assert.match(css, /\.orientationRow\s*\{[\s\S]*overflow-x:\s*auto;/u);
});
