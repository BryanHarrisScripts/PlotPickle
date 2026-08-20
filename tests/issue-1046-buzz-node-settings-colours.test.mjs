import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("NODE reads the connected BUZZ community name and never substitutes the PlotPickle presentation alias", async () => {
  const [workspace, terminal] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/community-backdoor-terminal.tsx"),
  ]);

  assert.match(workspace, /const nodeName = community\?\.community\.trim\(\) \|\| ""/);
  assert.match(workspace, /SERVER \/ NODE/);
  assert.match(workspace, /\{nodeName \|\| "BUZZ NODE UNAVAILABLE"\}/);
  assert.match(workspace, /<CommunityBackdoorTerminal[\s\S]*nodeName=\{nodeName\}/);
  assert.doesNotMatch(workspace, /COMMUNITY_BBS_NODE|plotpickle-community/);

  assert.match(terminal, /readonly nodeName: string/);
  assert.match(terminal, /<dt>NODE<\/dt>/);
  assert.match(terminal, /\{nodeName \|\| "BUZZ NODE UNAVAILABLE"\}/);
  assert.doesNotMatch(terminal, /COMMUNITY_BBS_NODE|plotpickle-community/);
});

test("BUZZ relay, identity and credential authority remain on the existing connection contract", async () => {
  const [communityGateway, buzzGateway] = await Promise.all([
    read("build/buzz-community-gateway.ts"),
    read("build/buzz-gateway.ts"),
  ]);

  for (const source of [communityGateway, buzzGateway]) {
    assert.match(source, /const CONNECTION_FILE = "buzz-connection\.json"/);
    assert.match(source, /relayUrl: string/);
    assert.match(source, /community: string/);
    assert.match(source, /identityLabel: string/);
    assert.match(source, /privateKey: string/);
    assert.match(source, /verificationVersion\?: 2/);
  }

  assert.doesNotMatch(communityGateway, /buzz-node-connection|buzz-relay-identity-v2/);
  assert.doesNotMatch(buzzGateway, /buzz-node-connection|buzz-relay-identity-v2/);
});

test("Settings media routing uses the approved dark PlotPickle token system without changing provider behavior", async () => {
  const [css, panel, settings] = await Promise.all([
    read("app/media-routing-panel.module.css"),
    read("app/media-routing-panel.tsx"),
    read("app/settings-panel.tsx"),
  ]);

  for (const token of [
    "--pp-matte",
    "--pp-surface",
    "--pp-surface-raised",
    "--pp-text",
    "--pp-muted",
    "--pp-teal",
    "--pp-orange",
    "--pp-line",
  ]) assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.doesNotMatch(css, /#f9fffd|#f2f8f7|#fbfdfd|#f5fbf9|#f4f8f7|#edf7f4|#eef8f5|background:\s*#fff\b|background:\s*white\b/i);
  assert.match(css, /\.columns\{display:grid;grid-template-columns:1fr 1fr/);
  assert.match(css, /@media\(max-width:950px\)\{\.columns\{grid-template-columns:1fr\}/);

  assert.match(panel, /const API = "\/api\/media-routing"/);
  assert.match(panel, /const COMFY_START_API = `\$\{API\}\/comfyui\/start`/);
  assert.match(panel, /imageRoute: "comfyui"/);
  assert.match(panel, /videoRoute: "none"/);
  assert.match(panel, /\/api\/provider-diagnostics\/comfyui/);
  assert.match(settings, /<MediaRoutingPanel onManage=\{openComponentTarget\}/);
});
