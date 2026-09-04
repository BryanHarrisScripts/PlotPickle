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
  assert.doesNotMatch(profileBoundary, /DemoExperience|DemoOnboardingBoundary|demo-onboarding/u);
  assert.match(profileBoundary, /if \(next\.accessMode === "server-network"\)[\s\S]*return next\.configured \? "login" : "create";/u);
  assert.match(profileBoundary, /setScreen\("guest"\)/u);
});

test("#1692 Phase 2 fresh desktop entry offers DEMO or the existing local profile path", async () => {
  const source = await read("app/profile-access/demo-onboarding-boundary.tsx");

  assert.match(source, /status\.accessMode === "desktop-loopback"[\s\S]*!status\.configured[\s\S]*!status\.authenticated/u);
  assert.match(source, /DEMO — See PlotPickle work/u);
  assert.match(source, /ENTER PLOTPICKLE — Create your local profile/u);
  assert.match(source, /setMode\("normal"\)/u);
  assert.doesNotMatch(source, /create-first-profile|create-profile|login|logout|switch-profile/u);
});

test("#1692 Phase 2 does not expose DEMO as anonymous server-network application access", async () => {
  const source = await read("app/profile-access/demo-onboarding-boundary.tsx");

  assert.match(source, /accessMode: "desktop-loopback" \| "server-network"/u);
  assert.equal((source.match(/status\.accessMode === "desktop-loopback"/gu) || []).length, 2);
  assert.doesNotMatch(source, /status\.accessMode === "server-network"[\s\S]*setMode\("demo"\)/u);
  assert.doesNotMatch(source, /fetch\([^\n]*(?:provider|github|google|buzz)/iu);
});

test("#1692 Phase 2 returning locked desktop users keep the existing chooser with DEMO as a secondary action", async () => {
  const source = await read("app/profile-access/demo-onboarding-boundary.tsx");

  assert.match(source, /status\.configured[\s\S]*!status\.authenticated[\s\S]*!status\.autonomousGuest\?\.active/u);
  assert.match(source, /\{children\}[\s\S]*canOfferReturningDemo\(status\)[\s\S]*Try DEMO/u);
});

test("#1692 Phase 2 interactive DEMO reuses the core authority contract and STORY-owned prepared world", async () => {
  const source = await read("app/profile-access/demo-experience.tsx");

  assert.match(source, /@\/core\/demo-onboarding\/demo-boundary\.mjs/u);
  assert.match(source, /@\/modules\/story-the-unwritten\/demo\/world\.mjs/u);
  assert.match(source, /createDemoBoundary/u);
  assert.match(source, /applyStoryDemoDecision/u);
  assert.match(source, /resetStoryDemoWorld/u);
  assert.match(source, /data-demo-runtime="synthetic-demo-runtime"/u);
  assert.match(source, /data-demo-storage="demo-owned-disposable"/u);
  assert.doesNotMatch(source, /profile-private|PROJECT_LIBRARY|provider|connector|canon-admission|BUZZ_AUTH|github|google/iu);
});

test("#1692 Phase 2 DEMO provides explicit reset, exit and transition controls", async () => {
  const source = await read("app/profile-access/demo-experience.tsx");

  assert.match(source, /Reset DEMO/u);
  assert.match(source, /Exit DEMO/u);
  assert.match(source, /Enter PlotPickle/u);
  assert.match(source, /onEnterPlotPickle/u);
  assert.match(source, /onExit/u);
});
