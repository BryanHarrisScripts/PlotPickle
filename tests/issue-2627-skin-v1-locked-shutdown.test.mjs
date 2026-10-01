import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2627 normal Skin V1 startup owns a locked shutdown action instead of relying on legacy ProfileAccessBoundary", async () => {
  const [router, skin] = await Promise.all([
    read("app/profile-access/profile-access-router.tsx"),
    read("app/skin-v1/skin-v1-client.tsx"),
  ]);

  assert.match(router, /if \(publicWebRoot \|\| isSkinV1Path\(pathname\) \|\| isPublicWebPath\(pathname\)\) return <>\{children\}<\/>/u);
  assert.match(skin, /function SkinV1LockedNodeShutdown\(\)/u);
  assert.match(skin, /data-skin-v1-locked-shutdown="true"/u);
  assert.match(skin, />SHUT DOWN PLOTPICKLE<\/button>/u);
  assert.match(skin, /!recovery \? <SkinV1LockedNodeShutdown \/> : null/u);
});

test("#2627 Skin V1 locked shutdown rechecks Human auth before canonical Node control", async () => {
  const skin = await read("app/skin-v1/skin-v1-client.tsx");
  const start = skin.indexOf("function SkinV1LockedNodeShutdown()");
  const end = skin.indexOf("function webMcpProfileGateCaptureRequested", start);
  const shutdown = skin.slice(start, end);

  const profileCheck = shutdown.indexOf('fetch("/api/auth/profile"');
  const begin = shutdown.indexOf('lockedSkinNodeAction("begin-shutdown")');
  const complete = shutdown.indexOf('lockedSkinNodeAction("complete-shutdown"');
  assert.ok(profileCheck >= 0 && profileCheck < begin);
  assert.ok(begin < complete);
  assert.match(skin, /"X-PlotPickle-Node-Control": "confirmed"/u);
  assert.match(shutdown, /data-skin-v1-locked-shutdown-confirmation="true"/u);
  assert.match(shutdown, />CANCEL<\/button>/u);
  assert.match(shutdown, /Use the Dashboard Shut Down action so current work can be saved first/u);
});

test("#2627 live LOGON layout scrolls safely instead of clipping controls at desktop-height constraints", async () => {
  const css = await read("app/skin-v1.css");
  assert.match(css, /\.pp-skin-v1-logon \{[\s\S]*min-height: 100dvh/u);
  assert.match(css, /\.pp-skin-v1-logon \{[\s\S]*align-items: start/u);
  assert.match(css, /\.pp-skin-v1-logon \{[\s\S]*overflow-y: auto/u);
  assert.match(css, /\.pp-skin-v1-logon > \.pp-skin-v1-panel \{[\s\S]*margin-block: auto/u);
  assert.match(css, /\.pp-skin-v1-logon-shutdown \{/u);
  assert.match(css, /\.pp-skin-v1-logon-shutdown-confirm \{/u);
});

test("#2627 WebMCP proves shutdown visibility and clickability at 1366x768 before login", async () => {
  const capture = await read("lib/verification/skin-v1/profile-gate-capture.mjs");
  assert.match(capture, /viewport: \{ width: 1366, height: 768 \}/u);
  assert.match(capture, /async function assertLockedShutdownVisible\(page, label\)/u);
  assert.match(capture, /\[data-skin-v1-locked-shutdown='true'\] > button/u);
  assert.match(capture, /geometry\.bottom > geometry\.viewportHeight/u);
  assert.match(capture, /await button\.click\(\)/u);
  assert.match(capture, /\[data-skin-v1-locked-shutdown-confirmation='true'\]/u);
  assert.match(capture, /getByRole\("button", \{ name: "CANCEL" \}\)\.click\(\)/u);
});

test("#2627 WebMCP logs out a real authenticated Skin V1 session, proves shutdown, then re-authenticates for the remaining UAT", async () => {
  const capture = await read("lib/verification/skin-v1/profile-gate-capture.mjs");
  const start = capture.indexOf("export async function verifyWebMcpPostLogoutShutdown");
  const end = capture.indexOf("export async function prepareWebMcpProfileGateSession", start);
  const postLogout = capture.slice(start, end);

  assert.match(postLogout, /storageState: storageStatePath/u);
  assert.match(postLogout, /\[data-dashboard-menu-item='logout'\]/u);
  assert.match(postLogout, /await logout\.click\(\)/u);
  assert.match(postLogout, /main\.pp-skin-v1-logon\[data-skin-v1-logon-state='locked'\]/u);
  assert.match(postLogout, /assertLockedShutdownVisible\(page, "post-logout profile gate"\)/u);

  const prepareStart = capture.indexOf("export async function prepareWebMcpProfileGateSession");
  const prepare = capture.slice(prepareStart);
  const firstAuth = prepare.indexOf("const logoutProofAuth = await authenticateVerificationSyntheticProfile");
  const logoutProof = prepare.indexOf("const postLogout = await verifyWebMcpPostLogoutShutdown", firstAuth);
  const secondAuth = prepare.indexOf("const auth = await authenticateVerificationSyntheticProfile", logoutProof);
  const report = prepare.indexOf("await writeProfileGateCaptureReport({ initializing, locked, postLogout })", secondAuth);
  assert.ok(firstAuth >= 0 && firstAuth < logoutProof);
  assert.ok(logoutProof < secondAuth);
  assert.ok(secondAuth < report);
  assert.match(prepare, /storageStatePath: logoutProofAuth\.storageStatePath/u);
  assert.match(prepare, /return auth/u);
});
