import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const gateway = await readFile(new URL("../build/story-workflow-buzz-bridge-gateway.ts", import.meta.url), "utf8");

test("#1422 Story Bridge preflight requires the verified Human signer and lets real BUZZ operations determine transport health", () => {
  const statusReady = gateway.match(/function statusReady\(status: BuzzStatus\) \{([\s\S]*?)\n\}/)?.[1] || "";

  assert.match(statusReady, /status\.connection\?\.configured/);
  assert.match(statusReady, /status\.connection\?\.identityConfigured/);
  assert.match(statusReady, /status\.connection\?\.identityVerified/);
  assert.doesNotMatch(statusReady, /status\.cli|status\.relay/,
    "Story Bridge must not block a verified Human signer on generic CLI/HTTP health heuristics before the real BUZZ operation runs.");

  assert.match(gateway, /The connected Human BUZZ transport identity is not verified\./);
  assert.doesNotMatch(gateway, /BUZZ is unavailable or the connected Human transport identity is not verified/);

  for (const realOperation of [
    "/api/local-buzz/rooms?projectPrefix=",
    "/api/local-buzz/rooms/ensure",
    "ensurePrivateBuzzAgentMembership",
    "/api/local-buzz/messages",
  ]) assert.ok(gateway.includes(realOperation), `Story Bridge must still use the real BUZZ operation: ${realOperation}`);
});
