import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#1897 Cloud and Local Story Mode render one Skin V1 naming hierarchy without changing stable routes", async () => {
  const [cloud, local] = await Promise.all([
    read("app/skin-v1/cloud-story-mode-host.tsx"),
    read("app/skin-v1/local-ai-skin-host.tsx"),
  ]);
  const cloudDisplay = cloud.slice(cloud.indexOf("const CLOUD_DISPLAY_LABELS"), cloud.indexOf("const VIEW_TITLES"));
  const localDisplay = local.slice(local.indexOf("const LOCAL_DISPLAY_LABELS"), local.indexOf("const VIEW_TITLES"));

  for (const [id, label] of Object.entries({
    writing: "Writing",
    images: "Images",
    video: "Video",
    agents: "Agents",
    openai: "OpenAI",
    "comfy-cloud": "ComfyUI",
    gemini: "Gemini",
    minimax: "MiniMax",
  })) {
    assert.ok(cloudDisplay.includes(`${id.includes("-") ? JSON.stringify(id) : id}: "${label}"`), `Cloud display label must use canonical casing for ${id}`);
  }
  assert.match(cloud, /group: "CAPABILITIES"/u);
  assert.match(cloud, /group: "CONNECTIONS"/u);
  assert.match(cloud, /CLOUD_DISPLAY_LABELS\[item\.id\]/u);
  assert.match(cloud, /<h1[^>]*>\{VIEW_TITLES\[view\]\}<\/h1>/u);
  assert.doesNotMatch(cloudDisplay, /GOOGLE GEMINI|COMFYUI CLOUD/u);

  for (const [id, label] of Object.entries({
    writing: "Writing",
    images: "Images",
    video: "Video",
    agents: "Agents",
    ollama: "Ollama",
    comfyui: "ComfyUI",
    ltx: "LTX-Video",
    h3: "MiniMax H3",
  })) {
    assert.ok(localDisplay.includes(`${id}: "${label}"`), `Local display label must use canonical casing for ${id}`);
  }
  assert.match(local, /group: "CAPABILITIES"/u);
  assert.match(local, /group: "CONNECTIONS"/u);
  assert.match(local, /LOCAL_DISPLAY_LABELS\[item\.id\]/u);
  assert.match(local, /<h1[^>]*>\{VIEW_TITLES\[view\]\}<\/h1>/u);

  assert.doesNotMatch(cloud, /CLOUD RESOURCES|-- PROVIDERS --/u);
  assert.doesNotMatch(local, /group: "ENGINES"|-- PROVIDERS --/u);

  // Stable route/provider IDs remain unchanged underneath presentation copy.
  for (const route of ["openai", "minimax", "gemini", "comfy-cloud"]) assert.ok(cloud.includes(`id: "${route}"`));
  for (const route of ["ollama", "comfyui", "ltx", "h3"]) assert.ok(local.includes(`id: "${route}"`));
});

test("#1897 Profile and Community use readable Skin V1 supporting typography", async () => {
  const [profileCss, communityCss, community] = await Promise.all([
    read("app/skin-v1-bbs-surfaces.css"),
    read("app/_components/community/community-navigation.module.css"),
    read("app/_components/community/community-workspace.tsx"),
  ]);

  for (const visibleCopy of [
    "[P] Profile - Your profile",
    "[L] Local Story Mode - Local writing / images / video",
    "[N] Node - Node info",
  ]) assert.ok(profileCss.includes(`content: "${visibleCopy}"`), `${visibleCopy} must be rendered in Title/Sentence Case`);

  assert.match(profileCss, /data-profile-identity-surface="v2"[\s\S]*font-size: var\(--pp-skin-font-body\) !important/u);
  assert.match(profileCss, /data-profile-identity-surface="v2"[\s\S]*font-size: var\(--pp-skin-font-title\) !important/u);
  assert.match(profileCss, /\.pp-skin-v1-return\s*\{[\s\S]*text-transform: none !important;/u);

  assert.match(communityCss, /\.subDestination small\s*\{[\s\S]*font-size: var\(--pp-skin-font-body, 15px\);/u);
  assert.match(communityCss, /community-discovery-heading[\s\S]*content: "Request Access";[\s\S]*text-transform: none;/u);
  assert.doesNotMatch(communityCss, /\.subDestination small\s*\{[^}]*font-size:\s*10px;/u);
  assert.doesNotMatch(communityCss, /\.messageActions (?:span|button)\s*\{[^}]*font-size:\s*8px;/u);
  assert.doesNotMatch(communityCss, /\.roomHeaderActions button\s*\{[^}]*font-size:\s*10px;/u);

  assert.match(community, /"great-hall": "Welcome, questions & general chat"/u);
  assert.match(community, /<span>Private Story Room<\/span><small>\{privateStoryRoom \? "READY"/u);
});
