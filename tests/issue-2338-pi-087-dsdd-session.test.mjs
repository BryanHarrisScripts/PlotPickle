import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const readJson = async (file) => JSON.parse(await read(file));

test("#2338 promotes Pi 0.87 only with the candidate proof and authoritative metadata aligned", async () => {
  const [contract, managed, stack, oss, brief] = await Promise.all([
    readJson("config/pi-087-dsdd-session-evaluation.json"),
    read("scripts/pi-managed-install.mjs"),
    readJson("config/developer-agent-stack.json"),
    readJson("config/third-party-oss.json"),
    read("docs/developer-briefs/2338-dsdd-pi-087-persistent-session.md"),
  ]);

  assert.equal(contract.issue, 2338);
  assert.equal(contract.currentManagedVersion, "0.84.4");
  assert.equal(contract.candidateVersion, "0.87.0");
  assert.equal(contract.decision, "approved");
  assert.equal(contract.promotedManagedVersion, "0.87.0");
  assert.equal(contract.requiredCapabilities.contextEditEntry, true);
  assert.equal(contract.requiredCapabilities.contextWithSystemExtensionEvent, true);
  assert.deepEqual(contract.requiredExtensions, stack.piPackages);
  assert.match(managed, /PLOTPICKLE_MANAGED_PI_VERSION = "0\.87\.0"/u);
  assert.equal(stack.piRuntime.managedVersion, "0.87.0");
  assert.equal(oss.systems.find((item) => item.id === "pi-coding-agent")?.version, "0.87.0");
  assert.match(brief, /TALK[\s\S]*CONFIRM[\s\S]*BUILD[\s\S]*PROVE/u);
  assert.match(brief, /Original Human language remains immutable provenance/u);
});

test("#2338 candidate proof exercises Pi 0.87 append-only context editing and full-transcript extension registration", async () => {
  const source = await read("scripts/evaluate-pi-087-dsdd-session.mjs");

  assert.match(source, /"@earendil-works\/pi-coding-agent"/u);
  assert.match(source, /"install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact"/u);
  assert.match(source, /SessionManager/u);
  assert.match(source, /SessionManager\.inMemory/u);
  assert.match(source, /appendMessage/u);
  assert.match(source, /appendContextEdit/u);
  assert.match(source, /buildSessionProjection/u);
  assert.match(source, /rawHistoryPreserved/u);
  assert.match(source, /projectionChanged/u);
  assert.match(source, /context_with_system/u);
  assert.match(source, /DefaultResourceLoader, SettingsManager/u);
  assert.match(source, /"--mode", "rpc"/u);
  assert.match(source, /type: "get_state", id: "plotpickle-2338-rpc"/u);
  assert.match(source, /PLOTPICKLE_PI_2338_STATUS=passed/u);
  assert.match(source, /decision = "do-not-promote"/u);
  assert.doesNotMatch(source, /npm install -g/u);
});

test("#2338 keeps unsupported Pi source-only subpaths outside PlotPickle", async () => {
  const contract = await readJson("config/pi-087-dsdd-session-evaluation.json");
  assert.deepEqual(contract.forbiddenPlotPickleImports, [
    "@earendil-works/pi-coding-agent/client",
    "@earendil-works/pi-coding-agent/experimental/plugin",
  ]);
});

test("#2338 requires Windows Product Gate proof before Pi 0.87 promotion", async () => {
  const [productGate, prGate] = await Promise.all([
    read(".github/workflows/product-gate.yml"),
    read(".github/workflows/pr-gate.yml"),
  ]);
  assert.match(productGate, /Evaluate Pi 0\.87 DSDD session compatibility/u);
  assert.match(productGate, /node scripts\/evaluate-pi-087-dsdd-session\.mjs/u);
  assert.match(prGate, /Validate DSDD intent-to-evidence and Pi 0\.87 session contracts/u);
  assert.match(prGate, /tests\/issue-2338-pi-087-dsdd-session\.test\.mjs/u);
});


test("#2338 owns one recoverable profile-private Pi 0.87 session from narration through locked build", async () => {
  const [gateway, bridge, panel, auth] = await Promise.all([
    read("build/dsdd/dsdd-session-gateway.ts"),
    read("scripts/dsdd-pi-session.mjs"),
    read("app/skin-v1/global-dsdd-conversation.tsx"),
    read("build/auth/profile-request-context.ts"),
  ]);
  assert.match(auth, /"\/api\/dsdd"/u);
  assert.match(gateway, /OBJECT_ID = "dsdd-engineering-session-v1"/u);
  assert.match(gateway, /piSessionId/u);
  assert.match(gateway, /piSessionFile/u);
  assert.match(bridge, /SessionManager\.create/u);
  assert.match(bridge, /SessionManager\.open/u);
  assert.match(bridge, /appendMessage/u);
  assert.match(bridge, /plotpickle-dsdd-persistence-checkpoint/u);
  assert.match(bridge, /DSDD interpretation pending\./u);
  assert.match(bridge, /appendCustomEntry/u);
  assert.match(bridge, /appendContextEdit\(persistenceCheckpointId, null\)/u);
  assert.match(bridge, /appendCustomMessageEntry/u);
  assert.match(panel, /authenticatedProfileFetch/u);
});

test("#2338 injects the immutable locked intent into the same Pi history and existing isolated repair boundary", async () => {
  const [extension, repair, gateway] = await Promise.all([
    read("scripts/pi/dsdd-locked-intent-extension.mjs"),
    read("scripts/run-uat-repair-agent.mjs"),
    read("build/dsdd/dsdd-session-gateway.ts"),
  ]);
  assert.match(extension, /context_with_system/u);
  assert.match(extension, /PLOTPICKLE_DSDD_BUILD_PACKET/u);
  assert.match(extension, /event\.messages\[0\]/u);
  assert.match(extension, /Do not alter, weaken, reinterpret, or delete an acceptance obligation/u);
  assert.match(repair, /"--fork", path\.resolve\(dsddSessionFile\)/u);
  assert.match(repair, /dsdd-locked-intent-extension\.mjs/u);
  assert.match(repair, /PLOTPICKLE_DSDD_BUILD_PACKET/u);
  assert.match(repair, /prepareWorktree/u);
  assert.match(gateway, /run-uat-repair-agent\.mjs/u);
  assert.match(gateway, /"git-worktree"/u);
  assert.match(gateway, /"github-exact-head-green-only"/u);
});

test("#2338 Windows Product Gate runs automatically for Pi DSDD promotion heads", async () => {
  const productGate = await read(".github/workflows/product-gate.yml");
  assert.match(productGate, /pull_request:/u);
  assert.match(productGate, /config\/pi-087-dsdd-session-evaluation\.json/u);
  assert.match(productGate, /github\.event\.pull_request\.head\.sha \|\| github\.sha/u);
});
