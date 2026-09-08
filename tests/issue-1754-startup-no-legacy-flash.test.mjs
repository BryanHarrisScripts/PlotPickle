import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const proxy = read("proxy.ts");
const profileAccessRouter = read("app/profile-access/profile-access-router.tsx");

test("#1754 default startup reaches Skin V1 before Legacy Skin can render", () => {
  assert.match(proxy, /searchParams\.get\("skin"\) === "legacy"/);
  assert.match(proxy, /destination\.pathname = "\/skin-v1"/);
  assert.match(proxy, /return NextResponse\.redirect\(destination\)/);
});

test("#1754 explicit legacy startup remains an intentional compatibility path", () => {
  assert.match(proxy, /if \(searchParams\.get\("skin"\) === "legacy"\) return NextResponse\.next\(\)/);
});

test("#1754 Skin V1 owns LOGON without the Legacy profile boundary", () => {
  assert.match(profileAccessRouter, /isSkinV1Path\(pathname\)/);
  assert.match(profileAccessRouter, /if \(isSkinV1Path\(pathname\)\) return <>\{children\}<\/>/);
});
