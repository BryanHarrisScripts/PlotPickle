import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1995 Phase 5 keeps Connected Studios and My Presence inside a governed keyboard back stack", async () => {
  const [studios, presence] = await Promise.all([
    read("app/connected-studios-panel.tsx"),
    read("app/_components/community/community-my-presence.tsx"),
  ]);

  assert.match(studios, /data-community-view="connected-studios"/u);
  assert.match(studios, /data-community-action="my-presence"/u);
  assert.match(studios, /if \(!selected \|\| showPresence\) return/u);
  assert.match(studios, /window\.addEventListener\("keydown", handleEscape\)/u);
  assert.match(studios, /if \(event\.key !== "Escape"\) return/u);
  assert.match(studios, /setSelected\(""\)/u);
  assert.doesNotMatch(studios, /href="\/community-presence"/u);

  assert.match(presence, /data-community-presence-governed="true"/u);
  assert.match(presence, /data-community-view="my-presence"/u);
  assert.match(presence, /if \(busy\) return/u);
  assert.match(presence, /window\.addEventListener\("keydown", handleEscape\)/u);
  assert.match(presence, /if \(event\.key !== "Escape"\) return/u);
  assert.match(presence, /onBack\(\)/u);
});

test("#1995 Phase 5 keeps Story Room selection and administration on native keyboard controls", async () => {
  const [privateRoom, access, listing, requests] = await Promise.all([
    read("app/_components/community/community-private-story-room.tsx"),
    read("app/_components/community/community-story-room-access.tsx"),
    read("app/_components/community/community-story-room-listing.tsx"),
    read("modules/community/story-room-directory.tsx"),
  ]);

  assert.match(privateRoom, /data-private-story-room-story=\{story\.id\}/u);
  assert.match(privateRoom, /<button[\s\S]*data-private-story-room-story/u);
  assert.match(access, /aria-label="Add known Community person"[\s\S]*<select/u);
  assert.match(access, /aria-label="Add by public BUZZ ID"[\s\S]*<input/u);
  assert.match(access, /Review BUZZ ID/u);
  assert.match(listing, /<select/u);
  assert.match(requests, /Approve/u);
  assert.match(requests, /Decline/u);
});

test("#1995 Phase 5 keeps corrected Community controls on canonical square Skin V1 geometry", async () => {
  const styles = await Promise.all([
    read("app/connected-studios-panel.module.css"),
    read("app/_components/community/community-my-presence.module.css"),
    read("app/_components/community/community-story-room-access.module.css"),
    read("app/_components/community/community-story-room-listing.module.css"),
  ]);

  for (const css of styles) {
    assert.match(css, /--pp-skin-radius/u);
    assert.match(css, /--pp-skin-control-height/u);
    assert.doesNotMatch(css, /border-radius:\s*(?:8|9|10|12|14|16)px/u);
  }
});

test("#1995 Phase 5 keeps WebMCP visual conformance capable of inventorying visible Community subview controls", async () => {
  const audit = await read("lib/verification/webmcp-surface-visual-audit.mjs");

  assert.match(audit, /community: Object\.freeze\([\s\S]*surface: "COMMUNITY"/u);
  assert.match(audit, /section\[aria-label='PlotPickle Community'\]/u);
  assert.match(audit, /"button"[\s\S]*"input:not\(\[type='hidden'\]\)"[\s\S]*"select"/u);
  assert.match(audit, /UI-CONFORMANCE/u);
});
