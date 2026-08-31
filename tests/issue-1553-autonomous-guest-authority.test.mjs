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

test("#1553 autonomous Guest browser checkpoint is isolated and survives its own full navigation", async () => {
  const source = await read("core/auth/autonomous-guest/guest-workspace-browser.ts");
  assert.match(source, /plotpickle\.autonomous-guest\.workspace\.v1/);
  assert.match(source, /plotpickle\.library\.profile\.v1/);
  assert.match(source, /guest-auto-\[a-f0-9\]\{24\}/i);
  assert.match(source, /window\.localStorage\.setItem/);
  assert.match(source, /removeGuestSessionKeys/);
  assert.match(source, /window\.sessionStorage\.getItem\(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY\) === normalized\) return/);
  assert.doesNotMatch(source, /sessionStorage\.clear/);
  assert.doesNotMatch(source, /profile-private|csrf|credential|password|buzz|indexedDB|database/i);
});

test("#1553 Guest drops Human vault authority without erasing the Guest story session", async () => {
  const [boundary, privateBrowser] = await Promise.all([
    read("app/profile-access/profile-access-boundary.tsx"),
    read("core/storage/profile-private-browser.ts"),
  ]);
  assert.match(boundary, /releaseProfilePrivateBrowserAuthority\(\);\s*hydrateAutonomousGuestBrowser/);
  assert.match(privateBrowser, /export function releaseProfilePrivateBrowserAuthority\(\)/);
  assert.match(privateBrowser, /export function clearProfilePrivateBrowser\(\) \{\s*releaseProfilePrivateBrowserAuthority\(\);\s*window\.sessionStorage\.clear\(\);/);
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
  assert.match(boundary, /@\/core\/auth\/autonomous-guest\/guest-workspace-browser/);
  assert.match(boundary, /hydrateAutonomousGuestBrowser/);
  assert.match(boundary, /persistAutonomousGuestLibrary/);
  assert.match(profileRoute, /getAutonomousGuestAuthority/);
  assert.match(profileRoute, /autonomousGuest/);
});

test("#1553 Guest Story Decisions use isolated non-canon storage instead of Human private storage", async () => {
  const [requestScope, gateway, store] = await Promise.all([
    read("build/auth/profile-request-context.ts"),
    read("build/story-decisions/gateway.ts"),
    read("build/story-decisions/autonomous-guest-store.ts"),
  ]);
  assert.match(requestScope, /autonomousGuestRequestScope/);
  assert.match(requestScope, /AUTONOMOUS_GUEST_SCOPED_API_PREFIXES = \["\/api\/story-decisions"\]/);
  assert.match(requestScope, /getAutonomousGuestAuthority\(origin, runtime\.accessMode\)/);
  assert.match(gateway, /currentAutonomousGuestRequestContext/);
  assert.match(gateway, /autonomousGuestStorageScope/);
  assert.match(gateway, /Autonomous Guest cannot use the Human Story Decision response route/);
  assert.match(gateway, /Autonomous Guest lifecycle changes must use the delegated Story Decision operator/);
  assert.match(store, /"autonomous-guest", authority\.workspaceId/);
  assert.match(store, /humanProfileId !== ""/);
  assert.doesNotMatch(store, /readCredentialJson|writeCredentialJson|privateStorage|profileCredentialsDirectory|authenticated-human/i);
});

test("#1553 Guest AI routing status is credential-free and precedes the normal provider router", async () => {
  const [statusGateway, localGateway] = await Promise.all([
    read("build/auth/autonomous-guest-ai-routing-status.ts"),
    read("build/local-ai-gateway.ts"),
  ]);
  assert.match(statusGateway, /humanCredentialsInherited: false/);
  assert.match(statusGateway, /silentPaidFallback: false/);
  assert.match(statusGateway, /text: "off", image: "manual", video: "off"/);
  assert.match(statusGateway, /getAutonomousGuestAuthority/);
  assert.doesNotMatch(statusGateway, /readCredentialJson|writeCredentialJson|apiKey|readMediaRoutingStore|readSynchronizedAssistantStore/);
  assert.match(localGateway, /registerAutonomousGuestRoutingStatus\(server\); registerAiRoutingGateway\(server\)/);
});

test("#1553 Guest acceptance Node identity does not require encrypted Studio credentials", async () => {
  const source = await read("build/node-topology-gateway.ts");
  assert.match(source, /autonomousAcceptanceNodeIdentity/);
  assert.match(source, /PLOTPICKLE_ACCEPTANCE_MODE !== "1"/);
  assert.match(source, /nodeId: authority\.workspaceId/);
  assert.match(source, /const autonomous = autonomousAcceptanceNodeIdentity\(origin\);\s*if \(autonomous\) return autonomous/);
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
