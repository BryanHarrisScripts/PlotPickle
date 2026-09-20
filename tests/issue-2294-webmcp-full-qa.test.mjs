import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  WEBMCP_FULL_QA_ORDER,
  WEBMCP_QA_PROFILE_CONFIG,
  resolveWebMcpQaProfile,
  webMcpQaProfileMenuLines,
} from "../lib/verification/webmcp-qa/profiles.mjs";
import { writeStoreZip } from "../lib/verification/webmcp-qa/artifacts.mjs";
import { WEBMCP_STANDARD_SURFACE_TARGETS } from "../lib/verification/webmcp-canonical-surface-registry.mjs";

const read = (target) => readFile(new URL("../" + target, import.meta.url), "utf8");

test("#2294 exposes exactly six governed QA profiles and keeps Full QA ordered 1 through 5", () => {
  assert.deepEqual(WEBMCP_QA_PROFILE_CONFIG.profiles.map((profile) => profile.id), ["1", "2", "3", "4", "5", "6"]);
  assert.deepEqual(WEBMCP_FULL_QA_ORDER, ["1", "2", "3", "4", "5"]);
  assert.equal(WEBMCP_QA_PROFILE_CONFIG.defaultProfile, "1");
  assert.equal(resolveWebMcpQaProfile("standard").id, "1");
  assert.equal(resolveWebMcpQaProfile("FULL QA").id, "6");
  assert.equal(resolveWebMcpQaProfile("6").key, "full");
  const menu = webMcpQaProfileMenuLines().join("\n");
  for (const label of ["STANDARD", "INTERACTION", "RESILIENCE", "CONTINUITY", "RUNTIME", "FULL QA"]) {
    assert.match(menu, new RegExp(label, "u"));
  }
});

test("#2294 preserves Standard as the existing WebMCP implementation and routes selection through one runner", async () => {
  const [startup, qaRunner, launcher] = await Promise.all([
    read("scripts/run-webmcp-startup-uat.mjs"),
    read("lib/verification/webmcp-qa/runner.mjs"),
    read("Start-PlotPickle.bat"),
  ]);

  assert.match(startup, /profile = "1"/u);
  assert.match(startup, /runWebMcpQaProfile/u);
  assert.match(startup, /runStandard: async \(\) =>/u);
  assert.match(startup, /runWebMcpSurfaceVisualAudit/u);
  assert.match(startup, /runWebMcpStandardSurfaceCatalogue/u);
  assert.match(startup, /runSkinV1VisualDirector/u);
  assert.match(startup, /runSkinV1MenuContractAudit/u);
  assert.match(startup, /argument\("--profile", process\.env\.PLOTPICKLE_WEBMCP_QA_PROFILE \|\| "1"\)/u);
  assert.match(startup, /selectedProfile\.id === "1" && allowBaselinePrompt/u);

  assert.match(qaRunner, /WEBMCP_FULL_QA_ORDER/u);
  assert.match(qaRunner, /if \(profile\.id === "1"\)[\s\S]*runStandard/u);
  assert.match(qaRunner, /Profile 1 Standard did not establish a trustworthy governed application baseline/u);
  assert.match(qaRunner, /finalizeWebMcpFullQaArtifacts/u);

  assert.match(launcher, /choice \/C 123456 \/N \/M "Choose WebMCP QA profile \[1-6\]:"/u);
  assert.match(launcher, /PLOTPICKLE_WEBMCP_QA_PROFILE=!ERRORLEVEL!/u);
  assert.match(launcher, /--profile "' \+ \$env:PLOTPICKLE_WEBMCP_QA_PROFILE/u);
});

test("#2294 profiles reuse the Browser Verification Broker and keep interaction/fault boundaries explicit", async () => {
  const [interaction, resilience, continuity, runtime] = await Promise.all([
    read("lib/verification/browser-probes/interaction.mjs"),
    read("lib/verification/browser-probes/resilience.mjs"),
    read("lib/verification/browser-probes/continuity.mjs"),
    read("lib/verification/browser-probes/runtime.mjs"),
  ]);

  for (const source of [interaction, resilience, continuity, runtime]) {
    assert.match(source, /createBrowserVerificationSession/u);
  }

  assert.match(interaction, /page\.keyboard\.press\("Tab"\)/u);
  assert.match(interaction, /page\.keyboard\.press\("Enter"\)/u);
  assert.doesNotMatch(interaction, /dispatchEvent/u);
  assert.match(interaction, /syntheticEventDispatch: false/u);

  assert.match(resilience, /__plotpickle_webmcp_qa_probe__/u);
  assert.match(resilience, /page\.route/u);
  assert.match(resilience, /externalProviderCalls: false/u);
  assert.match(resilience, /mutationOfExternalSystems: false/u);
  assert.doesNotMatch(resilience, /openai\.com|anthropic\.com|googleapis\.com|replicate\.com/u);

  for (const stage of ["outline", "storyboard", "previs", "timeline", "production"]) {
    assert.ok(continuity.includes('id: "' + stage + '"'));
  }
  assert.match(continuity, /context\.newPage/u);
  assert.match(continuity, /session\.browser\.newContext/u);
  assert.match(continuity, /isolated-context-storage-boundary/u);

  assert.match(runtime, /duplicate-visible-ids/u);
  assert.match(runtime, /hidden-focus-target/u);
  assert.match(runtime, /horizontal-overflow/u);
  assert.match(runtime, /accessible-control-name/u);
  assert.match(runtime, /browser-verification-broker/u);
});

test("#2294 keeps the existing 30-surface Standard catalogue unchanged", () => {
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.length, 30);
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("dashboard"));
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("story-map"));
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("storyboard"));
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("previs"));
  assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes("scene-timeline"));
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.includes("production"), false);
});

test("#2294 portable evidence writer creates one ZIP bundle without adding a package dependency", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2294-"));
  const root = path.join(temp, "evidence");
  const zip = path.join(temp, "full-qa.zip");
  try {
    await mkdir(path.join(root, "profile-1-standard"), { recursive: true });
    await mkdir(path.join(root, "profile-5-runtime"), { recursive: true });
    await writeFile(path.join(root, "manifest.json"), "{\"runId\":\"test\"}\n", "utf8");
    await writeFile(path.join(root, "profile-1-standard", "report.json"), "{\"status\":\"PASS\"}\n", "utf8");
    await writeFile(path.join(root, "profile-5-runtime", "report.json"), "{\"status\":\"PASS\"}\n", "utf8");

    const result = await writeStoreZip(root, zip);
    assert.equal(result.files, 3);
    const buffer = await readFile(zip);
    assert.equal(buffer.subarray(0, 4).toString("binary"), "PK\u0003\u0004");
    const text = buffer.toString("utf8");
    assert.match(text, /manifest\.json/u);
    assert.match(text, /profile-1-standard\/report\.json/u);
    assert.match(text, /profile-5-runtime\/report\.json/u);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("#2294 Full QA evidence contract records commit, ordered profiles, sanitization and Standard evidence", async () => {
  const artifacts = await read("lib/verification/webmcp-qa/artifacts.mjs");
  for (const evidence of [
    "webmcp-startup/summary.json",
    "webmcp-startup/uat-findings.json",
    "startup-initializing-candidate.png",
    "profile-locked-candidate.png",
    "dashboard-canonical.png",
    "visual-director-report.json",
    "surface-contract-matrix.md",
    "skin-v1-visual-director/geometry",
  ]) {
    assert.ok(artifacts.includes(evidence), "Missing expected evidence path: " + evidence);
  }
  assert.match(artifacts, /commitSha/u);
  assert.match(artifacts, /orderedProfiles: \["1", "2", "3", "4", "5"\]/u);
  assert.match(artifacts, /credentials: "excluded"/u);
  assert.match(artifacts, /humanPassphrases: "excluded"/u);
  assert.match(artifacts, /surfaceCatalogue: 30/u);
});
