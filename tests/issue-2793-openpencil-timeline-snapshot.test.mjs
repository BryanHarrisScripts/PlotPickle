import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const json = async (path) => JSON.parse(await read(path));

test("#2793 bounds Timeline capture to the rendered governed surface", async () => {
  const [contract, capture, host] = await Promise.all([
    json("config/openpencil-design-snapshot.json"),
    read("app/skin-v1/openpencil-design-snapshot.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);

  assert.equal(contract.timeline.surface, "Timeline");
  assert.equal(contract.timeline.rootSelector, '[data-dashboard-review-surface="timeline"]');
  assert.equal(contract.timeline.readySelector, '[data-timeline-assembly="previs-media"]');
  assert.ok(contract.timeline.maxNodes <= 900);
  assert.ok(contract.timeline.maxHtmlChars <= 1_500_000);
  assert.match(capture, /window\.getComputedStyle\(source\)/u);
  assert.match(capture, /source\.getBoundingClientRect\(\)/u);
  assert.match(capture, /position:absolute/u);
  assert.match(capture, /SKIP_TAGS = new Set\(\["script", "style", "link", "meta", "noscript", "template"\]\)/u);
  assert.match(capture, /state\.count >= TIMELINE\.maxNodes/u);
  assert.match(capture, /data-openpencil-design-snapshot/u);
  assert.match(host, /plotpickle:openpencil-design-capture/u);
  assert.match(host, /setTimelineOpen\(true\)/u);
});

test("#2793 sends the authenticated live Timeline snapshot through the existing OpenPencil profile boundary", async () => {
  const [conversation, gateway, profileContext] = await Promise.all([
    read("app/skin-v1/global-dsdd-conversation.tsx"),
    read("build/openpencil/openpencil-gui-gateway.ts"),
    read("build/auth/profile-request-context.ts"),
  ]);
  assert.match(conversation, /captureOpenPencilTimelineSnapshot\(\)/u);
  assert.match(conversation, /designSnapshot: timelineSnapshot/u);
  assert.match(gateway, /currentProfileRequestContext\(\)/u);
  assert.match(gateway, /readDsddRequestBody\(request, 2_000_000\)/u);
  assert.match(gateway, /designSnapshot: body\.designSnapshot/u);
  assert.match(profileContext, /"\/api\/openpencil"/u);
});

test("#2793 imports live Timeline HTML\/CSS into a new editable FIG and preserves the old scaffold", async () => {
  const [registry, runtime] = await Promise.all([
    json("designs/openpencil/surfaces.json"),
    read("build/openpencil/openpencil-gui-runtime.mjs"),
  ]);
  const timeline = registry.surfaces.find((surface) => surface.name === "Timeline");
  assert.equal(timeline.file, "timeline-live.fig");
  assert.equal(timeline.bootstrap, "bootstrap/timeline.pen");
  assert.equal(timeline.capture, "rendered-live-v1");
  assert.match(runtime, /validateRenderedSnapshot/u);
  assert.match(runtime, /"import",[\s\S]*"--output", target\.designFile[\s\S]*"--format", "fig"[\s\S]*"--pageName", target\.page[\s\S]*"--css", cssPath/u);
  assert.match(runtime, /if \(!dependencies\.exists\(target\.designFile\)\)/u);
  assert.match(runtime, /bootstrapState = "rendered-snapshot"/u);
  assert.match(runtime, /bootstrapState = "materialized"/u);
});

test("#2793 keeps WebMCP as isolated synthetic verification rather than inheriting Human story data", async () => {
  const [startup, director] = await Promise.all([
    read("scripts/run-webmcp-startup-uat.mjs"),
    read("lib/verification/skin-v1-visual-director.mjs"),
  ]);
  assert.match(startup, /Synthetic Human ready/u);
  assert.match(startup, /Private Human cookies, credentials and story data are not inherited/u);
  assert.match(startup, /storageStatePath: auth\.storageStatePath/u);
  assert.match(director, /page\.evaluate/u);
  assert.match(director, /getComputedStyle\(node\)/u);
});
