import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1995 Phase 4 keeps My Presence inside governed Connected Studios", async () => {
  const [studios, presence] = await Promise.all([
    read("app/connected-studios-panel.tsx"),
    read("app/_components/community/community-my-presence.tsx"),
  ]);

  assert.match(studios, /CommunityMyPresence/u);
  assert.match(studios, /const \[showPresence, setShowPresence\] = useState\(false\)/u);
  assert.match(studios, /if \(showPresence\) return <CommunityMyPresence onBack=\{\(\) => setShowPresence\(false\)\} \/>/u);
  assert.match(studios, />My Presence<\/button>/u);
  assert.match(studios, />Check my Community presence<\/button>/u);
  assert.match(studios, />Review my visibility<\/button>/u);
  assert.match(presence, /data-community-presence-governed="true"/u);
  assert.match(presence, />Back to Connected Studios<\/button>/u);
});

test("#1995 Phase 4 removes normal navigation to the legacy Community Presence page", async () => {
  const [studios, workspace, legacyPresence] = await Promise.all([
    read("app/connected-studios-panel.tsx"),
    read("app/_components/community/community-workspace.tsx"),
    read("app/community-presence/page.tsx"),
  ]);

  assert.doesNotMatch(studios, /href="\/community-presence"/u);
  assert.doesNotMatch(workspace, /\/community-presence/u);
  assert.match(legacyPresence, /export default function CommunityPresencePage/u);
});

test("#1995 Phase 4 exposes the governed availability and visibility controls", async () => {
  const presence = await read("app/_components/community/community-my-presence.tsx");

  assert.match(presence, /type Availability = "online" \| "away" \| "busy" \| "offline"/u);
  assert.match(presence, /type Visibility = "public" \| "contacts" \| "invisible"/u);
  assert.match(presence, /<option value="online">Online<\/option>/u);
  assert.match(presence, /<option value="away">Away<\/option>/u);
  assert.match(presence, /<option value="busy">Busy<\/option>/u);
  assert.match(presence, /<option value="offline">Offline<\/option>/u);
  assert.match(presence, /<option value="public">Public<\/option>/u);
  assert.match(presence, /<option value="contacts">Contacts<\/option>/u);
  assert.match(presence, /<option value="invisible">Invisible<\/option>/u);
  assert.match(presence, /Announce \/ update presence/u);
  assert.match(presence, /Withdraw presence/u);
  assert.match(presence, /const API = "\/api\/community-federation"/u);
});

test("#1995 Phase 4 keeps Connected Studios focused on other Studios and useful actions", async () => {
  const studios = await read("app/connected-studios-panel.tsx");

  assert.match(studios, /Find the PlotPickle Studios you are permitted to see\./u);
  assert.match(studios, /"Open Studio"/u);
  assert.match(studios, />Visit Great Hall<\/button>/u);
  assert.match(studios, /Add to Contacts/u);
  assert.match(studios, />Block<\/button>/u);
  assert.match(studios, />Report<\/button>/u);
  assert.match(studios, /No permitted Studios are visible right now\./u);
  assert.match(studios, /This is a community directory, not a server list\./u);
});
