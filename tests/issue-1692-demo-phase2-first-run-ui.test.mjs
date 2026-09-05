import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1692 Phase 2 mounts DEMO outside existing profile authority", async () => {
  const [layout, profileBoundary] = await Promise.all([
    read("app/layout.tsx"),
    read("app/profile-access/profile-access-boundary.tsx"),
  ]);

  assert.match(layout, /<DemoOnboardingBoundary>[\s\S]*<ProfileAccessBoundary>[\s\S]*<\/ProfileAccessBoundary>[\s\S]*<\/DemoOnboardingBoundary>/u);
  assert.match(layout, /profile-access\/demo\/demo-onboarding-boundary/u);
  assert.doesNotMatch(profileBoundary, /DemoExperience|DemoOnboardingBoundary|demo-onboarding/u);
  assert.match(profileBoundary, /if \(next\.accessMode === "server-network"\)[\s\S]*return next\.configured \? "login" : "create";/u);
  assert.match(profileBoundary, /setScreen\("guest"\)/u);
});

test("#1692 Phase 2 fresh desktop entry offers DEMO or the existing local profile path", async () => {
  const source = await read("app/profile-access/demo/demo-onboarding-boundary.tsx");

  assert.match(source, /status\.accessMode === "desktop-loopback"[\s\S]*!status\.configured[\s\S]*!status\.authenticated/u);
  assert.match(source, /DEMO — See PlotPickle work/u);
  assert.match(source, /ENTER PLOTPICKLE — Create your local profile/u);
  assert.match(source, /setMode\("normal"\)/u);
  assert.doesNotMatch(source, /create-first-profile|create-profile|login|logout|switch-profile/u);
});

test("#1692 Phase 2 does not expose DEMO as anonymous server-network application access", async () => {
  const [boundary, route] = await Promise.all([
    read("app/profile-access/demo/demo-onboarding-boundary.tsx"),
    read("app/api/demo/story/route.ts"),
  ]);

  assert.match(boundary, /accessMode: "desktop-loopback" \| "server-network"/u);
  assert.match(boundary, /function isFreshDesktop\([\s\S]*status\.accessMode === "desktop-loopback"/u);
  assert.match(boundary, /function canOfferReturningDemo\([\s\S]*status\?\.accessMode === "desktop-loopback"/u);
  assert.doesNotMatch(boundary, /status\.accessMode === "server-network"[\s\S]*setMode\("demo"\)/u);
  assert.match(route, /runtime = "nodejs"/u);
  assert.match(route, /runtimeState\.accessMode === "desktop-loopback"/u);
  assert.match(route, /DEMO_LOCAL_ONLY/u);
  assert.doesNotMatch(route, /profile-private|provider|connector|BUZZ_AUTH|github|google/iu);
});

test("#1692 Phase 2 returning locked desktop users keep the existing chooser with DEMO as a secondary action", async () => {
  const source = await read("app/profile-access/demo/demo-onboarding-boundary.tsx");

  assert.match(source, /status\.configured[\s\S]*!status\.authenticated[\s\S]*!status\.autonomousGuest\?\.active/u);
  assert.match(source, /returningDemoVisible && canOfferReturningDemo\(status\)[\s\S]*Try DEMO/u);
  assert.match(source, /data-profile-access-boundary="locked"[\s\S]*setReturningDemoVisible\(false\)/u);
});

test("#1692 Phase 2 browser surface uses a local projection instead of bundling Node-only STORY mechanics", async () => {
  const [client, route] = await Promise.all([
    read("app/profile-access/demo/demo-experience.tsx"),
    read("app/api/demo/story/route.ts"),
  ]);

  assert.match(client, /fetch\("\/api\/demo\/story"/u);
  assert.match(client, /data-demo-runtime="synthetic-demo-runtime"/u);
  assert.match(client, /data-demo-storage="demo-owned-disposable"/u);
  assert.doesNotMatch(client, /core\/demo-onboarding|modules\/story-the-unwritten|node:crypto|createStoryDemoWorld|applyStoryDemoDecision|resetStoryDemoWorld/u);

  assert.match(route, /core\/demo-onboarding\/demo-boundary\.mjs/u);
  assert.match(route, /modules\/story-the-unwritten\/demo\/world\.mjs/u);
  assert.match(route, /createStoryDemoWorld/u);
  assert.match(route, /replayStoryDemoWorld/u);
  assert.match(route, /assertStoryDemoSyntheticRefs/u);
});

test("#1692 Phase 2 DEMO provides explicit reset, exit and transition controls", async () => {
  const source = await read("app/profile-access/demo/demo-experience.tsx");

  assert.match(source, /Reset DEMO/u);
  assert.match(source, /Exit DEMO/u);
  assert.match(source, /Enter PlotPickle/u);
  assert.match(source, /onEnterPlotPickle/u);
  assert.match(source, /onExit/u);
  assert.match(source, /action: "reset"/u);
});
