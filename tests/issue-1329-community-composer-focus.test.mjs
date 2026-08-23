import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1329 focuses the writable Community composer when the active room changes", async () => {
  const social = await read("modules/community/community-buzz-social.tsx");

  assert.match(social, /const composerRef = useRef<HTMLTextAreaElement \| null>\(null\)/u);
  assert.match(social, /if \(!channelId \|\| !canPost\) return;/u);
  assert.match(social, /requestAnimationFrame\(\(\) => composerRef\.current\?\.focus\(\{ preventScroll: true \}\)\)/u);
  assert.match(social, /\}, \[channelId, canPost\]\);/u);
  assert.match(social, /<textarea ref=\{composerRef\} id="community-buzz-composer"/u);
});

test("#1329 does not bind focus to polling or change the terminal posting keys", async () => {
  const social = await read("modules/community/community-buzz-social.tsx");

  assert.match(social, /window\.setInterval\(\(\) => \{ void refresh\(true\); \}, 5000\)/u);
  assert.doesNotMatch(social, /\[channelId, canPost, (?:messages|refresh)/u);
  assert.match(social, /event\.key === "Enter" && !event\.shiftKey/u);
  assert.match(social, /Enter to post · Shift\+Enter for a new line/u);
});