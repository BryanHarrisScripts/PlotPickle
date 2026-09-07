import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1730 profile access uses the approved paper, sage and archive HUD tokens", async () => {
  const [tokens, css] = await Promise.all([
    read("app/design-tokens.css"),
    read("app/profile-access/profile-access-boundary.module.css"),
  ]);

  for (const token of [
    "--pp-profile-paper: #f9f8f0",
    "--pp-profile-mystic: #dfe9eb",
    "--pp-profile-casper: #abc3cd",
    "--pp-profile-jungle-mist: #a9cccf",
    "--pp-profile-juniper: #61828a",
    "--pp-profile-night: #101413",
    "--pp-profile-hud: #161d1c",
    "--pp-profile-status: #48bb78",
  ]) assert.match(tokens, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));

  assert.match(css, /background:[\s\S]*var\(--pp-profile-night\)/u);
  assert.match(css, /\.card\s*\{[\s\S]*background:\s*var\(--pp-profile-mystic\)/u);
  assert.match(css, /\.card\s*\{[\s\S]*border:\s*1px solid var\(--pp-profile-casper\)/u);
  assert.match(css, /repeating-linear-gradient/u);
  assert.match(css, /workflow-relics\/profile\.svg/u);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
});

test("#1730 typography mashes interface, telemetry and lore roles without changing auth code", async () => {
  const [tokens, css, ui, gate] = await Promise.all([
    read("app/design-tokens.css"),
    read("app/profile-access/profile-access-boundary.module.css"),
    read("app/profile-access/profile-access-boundary.tsx"),
    read("scripts/ui-stylelint-gate.mjs"),
  ]);

  assert.match(tokens, /--pp-font-interface:\s*system-ui/u);
  assert.match(tokens, /--pp-font-lore:\s*"Cinzel", Georgia/u);
  assert.match(css, /\.card h1\s*\{[\s\S]*font-family:\s*var\(--pp-font-lore\)/u);
  assert.match(css, /\.eyebrow\s*\{[\s\S]*font-family:\s*var\(--pp-font-code\)/u);
  assert.match(css, /\.boundary\s*\{[\s\S]*font-family:\s*var\(--pp-font-interface\)/u);
  assert.match(gate, /body\|display\|code\|interface\|lore/u);

  for (const securityContract of [
    "profileRequest(\"login\"",
    "X-PlotPickle-CSRF",
    "hydrateProfilePrivateBrowser",
    "flushProfilePrivateWrites",
    "clearPrivateScreen",
  ]) assert.ok(ui.includes(securityContract), `Profile security contract changed or disappeared: ${securityContract}`);
});

test("#1730 keeps one dominant completion action while preserving 44px targets and keyboard focus", async () => {
  const css = await read("app/profile-access/profile-access-boundary.module.css");

  assert.match(css, /form \.actions button\[type="submit"\][\s\S]*background:\s*var\(--pp-profile-juniper\)/u);
  assert.match(css, /\.card > button[\s\S]*background:\s*var\(--pp-profile-juniper\)/u);
  assert.match(css, /min-height:\s*var\(--pp-touch-target\)/u);
  assert.match(css, /:focus-visible[\s\S]*outline:\s*2px solid var\(--pp-profile-status\)/u);
  assert.match(css, /@media\s*\(max-width:\s*700px\)/u);
});
