import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function rule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Missing CSS rule for ${selector}`);
  return match[1];
}

test("#1369 Node control shares the primary navigation footprint and typography", async () => {
  const css = await read("app/plotpickle-workspace-shell.module.css");

  const nodeControl = rule(css, ".nodeControl");
  const nodeButton = rule(css, ".nodeButton");
  const nodeMark = rule(css, ".nodeMark");
  const navItem = rule(css, ".list li");
  const navButton = rule(css, ".list button");
  const navRelic = rule(css, ".relic");
  const nodeTitle = rule(css, ".nodeButton > span");
  const nodeDetail = rule(css, ".nodeButton > small");
  const navTitle = rule(css, ".copy strong");
  const navDetail = rule(css, ".copy small");

  assert.match(nodeControl, /top:\s*6px/);
  assert.match(nodeControl, /width:\s*64px/);
  assert.match(nodeButton, /width:\s*64px/);
  assert.match(navItem, /width:\s*64px/);
  assert.match(nodeButton, /gap:\s*2px/);
  assert.match(navButton, /gap:\s*2px/);
  assert.match(nodeButton, /padding:\s*0 1px 2px/);
  assert.match(navButton, /padding:\s*0 1px 2px/);

  assert.match(nodeMark, /width:\s*44px/);
  assert.match(nodeMark, /height:\s*44px/);
  assert.match(navRelic, /width:\s*44px/);
  assert.match(navRelic, /height:\s*44px/);
  assert.match(nodeMark, /filter:\s*saturate\(0\.82\) brightness\(0\.84\)/);
  assert.match(navRelic, /filter:\s*saturate\(0\.82\) brightness\(0\.84\)/);

  assert.match(nodeTitle, /font-size:\s*10px/);
  assert.match(navTitle, /font-size:\s*10px/);
  assert.match(nodeTitle, /font-weight:\s*700/);
  assert.match(navTitle, /font-weight:\s*700/);
  assert.match(nodeDetail, /font-size:\s*8\.5px/);
  assert.match(navDetail, /font-size:\s*8\.5px/);
});

test("#1369 Node control keeps nav-like interaction without becoming a separate card", async () => {
  const [css, shell] = await Promise.all([
    read("app/plotpickle-workspace-shell.module.css"),
    read("app/plotpickle-workspace-shell.tsx"),
  ]);

  assert.doesNotMatch(css, /\.nodeButton:hover,\s*\.nodeButton:focus-visible,\s*\.nodeButton\[aria-expanded="true"\][^{]*\{[^}]*background:/s);
  assert.match(css, /\.nodeButton:hover \.nodeMark\s*\{[^}]*translateY\(-1px\)/s);
  assert.match(css, /\.nodeButton\[aria-expanded="true"\] \.nodeMark\s*\{[^}]*drop-shadow/s);
  assert.match(shell, /className=\{styles\.nodeButton\}/);
  assert.match(shell, /aria-expanded=\{open\}/);
  assert.match(shell, /setOpen\(next\)/);
  assert.match(shell, /<NodeControl \/>/);
  assert.match(shell, /Shut Down PlotPickle/);
});
