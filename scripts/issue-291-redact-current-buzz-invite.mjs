import { readFileSync, writeFileSync } from "node:fs";

function update(path, transform) {
  const current = readFileSync(path, "utf8");
  const next = transform(current);
  if (next === current) throw new Error(`No expected change was made in ${path}`);
  writeFileSync(path, next);
}

const environmentInvite = 'process.env.NEXT_PUBLIC_PLOTPICKLE_BUZZ_INVITE_URL?.trim() || ""';
const liveInvitePattern = /https:\/\/[^"\n]*communities\.buzz\.xyz\/invite\/v2\.[A-Za-z0-9_-]{20,}/g;

update("app/setup-connections-dashboard.tsx", (source) => {
  let next = source.replace(
    /const BUZZ_INVITE_URL = "https:\/\/[^"\n]*communities\.buzz\.xyz\/invite\/v2\.[A-Za-z0-9_-]{20,}";/,
    `const BUZZ_INVITE_URL = ${environmentInvite};`,
  );
  next = next.replace(
    /links: \[\s*\{ label: "Join PlotPickleServer", href: BUZZ_INVITE_URL \},\s*\{ label: "Set up Buzz account or community", href: BUZZ_COMMUNITIES_URL \},\s*\],/,
    `links: [\n          ...(BUZZ_INVITE_URL ? [{ label: "Join PlotPickleServer", href: BUZZ_INVITE_URL }] : []),\n          { label: "Set up Buzz account or community", href: BUZZ_COMMUNITIES_URL },\n        ],`,
  );
  return next;
});

update("app/buzz-community-workspace.tsx", (source) => {
  let next = source.replace(
    /const PLOTPICKLE_SERVER_INVITE_URL = "https:\/\/[^"\n]*communities\.buzz\.xyz\/invite\/v2\.[A-Za-z0-9_-]{20,}";/,
    `const PLOTPICKLE_SERVER_INVITE_URL = ${environmentInvite};`,
  );
  next = next.replace(
    /<a href=\{PLOTPICKLE_SERVER_INVITE_URL\} target="_blank" rel="noreferrer">Join PlotPickleServer<\/a>/,
    `{PLOTPICKLE_SERVER_INVITE_URL\n            ? <a href={PLOTPICKLE_SERVER_INVITE_URL} target="_blank" rel="noreferrer">Join PlotPickleServer</a>\n            : <button type="button" disabled>Invite available from the community administrator</button>}`,
  );
  return next;
});

update("tests/issue-256-setup-connections-dashboard.test.mjs", (source) => {
  let next = source.replace(/^\s*"https:\/\/[^"\n]*communities\.buzz\.xyz\/invite\/v2\.[A-Za-z0-9_-]{20,}",\r?\n/m, "");
  next = next.replace(
    /  assert\.match\(setup, \/target="_blank" rel="noreferrer"\/\);/,
    `  assert.match(setup, /target="_blank" rel="noreferrer"/);\n  assert.match(setup, /NEXT_PUBLIC_PLOTPICKLE_BUZZ_INVITE_URL/);\n  assert.doesNotMatch(setup, /communities\\.buzz\\.xyz\\/invite\\/v2\\./);`,
  );
  return next;
});

update("scripts/public-readiness.mjs", (source) => source.replace(
  '  ["Slack token", /xox[baprs]-[A-Za-z0-9-]{20,}/],',
  '  ["Slack token", /xox[baprs]-[A-Za-z0-9-]{20,}/],\n  ["Buzz invitation token", /communities\\.buzz\\.xyz\\/invite\\/v2\\.[A-Za-z0-9_-]{20,}/],',
));

for (const path of [
  "app/setup-connections-dashboard.tsx",
  "app/buzz-community-workspace.tsx",
  "tests/issue-256-setup-connections-dashboard.test.mjs",
]) {
  const source = readFileSync(path, "utf8");
  if (liveInvitePattern.test(source)) throw new Error(`A live Buzz invitation remains in ${path}`);
  liveInvitePattern.lastIndex = 0;
}

console.log("Removed the live Buzz invitation from current source and replaced it with optional build configuration.");
