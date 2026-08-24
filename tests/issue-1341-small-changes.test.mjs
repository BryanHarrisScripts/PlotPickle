import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1341 Community helper pills open the matching individual Settings Help screen", async () => {
  const [social, helpers] = await Promise.all([
    read("modules/community/community-buzz-social.tsx"),
    read("app/settings-helper-directory.tsx"),
  ]);

  assert.match(social, /settings=help&helper=\$\{encodeURIComponent\(agent\.id\)\}/);
  assert.match(social, /Open \$\{agent\.name\} help/);
  assert.match(helpers, /searchParams\.get\("helper"\)/);
  assert.match(helpers, /data-settings-help="individual-helper"/);
  assert.match(helpers, /data-selected-helper=\{selectedAgent\.profileId\}/);
  assert.match(helpers, /← All helpers/);
});
