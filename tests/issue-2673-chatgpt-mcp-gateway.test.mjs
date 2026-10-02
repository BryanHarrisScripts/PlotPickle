import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CHATGPT_GATEWAY_AUTHORITY,
  CHATGPT_GATEWAY_EXTENSION_PLAN,
  CHATGPT_GATEWAY_RESOURCE_TYPES,
  assertNoPrivilegedGatewayCapability,
  chatGptGatewayResponse,
  governedResourceUri,
  minimalChatGptGatewayPrototype,
  normalizeChatGptGatewayRequest,
} from "../core/sidecars/chatgpt-mcp-gateway-contract.mjs";

test("#2673 minimal gateway is read-only and PPF remains authoritative", () => {
  const prototype = minimalChatGptGatewayPrototype();
  assert.equal(prototype.defaultWriteAccess, false);
  assert.ok(prototype.tools.every((tool) => tool.readOnly === true));
  assert.equal(CHATGPT_GATEWAY_AUTHORITY.storyAuthority, "plotpickle-ppf");
  assert.equal(CHATGPT_GATEWAY_AUTHORITY.canonMutation, false);
  assert.equal(CHATGPT_GATEWAY_AUTHORITY.mergeAuthority, false);
  assert.equal(CHATGPT_GATEWAY_AUTHORITY.dsddAuthority, false);
});

test("#2673 request contract rejects arbitrary mutation/control capabilities", () => {
  const request = normalizeChatGptGatewayRequest({
    actorId: "human-1",
    sessionId: "session-1",
    action: "fetch_resource",
    projectId: "afterglow",
    resourceType: "story-block",
    resourceId: "block-01",
  });
  assert.equal(request.action, "fetch_resource");
  assert.throws(() => normalizeChatGptGatewayRequest({
    actorId: "human-1",
    sessionId: "session-1",
    action: "git_merge",
  }), /Unsupported ChatGPT gateway action/);
  for (const forbidden of ["shell","filesystem","repository-write","git-merge","canon-write","browser-control","dsdd-pass-fail"]) {
    assert.throws(() => assertNoPrivilegedGatewayCapability(forbidden), /Forbidden ChatGPT gateway capability/);
  }
});

test("#2673 governed mentions retain PlotPickle-owned resource identity", () => {
  assert.ok(CHATGPT_GATEWAY_RESOURCE_TYPES.includes("character"));
  assert.equal(
    governedResourceUri({ projectId: "afterglow", resourceType: "character", resourceId: "ren" }),
    "plotpickle://project/afterglow/character/ren",
  );
  const response = chatGptGatewayResponse({
    request: {
      actorId: "human-1",
      sessionId: "session-1",
      action: "fetch_resource",
      projectId: "afterglow",
      resourceType: "character",
      resourceId: "ren",
    },
    data: { name: "Ren" },
  });
  assert.equal(response.authoritativeSource, "plotpickle-ppf");
  assert.equal(response.clientRole, "interface");
});

test("#2673 extension rollout keeps writes and file handling deferred", () => {
  assert.equal(CHATGPT_GATEWAY_EXTENSION_PLAN.sidebar.phase, "prototype");
  assert.equal(CHATGPT_GATEWAY_EXTENSION_PLAN.composerMentions.phase, "prototype-where-supported");
  assert.equal(CHATGPT_GATEWAY_EXTENSION_PLAN.fileViewer.phase, "deferred");
  assert.equal(CHATGPT_GATEWAY_EXTENSION_PLAN.richForms.phase, "deferred");
});

test("#2673 ChatGPT story gateway remains separate from developer MCP authority", async () => {
  const evaluation = JSON.parse(await readFile(new URL("../config/chatgpt-mcp-gateway-evaluation.json", import.meta.url), "utf8"));
  const developerMcp = await readFile(new URL("../scripts/developer-agent-mcp.mjs", import.meta.url), "utf8");
  assert.equal(evaluation.separation.developerMcp, "scripts/developer-agent-mcp.mjs");
  assert.equal(evaluation.separation.sharedMergeAuthority, false);
  assert.match(developerMcp, /GitHub exact-head CI remains the merge gate/);
  assert.equal(evaluation.browserAutomation.longTermRequiredPath, false);
});
