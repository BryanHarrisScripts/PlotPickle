import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1392 gives 24-Block summaries legends and tiles one semantic status palette", async () => {
  const [component, css] = await Promise.all([
    read("app/build-health-map.tsx"),
    read("app/build-health-map.module.css"),
  ]);

  for (const tone of ["green", "yellow", "red"]) {
    assert.match(component, new RegExp(`data-tone="${tone}"`));
    assert.match(css, new RegExp(`\\[data-tone="${tone}"\\] \\{ --health-tone: var\\(--health-${tone}\\)`));
  }
  for (const owner of [".summary div", ".legend span", ".tile {"]) {
    assert.ok(css.includes(owner), `missing status surface ${owner}`);
  }
  assert.match(css, /\.legend span[^}]+color:\s*var\(--health-tone\)/s);
  assert.match(css, /\.tile \{[^}]+border-left:\s*4px solid var\(--health-tone\)/s);
  assert.match(css, /\.status \{[^}]+color:\s*var\(--health-tone\)/s);
  assert.match(css, /\.tile\[data-selected="true"\][^}]+var\(--health-tone\)/s);
  for (const token of ["#2f9f79", "#d79b2e", "#d65a5a"]) {
    assert.equal(css.split(token).length - 1, 1, `${token} must be declared once as a semantic token`);
  }
});

test("#1392 aligns sequence cards and renders exactly three TP act markers", async () => {
  const [component, css] = await Promise.all([
    read("modules/build/ui/progressive-story-map.tsx"),
    read("modules/build/ui/progressive-story-map.module.css"),
  ]);

  assert.match(component, /const ABSOLUTE_TURNING_POINTS[\s\S]+3: 1,[\s\S]+9: 2,[\s\S]+12: 3/);
  assert.match(component, /sequence\.actNumber \? \([\s\S]+className=\{styles\.turningPoint\}[\s\S]+<strong>A\{sequence\.actNumber\}<\/strong><span>TP<\/span>/);
  assert.match(component, /className=\{styles\.turningPointSpacer\}/);
  assert.doesNotMatch(component, /Potential turning point|<span>PT<\/span>|data-kind=/);
  assert.match(css, /\.sequenceSlot \{[\s\S]+align-items:\s*stretch/);
  assert.match(css, /\.sequenceBox \{[\s\S]+text-align:\s*left/);
  assert.match(css, /\.sequenceBlocks \{[\s\S]+grid-template-columns:\s*repeat\(2/);
  assert.match(css, /\.block\[aria-pressed="true"\][^}]+var\(--story-state\)/s);
  assert.doesNotMatch(css, /\.block\[aria-pressed="true"\][^{]*\{[^}]*(?:border-color|background):/s);
});

test("#1392 makes Profile use the global navigation dimensions and typography rhythm", async () => {
  const [profileCss, navCss] = await Promise.all([
    read("app/profile-access/profile-identity-overlay.module.css"),
    read("app/plotpickle-workspace-shell.module.css"),
  ]);

  for (const contract of ["width: 64px", "height: 70px", "width: 44px", "height: 44px", "font-size: 10px", 'var(--font-mono, "Courier New", monospace)']) {
    assert.ok(profileCss.includes(contract), `Profile parity is missing ${contract}`);
    assert.ok(navCss.includes(contract), `global navigation reference is missing ${contract}`);
  }
  assert.match(profileCss, /\.surface \{[\s\S]+position:\s*fixed;[\s\S]+top:\s*86px/);
});

test("#1392 gives detailed ComfyUI setup one Settings owner and preserves route safety", async () => {
  const [settings, compute, media] = await Promise.all([
    read("app/sage-settings-workspace.tsx"),
    read("app/settings/compute/ai-compute-workspace.tsx"),
    read("app/media-routing-panel.tsx"),
  ]);

  assert.match(settings, /id: "comfyui", label: "ComfyUI Setup"/);
  assert.match(settings, /case "comfyui":[\s\S]+id="settings-comfyui"[\s\S]+<MediaRoutingPanel/);
  assert.match(settings, /"settings-comfyui": "comfyui"/);
  assert.match(settings, /comfyui: "comfyui"/);
  assert.equal(settings.match(/<MediaRoutingPanel/g)?.length, 1);
  assert.doesNotMatch(compute, /import MediaRoutingPanel|<MediaRoutingPanel/);
  assert.match(compute, /Local Compute keeps the current ComfyUI readiness and route selection visible above/);
  assert.match(compute, /detail: "comfyui"/);
  assert.match(media, /never falls back to a paid provider automatically/);
  assert.match(media, /Paid H3 test approval/);
  assert.match(media, /billingAcknowledged/);
  assert.match(media, /window\.confirm/);
});
