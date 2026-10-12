import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { build } from "esbuild";
import { readVerifierObservations, verifierObservationAuthority } from "../lib/verification/development/verifier-observations.mjs";
import { evaluateVerifierEvidenceUpdate, retainVerifierReceiptIds } from "../build/dsdd/dsdd-evidence-contract.mjs";
import { createCaseEvidenceManifest, evaluateCaseEvidenceWithReceipts } from "../scripts/casebook-evidence.mjs";

const now = Date.parse("2026-10-12T18:00:00Z");
const testedCommit = "a".repeat(40), intentDigest = "b".repeat(64);
const subject = { kind: "dsdd", profileId: "isolated-profile", sessionId: "session-1", intentVersion: 1,
  intentDigest, requirementId: "R1", promise: "Recover the same saved image after restart" };
const keys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ type: "spki", format: "pem" });

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pp-verifier-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const artifact = Buffer.from("Reversible non-sensitive verifier artifact bytes.");
  await writeFile(path.join(root, "readback.bin"), artifact);
  const authority = { root, publicKey, source: "independent-recovery-observer", environment: "isolated-environment", configuration: "config-digest-1" };
  async function receipt(id = "success", changes = {}, signingKey = keys.privateKey) {
    const payload = { schemaVersion: 1, receiptId: id, subject,
      observedAt: "2026-10-12T17:59:00Z", expiresAt: "2026-10-13T18:00:00Z",
      artifact: { path: "readback.bin", sha256: createHash("sha256").update(artifact).digest("hex") },
      observation: { contractId: `dsdd:${intentDigest}`, contractVersion: "1", obligationId: "R1", promise: subject.promise,
        testedCommit, environment: authority.environment, configuration: authority.configuration, source: authority.source,
        independent: true, simulated: false, scope: "real-product-observation", finding: "supports",
        action: "Stop and reopen the isolated process", observedResult: "Known image bytes were recovered", ...changes.observation },
      ...Object.fromEntries(Object.entries(changes).filter(([key]) => key !== "observation")) };
    const bytes = Buffer.from(JSON.stringify(payload));
    const envelope = { schemaVersion: 1, payload: bytes.toString("base64"), signature: sign(null, bytes, signingKey).toString("base64") };
    await writeFile(path.join(root, `${id}.json`), JSON.stringify(envelope));
    return { payload, envelope };
  }
  const input = { authority, subject, testedCommit, now };
  const dsdd = { authority, ...subject, testedCommit, now };
  return { root, receipt, input, dsdd, authority };
}

test("#2937 authentic matching receipt binds actual bytes and locked intent, with bounded PASS", async (t) => {
  const f = await fixture(t); await f.receipt();
  const result = await evaluateVerifierEvidenceUpdate({ ...f.dsdd, receiptIds: ["success"] });
  assert.equal(result.status, "PASS");
  assert.deepEqual(result.receiptDiagnostics, []);
  assert.match(result.evidence[0].ref, /^verifier:success:sha256:/u);
  assert.equal(result.claimScope, "locked-requirement-product-observation");
});

test("#2937 wrong signature, modified payload and changed artifact cannot grant PASS", async (t) => {
  const f = await fixture(t);
  await f.receipt("wrong-key", {}, generateKeyPairSync("ed25519").privateKey);
  const { envelope, payload } = await f.receipt("altered");
  payload.observation.finding = "contradicts";
  envelope.payload = Buffer.from(JSON.stringify(payload)).toString("base64");
  await writeFile(path.join(f.root, "altered.json"), JSON.stringify(envelope));
  for (const id of ["wrong-key", "altered"]) {
    const result = await evaluateVerifierEvidenceUpdate({ ...f.dsdd, receiptIds: [id] });
    assert.equal(result.status, "UNPROVEN"); assert.equal(result.receiptDiagnostics[0].reason, "invalid-verifier-signature");
  }
  await f.receipt(); await writeFile(path.join(f.root, "readback.bin"), "different recovered bytes");
  const result = await evaluateVerifierEvidenceUpdate({ ...f.dsdd, receiptIds: ["success"] });
  assert.equal(result.status, "UNPROVEN"); assert.equal(result.receiptDiagnostics[0].reason, "artifact-digest-mismatch");
});

test("#2937 wrong profile, session, requirement, intent, revision, provider configuration and source remain unproven", async (t) => {
  const f = await fixture(t);
  const changes = [
    ...[{ profileId: "another-profile" }, { sessionId: "another-session" }, { intentVersion: 2 }, { intentDigest: "c".repeat(64) },
      { requirementId: "R2" }, { promise: "Other promise" }].map((change) => ({ subject: { ...subject, ...change } })),
    ...[{ testedCommit: "c".repeat(40) }, { environment: "another-device" }, { configuration: "another-model-config" },
      { source: "implementation-agent" }, { contractVersion: "2" }, { obligationId: "R2" }, { promise: "Other promise" },
      { contractId: "another-contract" }].map((observation) => ({ observation })),
  ];
  for (const [index, change] of changes.entries()) {
    const id = `mismatch-${index}`; await f.receipt(id, change);
    assert.equal((await evaluateVerifierEvidenceUpdate({ ...f.dsdd, receiptIds: [id] })).status, "UNPROVEN", JSON.stringify(change));
  }
});

test("#2937 signed fixture, self-report or execution-only records cannot become product observation", async (t) => {
  const f = await fixture(t);
  for (const [index, observation] of [{ simulated: true }, { independent: false }, { scope: "unit-fixture" }, { scope: "execution-only" }].entries()) {
    const id = `scope-${index}`; await f.receipt(id, { observation });
    const result = await evaluateVerifierEvidenceUpdate({ ...f.dsdd, receiptIds: [id] });
    assert.equal(result.status, "UNPROVEN"); assert.equal(result.receiptDiagnostics[0].reason, "observation-scope-insufficient");
  }
});

test("#2937 expiry, invalid time, missing trust, artifact or receipt never preserve historical PASS", async (t) => {
  const f = await fixture(t);
  for (const [id, changes] of [["expired", { expiresAt: "2026-10-12T18:00:00Z" }], ["future", { observedAt: "2026-10-13T18:00:00Z" }],
    ["invalid", { observedAt: "not-a-time" }]]) {
    await f.receipt(id, changes);
    assert.equal((await evaluateVerifierEvidenceUpdate({ ...f.dsdd, receiptIds: [id] })).status, "UNPROVEN");
  }
  await f.receipt();
  assert.equal((await evaluateVerifierEvidenceUpdate({ ...f.dsdd, authority: {}, receiptIds: ["success"] })).status, "UNPROVEN");
  assert.equal((await evaluateVerifierEvidenceUpdate({ ...f.dsdd, receiptIds: ["missing"] })).status, "UNPROVEN");
  assert.equal((await evaluateVerifierEvidenceUpdate({ ...f.dsdd, receiptIds: ["success"] })).status, "PASS");
  await rm(path.join(f.root, "readback.bin"));
  assert.equal((await evaluateVerifierEvidenceUpdate({ ...f.dsdd, receiptIds: ["success"] })).status, "UNPROVEN");
});

test("#2937 public evidence cannot substitute a trusted ref or install its own authority", async (t) => {
  const f = await fixture(t); await f.receipt("contradiction", { observation: { finding: "contradicts" } });
  const admitted = await readVerifierObservations({ ...f.input, receiptIds: ["contradiction"] });
  const forged = { ...admitted.observations[0], ...subject, finding: "supports", proofType: "runtime", testedSource: "PlotPickle", summary: "Fake success" };
  const result = await evaluateVerifierEvidenceUpdate({ ...f.dsdd, receiptIds: ["contradiction"], evidence: [forged] });
  assert.equal(result.status, "FAIL"); assert.equal(result.evidence[0].finding, "contradicts");
  assert.equal((await evaluateVerifierEvidenceUpdate({ ...f.dsdd, receiptIds: [], evidence: [forged] })).status, "UNPROVEN");
  assert.deepEqual(verifierObservationAuthority({}), { root: "", publicKey: "", source: "", environment: "", configuration: "" });
});

test("#2937 retained contradiction outranks blockers and support; missing retained receipts prevent a new green", async (t) => {
  const f = await fixture(t);
  await f.receipt(); await f.receipt("blocked", { observation: { finding: "blocked", blocker: "Storage unavailable" } });
  await f.receipt("contradiction", { observation: { finding: "contradicts" } });
  assert.equal((await evaluateVerifierEvidenceUpdate({ ...f.dsdd, receiptIds: ["blocked"] })).status, "BLOCKED");
  const receiptIds = retainVerifierReceiptIds(["contradiction"], ["success", "blocked"]);
  assert.equal((await evaluateVerifierEvidenceUpdate({ ...f.dsdd, receiptIds })).status, "FAIL");
  assert.deepEqual(retainVerifierReceiptIds(receiptIds, []), receiptIds);
  await rm(path.join(f.root, "contradiction.json"));
  assert.equal((await evaluateVerifierEvidenceUpdate({ ...f.dsdd, receiptIds })).status, "UNPROVEN");
});

test("#2937 unsafe IDs, artifact traversal and links outside trusted root are rejected", async (t) => {
  const f = await fixture(t);
  for (const id of ["../escape", "C:drive", "nested/id"]) {
    assert.equal((await readVerifierObservations({ ...f.input, receiptIds: [id] })).observations.length, 0);
    assert.throws(() => retainVerifierReceiptIds([], [id]), /Invalid/u);
  }
  for (const artifactPath of ["../outside", "C:/outside", "nested/../readback.bin", "nested\\readback.bin"]) {
    await f.receipt("unsafe", { artifact: { path: artifactPath, sha256: "a".repeat(64) } });
    assert.equal((await readVerifierObservations({ ...f.input, receiptIds: ["unsafe"] })).diagnostics[0].reason, "unsafe-artifact-path");
  }
  const outside = await mkdtemp(path.join(os.tmpdir(), "pp-outside-")); t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(path.join(outside, "data"), "outside");
  try { await symlink(path.join(outside, "data"), path.join(f.root, "outside-link")); }
  catch (error) { if (process.platform === "win32" && error.code === "EPERM") return; throw error; }
  await f.receipt("linked", { artifact: { path: "outside-link", sha256: "a".repeat(64) } });
  assert.equal((await readVerifierObservations({ ...f.input, receiptIds: ["linked"] })).diagnostics[0].reason, "artifact-outside-root");
});

test("#2937 receipt limits reject overflow instead of truncating away contradictions", () => {
  assert.throws(() => retainVerifierReceiptIds(Array.from({ length: 128 }, (_, i) => `receipt-${i}`), ["contradiction"]), /cannot be discarded/u);
});

test("#2937 Casebook uses the same signed observation boundary and never invents a complete journey", async (t) => {
  const f = await fixture(t);
  const definition = JSON.parse(await readFile(new URL("../docs/behavioral-contracts/PP-SAVE-001.casebook.json", import.meta.url), "utf8"));
  f.authority.source = definition.independentVerification.source;
  const manifest = createCaseEvidenceManifest(definition, { runId: "isolated-save-run" });
  const obligation = definition.behavioralContract.obligations[0];
  const changes = { subject: { kind: "casebook", caseId: definition.id, runId: manifest.runId }, observation: {
    source: f.authority.source, contractId: definition.behavioralContract.id, contractVersion: definition.behavioralContract.version,
    obligationId: obligation.id, promise: obligation.promise } };
  await f.receipt("casebook", changes);
  const result = await evaluateCaseEvidenceWithReceipts(definition, manifest, { authority: f.authority, testedCommit, now, receiptIds: ["casebook"] });
  assert.equal(result.obligations[0].status, "PASS"); assert.equal(result.claimStatus, "UNPROVEN");
  assert.equal(result.missingJourneySteps.length, definition.humanJourney.length);
  await f.receipt("casebook-fail", { ...changes, observation: { ...changes.observation, finding: "contradicts" } });
  const failed = await evaluateCaseEvidenceWithReceipts(definition, manifest, { authority: f.authority, testedCommit, now, receiptIds: ["casebook-fail"] });
  assert.equal(failed.claimStatus, "FAIL");
});

test("#2937 real gateway HTTP intake retains contradictions and revalidates stored receipts on read", async (t) => {
  const f = await fixture(t);
  // Storage and Pi are fixtures. The actual HTTP handler and receipt verifier execute unchanged.
  const stored = { schemaVersion: 1, sessionId: subject.sessionId, conversation: [], intents: [{ version: 1,
    handoffPacket: { intentDigest }, requirements: [{ id: "R1", text: subject.promise, status: "UNPROVEN", evidence: [] }] }] };
  let session = structuredClone(stored);
  const contextKey = `__ppReceiptContext${Date.now()}`;
  globalThis[contextKey] = { profileId: subject.profileId, authContext: {}, privateStorage: {
    readPrivateJson: async () => structuredClone(session),
    writePrivateJson: async (_auth, input) => { session = structuredClone(input.value); },
  } };
  t.after(() => { delete globalThis[contextKey]; });
  const stubs = new Map([
    ["../auth/profile-request-context", `export const currentProfileRequestContext=()=>globalThis[${JSON.stringify(contextKey)}];`],
    ["../local-credentials", `export const persistentHome=()=>${JSON.stringify(f.root)};`],
    ["./dsdd-github-brief", "export const publishDsddBrief=()=>{};"],
    ["./dsdd-pi-brief", "export const runDsddPiBrief=()=>{};"],
    ["./dsdd-pi-session", "export const runDsddPiAction=async()=>({});"],
    ["../../scripts/dsdd-integrity.mjs", "export const assertDsddInterpretationIntegrity=()=>{};"],
    ["../../lib/verification/conversational-uat/referee.mjs", "export const correlateConversationalFindings=()=>{}; export const decideConversationalFinding=()=>{}; export const semanticJourneyEvent=()=>{};"],
  ]);
  const bundled = await build({ entryPoints: ["build/dsdd/dsdd-session-gateway.ts"], bundle: true, platform: "node", format: "esm", write: false,
    plugins: [{ name: "isolated-host-dependencies", setup(plugin) {
      plugin.onResolve({ filter: /.*/ }, (args) => stubs.has(args.path) ? { path: args.path, namespace: "host-fixture" } : undefined);
      plugin.onLoad({ filter: /.*/, namespace: "host-fixture" }, (args) => ({ contents: stubs.get(args.path), loader: "js" }));
    } }] });
  const gateway = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  const env = { PLOTPICKLE_SOURCE_SHA: testedCommit, PLOTPICKLE_OBSERVATION_RECEIPT_ROOT: f.root,
    PLOTPICKLE_OBSERVATION_PUBLIC_KEY: publicKey, PLOTPICKLE_OBSERVATION_VERIFIER: f.authority.source,
    PLOTPICKLE_OBSERVATION_ENVIRONMENT: f.authority.environment, PLOTPICKLE_OBSERVATION_CONFIGURATION: f.authority.configuration };
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  // Wall-clock validity is verifier-owned; the gateway does not accept a public test clock.
  const changes = { observedAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 3600_000).toISOString() };
  await f.receipt("contradiction", { ...changes, observation: { finding: "contradicts" } }); await f.receipt("success", changes);
  let middleware; gateway.registerDsddSessionGateway({ middlewares: { use: (fn) => { middleware = fn; } } });
  const server = createServer((request, response) => middleware(request, response, () => { response.statusCode = 404; response.end(); }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}/api/dsdd/command`;
  const post = async (verifierReceiptIds, extra = {}) => {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      action: "record-evidence", intentVersion: 1, requirements: [{ id: "R1", status: "PASS", verifierReceiptIds, ...extra }] }) });
    assert.equal(response.status, 200); return (await response.json()).intent.requirements[0];
  };
  assert.equal((await post(["contradiction"])).status, "FAIL");
  const updated = await post(["success"], { verifiedArtifactRefs: ["made-up"], source: f.authority.source });
  assert.equal(updated.status, "FAIL"); assert.deepEqual(updated.verifierReceiptIds, ["contradiction", "success"]);
  const read = await (await fetch(url)).json(); assert.equal(read.session.intents[0].requirements[0].status, "FAIL");
  // Even another valid signature cannot rewrite the same retained receipt identity.
  await f.receipt("contradiction", changes);
  const replaced = await (await fetch(url)).json(); assert.equal(replaced.session.intents[0].requirements[0].status, "UNPROVEN");
  assert.equal(replaced.session.intents[0].requirements[0].receiptDiagnostics[0].reason, "receipt-replaced");
  await rm(path.join(f.root, "contradiction.json"));
  const missing = await (await fetch(url)).json(); assert.equal(missing.session.intents[0].requirements[0].status, "UNPROVEN");
  assert.equal(missing.session.intents[0].requirements[0].receiptDiagnostics[0].receiptId, "contradiction");
});
