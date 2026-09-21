import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2331 mounts one persistent DSDD conversation inside the authenticated PlotPickle shell", async () => {
  const [layout, panel] = await Promise.all([
    read("app/layout.tsx"),
    read("app/skin-v1/global-dsdd-conversation.tsx"),
  ]);

  assert.match(layout, /import GlobalDsddConversation from "\.\/skin-v1\/global-dsdd-conversation"/u);
  assert.equal((layout.match(/<GlobalDsddConversation \/>/gu) ?? []).length, 1);
  assert.match(
    layout,
    /<ProfileAccessRouter[\s\S]*<GlobalSageOverlay \/>[\s\S]*<GlobalDsddConversation \/>[\s\S]*<\/ProfileAccessRouter>/u,
  );
  assert.match(panel, /data-dsdd-conversational-uat="true"/u);
  assert.match(panel, /Conversational UAT/u);
});

test("#2331 keeps DSDD local/private and hidden from LOGON/public surfaces", async () => {
  const panel = await read("app/skin-v1/global-dsdd-conversation.tsx");

  assert.match(panel, /function loopbackHost\(\)/u);
  assert.match(panel, /isPublicWebPath\(pathname\)/u);
  assert.match(panel, /data-experience-surface="LOGON"/u);
  assert.match(panel, /setEligible\(!logonVisible && next\.surfaceId !== "LOGON"\)/u);
  assert.match(panel, /if \(!eligible\) return null/u);
});

test("#2331 grounds each narration in current route and governed surface context", async () => {
  const panel = await read("app/skin-v1/global-dsdd-conversation.tsx");

  assert.match(panel, /data-skin-v1-orchestrator-active="true"/u);
  assert.match(panel, /data-skin-v1-surface-id/u);
  assert.match(panel, /data-experience-surface/u);
  assert.match(panel, /route: pathname/u);
  assert.match(panel, /surfaceId:/u);
  assert.match(panel, /surfaceLabel/u);
  assert.match(panel, /context: snapshot/u);
  assert.match(panel, /CURRENT PLOTPICKLE CONTEXT/u);
});

test("#2331 reuses the existing text and voice boundaries without granting code mutation authority", async () => {
  const panel = await read("app/skin-v1/global-dsdd-conversation.tsx");

  assert.match(panel, /fetch\("\/api\/local-ai\/generate\/text"/u);
  assert.match(panel, /data-purpose="natural-language developer uat narration"/u);
  assert.match(panel, /Microphone is ready from this DSDD field/u);
  assert.match(panel, /Do not claim that code was changed, fixed, tested, committed, or merged/u);
  assert.match(panel, /This first slice records and interprets intent; it does not edit code/u);\n  assert.match(panel, /"x-plotpickle-dsdd-scope": "intent"/u);
  assert.doesNotMatch(panel, /\/api\/github/u);
  assert.doesNotMatch(panel, /merge_pull_request|create_pull_request|update_file/u);
});

test("#2331 preserves the live conversation across navigation in the persistent authenticated shell", async () => {
  const [layout, panel] = await Promise.all([
    read("app/layout.tsx"),
    read("app/skin-v1/global-dsdd-conversation.tsx"),
  ]);

  assert.match(layout, /<GlobalDsddConversation \/>/u);
  assert.match(panel, /const \[messages, setMessages\] = useState<DsddMessage\[\]>\(\[\]\)/u);
  assert.match(panel, /MutationObserver/u);
  assert.match(panel, /usePathname/u);
  assert.doesNotMatch(panel, /sessionStorage|localStorage/u);
});
