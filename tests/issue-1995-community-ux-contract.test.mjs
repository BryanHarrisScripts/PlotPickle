import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1995 Project Library is the story-selection authority", async () => {
  const [contract, library, workspace, privateRoom] = await Promise.all([
    read("lib/community/community-ux-contract.ts"),
    read("core/storage/project-library-browser.ts"),
    read("app/_components/community/community-workspace.tsx"),
    read("app/_components/community/community-private-story-room.tsx"),
  ]);

  assert.match(contract, /storySource: "project-library"/u);
  assert.match(contract, /storyCollectionLabel: "My Stories"/u);
  assert.match(library, /export function listLibraryProjects\(\)/u);
  assert.match(library, /listProfileProjectSummaries/u);
  assert.match(privateRoom, /listLibraryProjects\(\)\.filter\(\(story\) => !story\.archivedAt\)/u);
  assert.match(privateRoom, /PROJECT_LIBRARY_CHANGED_EVENT/u);
  assert.doesNotMatch(workspace, /loadFoundationProject/u);
});

test("#1995 Phase 1 shows materialized My Stories without changing the active writing project", async () => {
  const privateRoom = await read("app/_components/community/community-private-story-room.tsx");

  assert.match(privateRoom, /aria-label="My Stories for Private Story Room"/u);
  assert.match(privateRoom, /data-private-story-room-story=\{story\.id\}/u);
  assert.match(privateRoom, /<strong>\{story\.title\}<\/strong>/u);
  assert.match(privateRoom, /Selecting a story never changes which story is active in your writing workspace\./u);
  assert.doesNotMatch(privateRoom, /switchActiveLibraryProject/u);
  assert.doesNotMatch(privateRoom, /loadFoundationProject/u);
});

test("#1995 Phase 1 resolves existing immutable room identity per story before creating anything", async () => {
  const privateRoom = await read("app/_components/community/community-private-story-room.tsx");

  assert.match(privateRoom, /storyRoomIdentityBody\(story, false\)/u);
  assert.match(privateRoom, /projectId: story\.id/u);
  assert.match(privateRoom, /buzzLegacyStoryRoomName\(story, room\.id\)/u);
  assert.match(privateRoom, /buzzStoryRoomDisplayName\(story, room\.id\)/u);
  assert.match(privateRoom, /data-private-story-room-state=\{error \? "unavailable" : room \? "ready" : "not-created"\}/u);
  assert.match(privateRoom, /room\.roomId === PRIVATE_STORY_ROOM_ID/u);
});

test("#1995 Phase 1 separates pre-creation from room administration", async () => {
  const privateRoom = await read("app/_components/community/community-private-story-room.tsx");

  assert.match(privateRoom, /data-private-story-room-selected="not-created"/u);
  assert.match(privateRoom, /Create one private BUZZ space for this story\. Listing, member and request administration appear only after the room exists\./u);
  assert.match(privateRoom, /storyRoomIdentityBody\(selectedStory, true\)/u);
  assert.match(privateRoom, /data-private-story-room-selected="ready"/u);
  assert.match(privateRoom, /<CommunityStoryRoomAccess channel=\{selectedPrivateRoom\.channel\}/u);

  const notCreatedIndex = privateRoom.indexOf('data-private-story-room-selected="not-created"');
  const accessIndex = privateRoom.indexOf("<CommunityStoryRoomAccess");
  assert.ok(notCreatedIndex >= 0 && accessIndex >= 0, "Phase 1 creation and administration states must both exist.");
  assert.ok(!privateRoom.slice(notCreatedIndex).includes("CommunityStoryRoomAccess channel={selectedPrivateRoom.channel}"), "Pre-creation branch must not render room administration.");
});

test("#1995 preserves BUZZ public identity and member-only normal admission", async () => {
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
  assert.match(accessGateway, /"channels", "add-member", "--channel", channel\.id, "--pubkey", identity\.pubkey, "--role", "member"/u);
  assert.doesNotMatch(accessGateway, /VALID_ROLES|body\.role/u);
  assert.match(directoryGateway, /"channels", "add-member"/u);
  assert.match(directoryGateway, /"--role", "member"/u);
  assert.match(directoryGateway, /BUZZ did not confirm that Story Room access was/u);
});

test("#1995 Phase 2 resolves a BUZZ public identity before any direct Human membership write", async () => {
  const gateway = await read("build/buzz-story-room-access-gateway.ts");

  assert.match(gateway, /const RESOLVE_API = `\$\{API\}\/resolve`/u);
  assert.match(gateway, /"users", "get", "--pubkey", pubkey/u);
  assert.match(gateway, /That BUZZ ID could not be resolved to a public BUZZ profile\. No Story Room access was changed\./u);
  assert.match(gateway, /Agent\/Bot identity/u);

  const resolveIndex = gateway.indexOf("const identity = await resolveHuman(connection, body.pubkey)");
  const addIndex = gateway.indexOf('["channels", "add-member", "--channel", channel.id, "--pubkey", identity.pubkey, "--role", "member"]');
  assert.ok(resolveIndex >= 0 && addIndex > resolveIndex, "Direct membership must resolve the Human identity before BUZZ add-member executes.");
});

test("#1995 Phase 2 offers known-person and Add by BUZZ ID paths without a Great Hall prerequisite", async () => {
  const access = await read("app/_components/community/community-story-room-access.tsx");

  assert.match(access, /aria-label="Add known Community person"/u);
  assert.match(access, /Known Community person/u);
  assert.match(access, /Great Hall membership is not required for Story Room membership/u);
  assert.match(access, /aria-label="Add by public BUZZ ID"/u);
  assert.match(access, /BUZZ ID \(public\)/u);
  assert.match(access, /64-character hexadecimal public key/u);
  assert.match(access, /Do not paste an nsec, private key, password or auth token/u);
  assert.match(access, /\/story-room-access\/resolve\?pubkey=/u);
  assert.match(access, /data-story-room-resolved-human="true"/u);
  assert.match(access, />Add person<\/button>/u);
});

test("#1995 Phase 2 hides elevated roles and protects the owner in both UI and gateway", async () => {
  const [access, gateway] = await Promise.all([
    read("app/_components/community/community-story-room-access.tsx"),
    read("build/buzz-story-room-access-gateway.ts"),
  ]);

  assert.doesNotMatch(access, /Room role|>Guest<|>Admin<|>Bot</u);
  assert.match(access, /owner \? <strong className=\{styles\.ownerLabel\}>Owner<\/strong> : <button/u);
  assert.match(access, /if \(member\.isOwner \|\| member\.role === "owner"\) return/u);
  assert.match(gateway, /Only the verified BUZZ Story Room owner can change Human access/u);
  assert.match(gateway, /if \(pubkey === ownerPubkey\) throw new Error\("The Story Room owner cannot remove their own ownership access\."\)/u);
  assert.match(gateway, /role === "owner"/u);
});

test("#1995 Phase 2 reports successful add/remove only after BUZZ returns the resulting roster", async () => {
  const [access, gateway] = await Promise.all([
    read("app/_components/community/community-story-room-access.tsx"),
    read("build/buzz-story-room-access-gateway.ts"),
  ]);

  assert.match(gateway, /await runStoryRoomBuzz\(connection, \["channels", "add-member"[\s\S]*return status\(channel\.id\)/u);
  assert.match(gateway, /await runStoryRoomBuzz\(connection, \["channels", "remove-member"[\s\S]*return status\(channel\.id\)/u);
  assert.match(access, /Access granted as a normal member after BUZZ confirmed the resulting Story Room membership\./u);
  assert.match(access, /Story Room access removed after BUZZ confirmed the updated membership state\./u);
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
