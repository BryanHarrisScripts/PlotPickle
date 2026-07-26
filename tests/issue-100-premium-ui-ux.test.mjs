import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #100 opens on the approved marketing splash with five current components", async () => {
  const [page, splash, contract] = await Promise.all([
    source("app/page.tsx"),
    source("app/marketing-splash.tsx"),
    source("lib/product-direction.ts"),
  ]);
  assert.match(page, /useState\(true\)/);
  assert.match(page, /MarketingSplash/);
  assert.match(splash, /components\.map/);
  assert.match(splash, /Your whole film/);
  assert.match(splash, /Five reasons to use PlotPickle/);
  for (const id of ["learn", "plan", "write", "storyboard", "refine"]) {
    assert.match(contract, new RegExp(`id: "${id}"`));
    await access(new URL(`public/brand/components/${id}.svg`, root));
  }
  await access(new URL("public/brand/marketing/plotpickle-multi-server-collaboration.svg", root));
});

test("issue #100 centers the application menu through one shared premium shell", async () => {
  const [layout, css] = await Promise.all([source("app/layout.tsx"), source("app/premium-ui.css")]);
  assert.match(layout, /premium-ui\.css/);
  assert.match(css, /\.topbar\{grid-template-columns:minmax\(190px,1fr\) auto minmax\(190px,1fr\)/);
  assert.match(css, /\.main-tabs\{justify-self:center/);
  assert.match(css, /--premium-shadow/);
  assert.match(css, /button:focus-visible,a:focus-visible/);
});

test("issue #100 dashboard uses accessible green yellow and red status states", async () => {
  const [page, css] = await Promise.all([source("app/page.tsx"), source("app/premium-ui.css")]);
  for (const tone of ["green", "yellow", "red"]) {
    assert.match(page, new RegExp(`"${tone}"`));
    assert.match(css, new RegExp(`\\.status-${tone}`));
  }
  assert.match(page, /Status uses text, symbols and colour together/);
  assert.match(page, /dashboard-status-grid/);
  assert.match(page, /status-legend/);
});

test("issue #100 long dashboard and reports workspaces use left-side section navigation", async () => {
  const [page, reports, reportCss] = await Promise.all([source("app/page.tsx"), source("app/settings-project-tools.tsx"), source("app/settings-project-tools.module.css")]);
  assert.match(page, /workspace-subnav dashboard-nav/);
  assert.match(reports, /reportLayout/);
  assert.match(reports, /aria-label="Report sections"/);
  assert.match(reportCss, /\.reportLayout/);
  assert.match(reportCss, /position:sticky/);
});
