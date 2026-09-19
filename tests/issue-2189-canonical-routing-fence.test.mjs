import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2189 canonical PRE-PRODUCTION Outline handoff stays on the profile-owned PPF Story Map", async () => {
  const [nav, returns, manifestText] = await Promise.all([
    read("app/_components/preproduction/preproduction-context-nav.tsx"),
    read("app/_components/preproduction/preproduction-capability-return.tsx"),
    read("config/verification/afterglow-story-to-screen-uat.json"),
  ]);
  const manifest = JSON.parse(manifestText);
  const outline = manifest.humanUat.stages.find((stage) => stage.id === "outline");

  assert.match(nav, /href: "\/\?workspace=dashboard"/u);
  assert.match(nav, /withAddress\("\/\?workspace=dashboard", activeBlock, routeMini\)/u);
  assert.doesNotMatch(nav, /href: "\/structure"/u);
  assert.doesNotMatch(nav, /withAddress\("\/structure"/u);

  assert.match(returns, /return "\/\?workspace=dashboard"/u);
  assert.match(returns, /returnPath: "\/\?workspace=dashboard"/u);
  assert.doesNotMatch(returns, /return "\/structure"|returnPath: "\/structure"/u);

  assert.equal(outline.route, "/?workspace=dashboard&block=17&mini=1");
  assert.equal(outline.selector, "[data-progressive-story-map='24x96']");
});

test("#2189 canonical story-to-screen manifest does not present legacy Structure or Production pages as current stages", async () => {
  const manifestText = await read("config/verification/afterglow-story-to-screen-uat.json");
  const manifest = JSON.parse(manifestText);
  const routes = manifest.humanUat.stages.map((stage) => stage.route);

  assert.equal(routes.some((route) => route.startsWith("/structure")), false);
  assert.equal(routes.some((route) => route.startsWith("/production")), false);
  assert.equal(manifest.humanUat.stages.find((stage) => stage.id === "production")?.route, "/storyboard?block=17&mini=1");
});

test("#2189 legacy Structure and Production pages remain detectable while Reports uses its own canonical route", async () => {
  const [structure, production, reports] = await Promise.all([
    read("app/structure/page.tsx"),
    read("app/production/page.tsx"),
    read("app/reports/page.tsx"),
  ]);

  assert.match(structure, /plotpickle\.project\.v1/u);
  assert.match(production, /plotpickle\.project\.v1/u);
  assert.match(reports, /data-reports-workspace="canonical"/u);
  assert.match(reports, /<ReportsWorkspace/u);
});
