import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1995 Phase 0 makes the profile Project Library the story-selection authority", async () => {
  const [contract, library, workspace] = await Promise.all([
    read("lib/community/community-ux-contract.ts"),
    read("core/storage/project-library-browser.ts"),
    read("app/_components/community/community-workspace.tsx"),
  ]);

  assert.match(contract, /storySource: "project-library"/u);
  assert.match(contract, /storyCollectionLabel: "My Stories"/u);
  assert.match(library, /export function listLibraryProjects\(\)/u);
  assert.match(library, /listProfileProjectSummaries/u);

  // Characterize the regression that Phase 1 must replace without changing it in Phase 0.
  assert.match(workspace, /loadFoundationProject\(\)/u);
});

test("#1995 Phase 0 preserves BUZZ public identity and member-only normal admission", async () => {
  const [contract, accessGateway, directoryGateway] = await Promise.all([
    read("lib/community/community-ux-contract.ts"),
    read("build/buzz-story-room-access-gateway.ts"),
    read("build/buzz-story-room-directory-gateway.ts"),
  ]);

  assert.match(contract, /directInviteIdentityAuthority: "buzz-public-key"/u);
  assert.match(contract, /directInvitePublicLabel: "BUZZ ID \(public\)"/u);
  assert.match(contract, /directInviteAcceptsSecretCredentials: false/u);
  assert.match(contract, /normalHumanRole: "member"/u);
  assert.match(contract, /knownPersonSourceRequiresGreatHallMembership: false/u);

  assert.match(accessGateway, /\^\[a-f0-9\]\{64\}\$/u);
  assert.match(accessGateway, /const role = text\(body\.role\)\.toLowerCase\(\) \|\| "member"/u);
  assert.match(directoryGateway, /"channels", "add-member"/u);
  assert.match(directoryGateway, /"--role", "member"/u);
  assert.match(directoryGateway, /BUZZ did not confirm that Story Room access was/u);
});

test("#1995 Phase 0 separates room creation from room administration in the canonical UX contract", async () => {
  const contract = await read("lib/community/community-ux-contract.ts");

  assert.match(contract, /preCreationSections: \["story", "create"\]/u);
  assert.match(contract, /managementSections: \["room", "visibility", "people-with-access", "pending-requests"\]/u);
  assert.match(contract, /privateVisibilityLabel: "Private \/ Hidden"/u);
  assert.match(contract, /listedVisibilityLabel: "Listed \/ Request Access"/u);
  assert.match(contract, /openAdmissionReady: false/u);
  assert.match(contract, /ownerRemovableThroughNormalUi: false/u);
});

test("#1995 Phase 0 makes governed Community the canonical presence surface", async () => {
  const [contract, legacyPresence] = await Promise.all([
    read("lib/community/community-ux-contract.ts"),
    read("app/community-presence/page.tsx"),
  ]);

  assert.match(contract, /canonicalSurface: "governed-community"/u);
  assert.match(contract, /legacyStandaloneRoute: "\/community-presence"/u);
  assert.match(contract, /exposeLegacyStandaloneRouteInNormalNavigation: false/u);
  assert.match(contract, /availability: \["online", "away", "busy", "offline"\]/u);
  assert.match(contract, /visibility: \["public", "contacts", "invisible"\]/u);

  // The standalone route remains compatibility infrastructure until Phase 4 removes it from normal navigation.
  assert.match(legacyPresence, /export default function CommunityPresencePage/u);
});

test("#1995 Phase 0 keeps existing #1283 and #1444 governance contracts present", async () => {
  const [communityRegression, directoryRegression] = await Promise.all([
    read("tests/issue-1283-community-real-machine-cleanup.test.mjs"),
    read("tests/issue-1444-story-room-directory.test.mjs"),
  ]);

  assert.match(communityRegression, /one Private Story Room replaces the six-Hall presentation/u);
  assert.match(communityRegression, /Connected Studios does not vertically stretch a sparse empty state/u);
  assert.match(directoryRegression, /approval is successful only after BUZZ confirms normal membership/u);
  assert.match(directoryRegression, /Open capability-gated/u);
});
