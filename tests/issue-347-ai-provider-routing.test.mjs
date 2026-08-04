import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #347 provides independent mutually exclusive text image and video switches", async () => {
  const panel = await source("app/ai-routing-panel.tsx");
  for (const phrase of [
    "Choose where text, images and video are created",
    "Ollama · Local",
    "OpenAI · Cloud",
    "ComfyUI · Local",
    "OpenAI Images · Cloud",
    "MiniMax Images · Cloud",
    "Manual Import",
    "ComfyUI H3 · Local",
    "MiniMax H3 · Cloud",
    "OpenAI Video · Cloud",
    "Use low-cost local setup",
    "PlotPickle never switches to a paid provider automatically",
  ]) assert.ok(panel.includes(phrase), `Missing routing choice: ${phrase}`);
  assert.match(panel, /type="radio"/);
  assert.match(panel, /name=\{`ai-route-\$\{capability\}`\}/);
  assert.match(panel, /checked=\{selected\}/);
  assert.match(panel, /route: "ollama"/);
  assert.match(panel, /route: "comfyui"/);
  assert.match(panel, /route: "comfyui-native"/);
});

test("issue #347 requires explicit paid and data-sharing consent without running a paid request on selection", async () => {
  const [panel, gateway] = await Promise.all([
    source("app/ai-routing-panel.tsx"),
    source("build/ai-routing-gateway.ts"),
  ]);
  for (const phrase of [
    "I understand cloud API requests can incur charges",
    "I understand cloud video sends the prompt and selected reference image",
    "Selecting a provider does not run a paid test or generation",
    "Confirm possible provider charges",
  ]) assert.ok(panel.includes(phrase), `Missing cloud consent copy: ${phrase}`);
  assert.match(gateway, /requirePaidConsent/);
  assert.match(gateway, /paidAcknowledged !== true/);
  assert.match(gateway, /dataSharingAcknowledged !== true/);
  assert.match(gateway, /silentPaidFallback: false/);
  assert.doesNotMatch(panel, /\/test\/image|\/test\/video/);
});

test("issue #347 stores routing outside PPF and coordinates existing provider stores", async () => {
  const gateway = await source("build/ai-routing-gateway.ts");
  for (const contract of [
    "ai-routing.json",
    "writing-assistant-profiles.json",
    "readSynchronizedAssistantStore",
    "writeAssistantStore",
    "readMediaRoutingStore",
    "writeMediaRoutingStore",
    "readNativeH3Store",
    "writeNativeH3Store",
    'media.videoRoute = route === "minimax" ? "minimax-direct" : "none"',
    "native.active = false",
  ]) assert.ok(gateway.includes(contract), `Missing coordinated routing contract: ${contract}`);
  assert.doesNotMatch(gateway, /PlotPickleProject|\.ppf|project\.json/);
});

test("issue #347 adds the official asynchronous OpenAI video job lifecycle", async () => {
  const [gateway, providers] = await Promise.all([
    source("build/ai-routing-gateway.ts"),
    source("lib/ai/providers.ts"),
  ]);
  for (const contract of [
    'form.set("model", model)',
    'form.set("prompt", prompt)',
    'form.set("seconds", openAiSeconds',
    'form.set("size", input.aspectRatio === "9:16" ? "720x1280" : "1280x720")',
    '/videos/${encodeURIComponent(id)}',
    '/content',
    'model = profile.videoModel || "sora-2"',
    "openai-video-jobs.json",
    "saveGeneratedAsset",
  ]) assert.ok(gateway.includes(contract), `Missing OpenAI video contract: ${contract}`);
  assert.match(providers, /"video-generation"/);
  assert.match(providers, /video: "sora-2"/);
  assert.match(providers, /OPENAI_VIDEO_SUNSET/);
  assert.match(providers, /will not fall back to it automatically/);
});

test("issue #347 registers routing before native and cloud media gateways", async () => {
  const localGateway = await source("build/local-ai-gateway.ts");
  assert.match(localGateway, /registerAiRoutingGateway\(server\)[\s\S]*registerNativeH3Gateway\(server\)[\s\S]*registerMediaRoutingGateway\(server\)[\s\S]*registerWritingAssistantGateway\(server\)/);
  assert.match(localGateway, /import \{ registerAiRoutingGateway \} from "\.\/ai-routing-gateway"/);
});

test("issue #347 is discoverable from Settings while Dashboard remains status only", async () => {
  const [page, sitemap, dashboard] = await Promise.all([
    source("app/ai-routing/page.tsx"),
    source("app/settings-sitemap.tsx"),
    source("app/configuration-dashboard-overview.tsx"),
  ]);
  assert.match(page, /AiRoutingPanel/);
  assert.match(page, /Back to PlotPickle Settings/);
  assert.match(sitemap, /label="AI Routing"/);
  assert.match(sitemap, /href="\/ai-routing"/);
  assert.doesNotMatch(dashboard, /AiRoutingPanel|paidAcknowledged|dataSharingAcknowledged|type="radio"/);
});

test("issue #347 protects responsive switches focus states and reduced motion", async () => {
  const css = await source("app/ai-routing-panel.module.css");
  for (const contract of [
    "min-height: 44px",
    ":focus-visible",
    "env(safe-area-inset-top)",
    "@media (max-width: 560px)",
    "@media (prefers-reduced-motion: reduce)",
    '.option[data-selected="true"]',
    ".switch::after",
  ]) assert.ok(css.includes(contract), `Missing routing UI contract: ${contract}`);
});
