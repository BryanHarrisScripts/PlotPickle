import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#671 Advanced AI routing stays inside the matte-black Settings surface family", async () => {
  const [page, routing, consoleStyles] = await Promise.all([
    read("app/ai-routing/page.tsx"),
    read("app/ai-routing-panel.module.css"),
    read("app/ai-routing-source-console.module.css"),
  ]);

  assert.match(page, /background: "#090a0b"/);
  assert.match(page, /color: "#f1eee7"/);
  assert.match(routing, /--routing-bg: #090a0b/);
  assert.match(routing, /--routing-panel: #111315/);
  assert.match(routing, /--routing-raised: #171a1c/);
  assert.match(routing, /--routing-teal: #35c9b8/);
  assert.match(routing, /--routing-orange: #f08a4b/);
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
