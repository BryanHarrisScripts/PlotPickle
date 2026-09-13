import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1995 Phase 3 presents closed storage semantics as Private / Hidden", async () => {
  const listing = await read("app/_components/community/community-story-room-listing.tsx");

  assert.match(listing, /data-story-room-visibility="phase-3"/u);
  assert.match(listing, /<option value="closed">Private \/ Hidden<\/option>/u);
  assert.match(listing, /<option value="listed">Listed \/ Request Access<\/option>/u);
  assert.match(listing, /Private \/ Hidden is the default/u);
  assert.match(listing, /Changing visibility never removes existing room members/u);
  assert.match(listing, /Save Private \/ Hidden/u);
  assert.match(listing, /Save Listed \/ Request Access/u);
  assert.match(listing, /Existing members keep access until the owner removes them/u);
  assert.doesNotMatch(listing, /Closed · hidden|Closed is the default/u);
});

test("#1995 Phase 3 preserves closed/listed backend authority and signed directory withdrawal", async () => {
  const listing = await read("app/_components/community/community-story-room-listing.tsx");

  assert.match(listing, /useState<BuzzStoryRoomAccessMode>\("closed"\)/u);
  assert.match(listing, /if \(listing\.accessMode === "closed"\)[\s\S]*type: "closed"/u);
  assert.match(listing, /accessMode: "listed"/u);
  assert.match(listing, /authenticatedProfileFetch\("\/api\/local-buzz\/story-room-directory"/u);
  assert.match(listing, /action: "publish", announcement/u);
});

test("#1995 Phase 3 keeps Open visibly capability-gated instead of simulating admission", async () => {
  const [listing, directoryGateway] = await Promise.all([
    read("app/_components/community/community-story-room-listing.tsx"),
    read("build/buzz-story-room-directory-gateway.ts"),
  ]);

  assert.match(listing, /const openAvailable = payload\?\.capabilities\.openMembership === true/u);
  assert.match(listing, /<option value="open" disabled=\{!openAvailable\}>/u);
  assert.match(listing, /Open remains capability-gated/u);
  assert.match(listing, /will not simulate automatic admission/u);
  assert.match(directoryGateway, /Open Story Room admission remains capability-gated\. Publish as Listed instead\./u);
});

test("#1995 Phase 3 keeps pending and approved requests actionable while collapsing history", async () => {
  const directory = await read("modules/community/story-room-directory.tsx");

  assert.match(directory, /const pendingRequests = requests\.filter\(\(item\) => item\.status === "pending"\)/u);
  assert.match(directory, /const approvedRequests = requests\.filter\(\(item\) => item\.status === "approved"\)/u);
  assert.match(directory, /const actionableRequests = \[\.\.\.pendingRequests, \.\.\.approvedRequests\]/u);
  assert.match(directory, /const pastRequests = requests\.filter/u);
  assert.match(directory, /void decide\(item, "approved"\)/u);
  assert.match(directory, /void decide\(item, "declined"\)/u);
  assert.match(directory, /void decide\(item, "revoked"\)/u);
  assert.match(directory, /<details className=\{styles\.requestHistory\}><summary>Past requests/u);
});

test("#1995 Phase 3 makes zero actionable requests a compact owner state", async () => {
  const [directory, styles] = await Promise.all([
    read("modules/community/story-room-directory.tsx"),
    read("modules/community/story-room-directory.module.css"),
  ]);

  assert.match(directory, /if \(payload && actionableRequests\.length === 0\)/u);
  assert.match(directory, /data-story-room-request-state="empty"/u);
  assert.match(directory, /<strong>No pending requests<\/strong>/u);
  assert.match(directory, /Nothing needs an owner decision right now\./u);
  assert.match(styles, /\.compactRequests/u);
  assert.match(styles, /\.compactRequestRow/u);
});

test("#1995 Phase 3 preserves BUZZ-confirmed approval and revocation authority", async () => {
  const [directory, gateway, governance] = await Promise.all([
    read("modules/community/story-room-directory.tsx"),
    read("build/buzz-story-room-directory-gateway.ts"),
    read("tests/issue-1444-story-room-directory.test.mjs"),
  ]);

  assert.match(directory, /Approval grants only normal BUZZ membership after BUZZ confirms it/u);
  assert.match(gateway, /"--role", "member"/u);
  assert.match(gateway, /BUZZ did not confirm that Story Room access was/u);
  assert.match(governance, /approval is successful only after BUZZ confirms normal membership/u);
});
