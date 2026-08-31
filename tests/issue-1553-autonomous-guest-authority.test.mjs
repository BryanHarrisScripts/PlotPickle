import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1553 autonomous Guest authority is explicit, loopback-only and never Human authority", async () => {
  const source = await read("core/auth/autonomous-guest/guest-authority.ts");
  assert.match(source, /delegated-guest-autonomous-operator/);
  assert.match(source, /PLOTPICKLE_AUTONOMOUS_GUEST_ENABLED/);
  assert.match(source, /desktop-loopback/);
  assert.match(source, /LOOPBACK_HOSTS/);
  assert.match(source, /humanProfileId: ""/);
  assert.doesNotMatch(source, /createFirstProfile|createProfile\(|authenticate\(|password|recoverySecret|BUZZ/i);
});

test("#1553 autonomous Guest browser checkpoint is isolated to its own Library namespace", async () => {
  const source = await read("core/storage/autonomous-guest-browser.ts");
  assert.match(source, /plotpickle\.autonomous-guest\.workspace\.v1/);
  assert.match(source, /plotpickle\.library\.profile\.v1/);
  assert.match(source, /guest-auto-\[a-f0-9\]\{24\}/i);
  assert.match(source, /window\.localStorage\.setItem/);
  assert.match(source, /window\.sessionStorage\.clear/);
  assert.doesNotMatch(source, /profile-private|csrf|credential|password|buzz|indexedDB|database/i);
});

test("#1553 profile boundary visibly distinguishes autonomous Guest from Human", async () => {
  const [boundary, profileRoute] = await Promise.all([
    read("app/profile-access/profile-access-boundary.tsx"),
    read("app/api/auth/profile/route.ts"),
  ]);
  assert.match(boundary, /screen === "autonomous-guest"/);
  assert.match(boundary, />Guest Autonomous</);
  assert.match(boundary, /Isolated from Human profiles, credentials and BUZZ identity/);
  assert.match(boundary, /data-autonomous-guest-authority/);
  assert.match(boundary, /hydrateAutonomousGuestBrowser/);
  assert.match(boundary, /persistAutonomousGuestLibrary/);
  assert.match(profileRoute, /getAutonomousGuestAuthority/);
  assert.match(profileRoute, /autonomousGuest/);
});

test("#1553 reference process explicitly enables Guest authority without a Human profile", async () => {
  const source = await read("scripts/creative-uat/autonomous/run-autonomous-story-reference.mjs");
  assert.match(source, /PLOTPICKLE_AUTONOMOUS_GUEST_ENABLED: "true"/);
  assert.match(source, /PLOTPICKLE_AUTONOMOUS_RUN_ID/);
  assert.match(source, /PLOTPICKLE_AUTONOMOUS_OPERATOR_ID/);
  assert.match(source, /authorityClass: "delegated-guest-autonomous-operator"/);
  assert.match(source, /humanProfileId: ""/);
  assert.doesNotMatch(source, /create-first-profile|recoverySecret|password/);
});
