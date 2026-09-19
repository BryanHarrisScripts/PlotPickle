import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2092 phase 3 keeps the Dashboard PRE-PRODUCTION IA at Outline / Storyboard / Previs", async () => {
  const registry = await read("app/skin-v1/dashboard-menu-registry.ts");
  assert.match(registry, /label: "Outline"[\s\S]*group: "PRE-PRODUCTION"/);
  assert.match(registry, /label: "Storyboard"[\s\S]*group: "PRE-PRODUCTION"/);
  assert.match(registry, /label: "Previs"[\s\S]*group: "PRE-PRODUCTION"/);
  assert.doesNotMatch(registry, /label: "Breakdown"/);
  assert.doesNotMatch(registry, /label: "Production Plan"/);
});

test("#2092/#2189 uses one shared PRE-PRODUCTION context strip while canonical Outline returns to the PPF Story Map", async () => {
  const [nav, outlineLayout, storyboardLayout, previsLayout] = await Promise.all([
    read("app/_components/preproduction/preproduction-context-nav.tsx"),
    read("app/structure/layout.tsx"),
    read("app/storyboard/layout.tsx"),
    read("app/previs/layout.tsx"),
  ]);

  assert.match(nav, /PRE-PRODUCTION/);
  assert.match(nav, /Story Cards → 24\/96 Story Map · source evidence/);
  assert.match(nav, /Visual Beats → Shots → Frames/);
  assert.match(nav, /Timing → Production Plan · Provider-neutral handoff/);
  assert.match(nav, /href: "\/\?workspace=dashboard"/);
  assert.match(nav, /href: "\/storyboard"/);
  assert.match(nav, /href: "\/previs"/);
  assert.match(nav, /function withAddress/);
  assert.match(nav, /url\.searchParams\.set\("block", String\(blockNumber\)\)/);
  assert.match(nav, /url\.searchParams\.set\("mini", String\(miniBlockNumber\)\)/);
  assert.match(nav, /withAddress\(AREAS\[stage\]\.href, activeBlock, routeMini\)/);
  assert.match(nav, /withAddress\("\/\?workspace=dashboard", activeBlock, routeMini\)/);
  assert.doesNotMatch(nav, /href: "\/structure"/);

  assert.match(outlineLayout, /PreproductionContextNav area="outline"/);
  assert.match(storyboardLayout, /PreproductionContextNav area="storyboard"/);
  assert.match(previsLayout, /PreproductionContextNav area="previs"/);
});

test("#2092/#2189 keeps legacy Outline peers contextual while returning to the canonical PPF Story Map", async () => {
  const [nav, outlineCss, returnNav] = await Promise.all([
    read("app/_components/preproduction/preproduction-context-nav.tsx"),
    read("app/structure/preproduction-context.module.css"),
    read("app/_components/preproduction/preproduction-capability-return.tsx"),
  ]);

  assert.match(nav, /CraftLoop · Practice/);
  assert.match(nav, /PageFlow · Diagnostic/);
  assert.match(nav, /from=preproduction&return=/);
  assert.match(outlineCss, /workspace=plan&section=structureMap/);
  assert.match(outlineCss, /a\[href="\/craftloop"\]/);
  assert.match(outlineCss, /a\[href="\/pageflow"\]/);
  assert.match(returnNav, /Return to Outline/);
  assert.match(returnNav, /data-preproduction-return="true"/);
  assert.match(returnNav, /data-skin-v1-local-chrome="return-navigation"/);
  assert.match(returnNav, /function safeReturnTarget/);
  assert.match(returnNav, /source\.origin !== INTERNAL_ORIGIN/);
  assert.match(returnNav, /source\.pathname === "\/" && source\.searchParams\.get\("workspace"\) === "dashboard"/);
  assert.match(returnNav, /source\.pathname === "\/storyboard"/);
  assert.match(returnNav, /source\.pathname === "\/previs"/);
  assert.match(returnNav, /function boundedStoryAddress/);
  assert.match(returnNav, /function dashboardReturnPath/);
  assert.doesNotMatch(nav, /href: "\/structure"/);
  assert.doesNotMatch(returnNav, /startsWith\("\/"\)|source\.pathname === "\/structure"/);
  assert.match(returnNav, /source\.searchParams\.get\("block"\)/);
  assert.match(returnNav, /source\.searchParams\.get\("mini"\)/);
});

test("#2092 phase 3 prevents contextual CraftLoop and PageFlow from replacing PRE-PRODUCTION orientation", async () => {
  const [craftLayout, craftCss, pageFlowLayout, pageFlowCss] = await Promise.all([
    read("app/craftloop/layout.tsx"),
    read("app/craftloop/preproduction-context.module.css"),
    read("app/pageflow/layout.tsx"),
    read("app/pageflow/preproduction-context.module.css"),
  ]);

  for (const layout of [craftLayout, pageFlowLayout]) {
    assert.match(layout, /fromPreproduction/);
    assert.match(layout, /PreproductionCapabilityReturn/);
    assert.match(layout, /data-preproduction-context/);
  }

  for (const href of ["/diagnostics", "/resonance", "/voiceprint", "/pageflow", "/draftlens"]) {
    assert.ok(craftCss.includes(`href="${href}"`), `CraftLoop contextual shell should hide ${href}`);
  }
  assert.match(pageFlowCss, /nav\[aria-label="Refine navigation"\]/);
  assert.match(pageFlowCss, /workspace=refine/);
});

test("#2092 phase 3 registers connected UI and skin ownership instead of bypassing architecture verification", async () => {
  const ownership = JSON.parse(await read("config/verification/ownership-map.json"));
  const experience = ownership.rules.find((rule) => rule.id === "preproduction-connected-experience");
  const skin = ownership.rules.find((rule) => rule.id === "preproduction-connected-skin");

  assert.equal(experience?.ownerLayer, "experience-contract");
  assert.equal(skin?.ownerLayer, "experience-skins");
  assert.ok(experience.include.includes("app/_components/preproduction/*.tsx"));
  assert.ok(skin.include.includes("app/_components/preproduction/*.module.css"));
});
