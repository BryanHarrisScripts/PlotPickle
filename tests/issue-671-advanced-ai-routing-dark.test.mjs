import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#671 Advanced AI routing stays inside the matte-black Settings surface family", async () => {
  const [page, settings, routing, consoleStyles] = await Promise.all([
    read("app/ai-routing/page.tsx"),
    read("app/sage-settings-workspace.tsx"),
    read("app/ai-routing-panel.module.css"),
    read("app/ai-routing-source-console.module.css"),
  ]);

  assert.match(page, /redirect\("\/\?workspace=settings#settings-routing"\)/);
  assert.match(settings, /id="settings-routing"/);
  assert.match(settings, /<AiRoutingPanel \/>/);
  assert.match(routing, /--routing-bg: #090a0b/);
  assert.match(routing, /--routing-panel: #111315/);
  assert.match(routing, /--routing-raised: #171a1c/);
  assert.match(routing, /--routing-teal: #35c9b8/);
  assert.match(routing, /--routing-gold: #c89446/);
  assert.match(routing, /\.panel \{[\s\S]*background:[\s\S]*var\(--routing-bg\)/);
  assert.match(routing, /\.header \{[\s\S]*background: linear-gradient\(145deg, #171a1c, #101315\)/);
  assert.match(routing, /\.consent \{[\s\S]*background: var\(--routing-panel\)/);
  assert.match(routing, /\.group \{[\s\S]*background: var\(--routing-panel\)/);
  assert.match(routing, /\.option \{[\s\S]*background: #151819/);
  assert.match(routing, /\.loading \{[\s\S]*background: var\(--routing-bg\)/);

  for (const legacyLightSurface of ["#f4faf9", "#eaf7f4", "#f9fcfb", "#fbfdfd", "#fffaf0", "#fff4d8"]) {
    assert.doesNotMatch(routing, new RegExp(legacyLightSurface, "i"));
  }
  assert.doesNotMatch(routing, /background:\s*#ffffff/i);
  assert.doesNotMatch(routing, /background:[^;]*\bwhite\b/i);
  assert.match(consoleStyles, /\.sourceConsole \{[\s\S]*linear-gradient\(145deg, #12161d, #181d26 64%, #11151b\)/);
});

test("#671 explains Advanced AI routing in writer-friendly language inside Settings", async () => {
  const [settings, panel, page] = await Promise.all([
    read("app/sage-settings-workspace.tsx"),
    read("app/ai-routing-panel.tsx"),
    read("app/ai-routing/page.tsx"),
  ]);

  assert.match(panel, /Choose where writing, images and video are created/);
  assert.match(panel, /Each job has one active choice/);
  assert.match(panel, /Off and Manual Import are explicit safe choices/);
  assert.match(settings, /One active choice per job/);
  assert.match(settings, /Ollama is optional and no longer defines the local architecture/);
  assert.match(settings, /AI provider routing is configured in the dedicated AI Routing section above so the hardware view is not repeated/);
  assert.match(settings, /<LocalRuntimePanel \/>/);
  assert.match(settings, /<AiRoutingPanel \/>/);
  assert.doesNotMatch(page, /LocalRuntimePanel|AiRoutingPanel|<main/);
});

test("Advanced AI route controls are one explicit choice per capability", async () => {
  const panel = await read("app/ai-routing-panel.tsx");

  assert.match(panel, /type="radio"/);
  assert.match(panel, /name={`ai-route-\${capability}`}/);
  assert.match(panel, /checked=\{selected\}/);
  assert.match(panel, /onChange=\{\(\) => void select\(capability, route\)\}/);
  assert.match(panel, /disabled=\{Boolean\(working\) \|\| \(!selectable && !selected\)\}/);
  assert.match(panel, /route === "off" \|\| route === "manual" \|\| option\.ready/);
  assert.doesNotMatch(panel, /function fallbackRoute/);
  assert.doesNotMatch(panel, /toggleRoute\(/);
  assert.doesNotMatch(panel, /Turn off|Turn on/);
});
