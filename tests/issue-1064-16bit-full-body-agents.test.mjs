import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const helpers = JSON.parse(readFileSync(resolve(root, "config/helper-directory.json"), "utf8")).helpers;
const helpCss = readFileSync(resolve(root, "app/settings-helper-directory.module.css"), "utf8");
const helpUi = readFileSync(resolve(root, "app/settings-helper-directory.tsx"), "utf8");
const learnUi = readFileSync(resolve(root, "modules/learn/ui/learn-workspace.tsx"), "utf8");

test("#1064 leaves Sage on the approved current art and explicitly excludes the rejected Sage reference", () => {
  const sage = helpers.find((helper) => helper.id === "sage-brinewick");
  assert.equal(sage?.portrait, "/assets/helpers/lore/sage-brinewick.svg");
  assert.doesNotMatch(sage?.portrait || "", /16bit/i);
  const relevantSource = `${JSON.stringify(helpers)}\n${helpUi}\n${learnUi}`;
  assert.doesNotMatch(relevantSource, /Sage543x768-v2/i);
  assert.match(learnUi, /src="\/assets\/sage-brinewick-v2\.png"/);
});

test("#1064 gives every non-Sage helper a distinct transparent 160x220 16-bit full-body master", () => {
  const nonSage = helpers.filter((helper) => helper.id !== "sage-brinewick");
  assert.equal(nonSage.length, 16);
  const portraits = new Set();

  for (const helper of nonSage) {
    assert.match(helper.portrait, /^\/assets\/helpers\/16bit\/[a-z0-9-]+\.svg$/);
    assert.equal(portraits.has(helper.portrait), false, `${helper.id} reuses another helper portrait`);
    portraits.add(helper.portrait);

    const filePath = resolve(root, "public", helper.portrait.slice(1));
    assert.ok(existsSync(filePath), `${helper.id} portrait is missing`);
    const svg = readFileSync(filePath, "utf8");
    assert.match(svg, /<svg[^>]*width="160"[^>]*height="220"[^>]*viewBox="0 0 160 220"/i);
    assert.match(svg, /shape-rendering="crispEdges"/i);
    assert.match(svg, /<title[^>]*>[^<]+16-bit full-body lore portrait<\/title>/i);
    assert.doesNotMatch(svg, /<rect[^>]*width="160"[^>]*height="220"[^>]*fill=/i, `${helper.id} should keep a transparent master background`);
  }
});

test("#1064 Settings Help presents helper art inside a PlotPickle circular medallion", () => {
  assert.match(helpCss, /\.portraitFrame\s*\{[^}]*aspect-ratio:\s*1;/s);
  assert.match(helpCss, /\.portraitFrame\s*\{[^}]*border-radius:\s*50%;/s);
  assert.match(helpCss, /\.portraitFrame\s*\{[^}]*border:\s*3px solid #d7bc76;/s);
  assert.match(helpCss, /rgba\(53, 201, 184,/);
  assert.match(helpCss, /\.portraitFrame::before\s*\{[^}]*border-radius:\s*50%;/s);
  assert.match(helpCss, /\.portrait\s*\{[^}]*object-fit:\s*contain;/s);
  assert.match(helpCss, /\.portrait\s*\{[^}]*object-position:\s*center bottom;/s);
  assert.match(helpCss, /image-rendering:\s*pixelated/);
  assert.match(helpUi, /className=\{styles\.portraitFrame\}/);
});

test("#1064 remains a visual-only presentation change", () => {
  for (const helper of helpers) {
    assert.deepEqual(Object.keys(helper).sort(), ["group", "how", "id", "portrait"]);
  }
  assert.doesNotMatch(helpUi, /requestedCapabilities|forbiddenCapabilities\s*=|creativeAuthority\s*=|buzzBinding\s*=/);
});
