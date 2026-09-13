import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1995 Phase 5 keeps Community navigation governed", async () => {
  const workspace = await read("app/_components/community/community-workspace.tsx");
  assert.match(workspace, /data-community-nav="private-story-room"/u);
  assert.match(workspace, /data-community-nav="connected-studios"/u);
});
