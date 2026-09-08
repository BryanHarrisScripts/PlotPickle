import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#1754 defines a headless Experience contract before Skin V2 presentation", async () => {
  const [contract, registry] = await Promise.all([
    read("core/contracts/experience.ts"),
    read("lib/experience/surface-registry.ts"),
  ]);

  for (const surface of ["LOGON", "HOME", "COMMUNITY", "STORY_WORKSPACE", "STORYBOARD", "SETTINGS"]) {
    assert.match(contract, new RegExp(`\\| \\"${surface}\\"|\\"${surface}\\"`));
  }
  for (const contractName of ["ExperienceSurfaceTopology", "ExperienceIntent", "ExperienceIntentResult", "ExperienceEvent"]) {
    assert.match(contract, new RegExp(contractName));
  }
  assert.match(contract, /baseRevision/);
  assert.match(registry, /authenticated \? "HOME" : "LOGON"/);
  assert.match(registry, /NOT_MIGRATED_TO_HEADLESS_EXPERIENCE/);
  assert.doesNotMatch(registry, /react|window\.|document\.|fetch\(/i);
});

test("#1754 Skin V2 is presentation-only and starts with LOGON -> blank HOME", async () => {
  const [runtime, page, css, layout] = await Promise.all([
    read("app/barebones-skin-runtime.tsx"),
    read("app/v2/page.tsx"),
    read("app/barebones-skin.css"),
    read("app/layout.tsx"),
  ]);

  assert.match(runtime, /pathname === "\/v2"/);
  assert.match(runtime, /dataset\.plotpickleSkin = BAREBONES_SKIN/);
  assert.match(page, /deriveBarebonesSurfaceTopology\(\{ authenticated: true \}\)/);
  assert.match(page, /data-experience-surface=\{topology\.defaultSurface\}/);
  assert.match(page, />HOME</);
  assert.doesNotMatch(page, /fetch\(|authenticatedProfileFetch|applyStoryCommand|saveFoundationProject/);
  assert.match(css, /#000/);
  assert.match(css, /#fff/);
  assert.match(css, /data-profile-access-boundary="locked"/);
  assert.match(layout, /<BarebonesSkinRuntime \/>/);
  assert.match(layout, /import "\.\/barebones-skin\.css"/);
});
