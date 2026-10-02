import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { createInMemoryAuthStateStore, createPlotPickleAuthService } from "../../../core/auth/plotpickle-auth-core.mjs";
import { createProfilePrivateStorageService } from "../../../core/storage/profile-private/profile-private-storage-core.mjs";

// Actual configured Mastra code, with a bounded synthetic provider. No real writer
// data, credentials, cloud service, or user-selected provider participates here.
const outputRoot = path.resolve(".artifacts/story-architect-2711");
await mkdir(outputRoot, { recursive: true });
const temporary = await mkdtemp(path.join(outputRoot, "fixture-"));
let server;
let requests = 0;
let lastRequest;
let delayed = false;
let omitUsage = false;
let auth;
let privateStorage;
const assessment = {
  structural: { state: "unresolved", reason: "Synthetic supplied material cannot establish a causal structural turn.", passageIds: [] },
  characters: [],
  miniBlocks: [1, 2, 3, 4].map((ordinal) => ({ ordinal, state: "unsupported", reason: "No synthetic screenplay or saved script was supplied for this Mini-Block.", passageIds: [], storyboardCue: "" })),
};
try {
  const entry = path.join(temporary, "entry.ts");
  await writeFile(entry, [
    `export { askPlotPickleAgent } from ${JSON.stringify(path.resolve("build/mastra-agent-runtime.ts"))};`,
    `export { normalizeLibraryProject } from ${JSON.stringify(path.resolve("core/storage/library-project.ts"))};`,
    `export { buildOutlineAgentAssessmentRequest, validateOutlineAgentAssessment } from ${JSON.stringify(path.resolve("modules/plan/outline-agent-assessment.ts"))};`,
  ].join("\n"));
  const compiled = path.join(temporary, "worker.mjs");
  await build({ entryPoints: [entry], outfile: compiled, bundle: true, platform: "node", format: "esm", packages: "external", logLevel: "silent" });
  const worker = await import(pathToFileURL(compiled).href);
  server = createServer(async (request, response) => {
    requests += 1;
    try {
      assert.equal(request.method, "POST");
      assert.equal(request.url, "/v1/chat/completions");
      let body = "";
      for await (const chunk of request) { body += chunk; assert.ok(body.length < 96 * 1024); }
      lastRequest = JSON.parse(body);
      assert.equal(lastRequest.model, "synthetic-story-architect");
      assert.notEqual(lastRequest.stream, true);
      if (delayed) return; // Cancellation must end this request before any assessment exists.
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ id: "synthetic-completion", object: "chat.completion", created: 1, model: lastRequest.model, choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(assessment) }, finish_reason: "stop" }], ...(omitUsage ? {} : { usage: { prompt_tokens: 37, completion_tokens: 53, total_tokens: 90 } }) }));
    } catch (error) { response.writeHead(500); response.end(error.message); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const profile = { provider: "local", runtime: "local", baseUrl: `http://127.0.0.1:${server.address().port}`, textModel: "synthetic-story-architect", apiKey: "", contextTokens: 16384 };
  const project = worker.normalizeLibraryProject({ id: "synthetic-proof-2711", title: "Synthetic Outline" });
  const payload = worker.buildOutlineAgentAssessmentRequest(project, 1);
  let usage;
  const output = await worker.askPlotPickleAgent({ profile, ...payload, onAssessmentUsage: async (value) => { usage = value; } });
  const validated = worker.validateOutlineAgentAssessment(output, project, 1, "synthetic fixture", new Date().toISOString());
  assert.equal(validated.blockNumber, 1);
  assert.equal(validated.structural.state, "unresolved");
  assert.equal(validated.miniBlocks.length, 4);
  assert.deepEqual(usage, { inputTokens: 37, outputTokens: 53, totalTokens: 90 });
  assert.ok(JSON.stringify(lastRequest.messages).includes("Assess this ONE Outline Block"));
  assert.equal(lastRequest.response_format?.type, "json_schema");
  assert.equal(lastRequest.max_tokens ?? lastRequest.max_completion_tokens, 1800);

  const cancelled = new AbortController(); cancelled.abort(new Error("Synthetic writer cancellation"));
  const beforeCancelled = requests;
  await assert.rejects(worker.askPlotPickleAgent({ profile, ...payload, signal: cancelled.signal }), /Synthetic writer cancellation/);
  assert.equal(requests, beforeCancelled, "Pre-cancelled work must issue no provider request.");

  await assert.rejects(worker.askPlotPickleAgent({ profile, ...payload, onAssessmentUsage: async () => { throw new Error("Synthetic accounting persistence failed"); } }), /Synthetic accounting persistence failed/);

  omitUsage = true;
  let missingUsage;
  await worker.askPlotPickleAgent({ profile, ...payload, onAssessmentUsage: (value) => { missingUsage = value; } });
  assert.deepEqual(missingUsage, { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined }, "Missing provider usage must not be represented as zero-cost work.");
  omitUsage = false;

  delayed = true;
  const controller = new AbortController();
  const pending = worker.askPlotPickleAgent({ profile, ...payload, signal: controller.signal });
  const deadline = Date.now() + 5000;
  while (requests < 4 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(requests, 4);
  controller.abort(new Error("Synthetic in-flight cancellation"));
  await assert.rejects(pending, /abort|cancel/i);

  // Test the existing protected artifact owner with the actual validated result.
  // This proves artifact persistence, separately from an application task controller.
  const stateStore = createInMemoryAuthStateStore();
  const authOptions = { nodeId: "node-synthetic-outline-2711", accessMode: "desktop-loopback", stateStore };
  auth = await createPlotPickleAuthService(authOptions);
  const password = "Synthetic fixture profile passphrase 2711";
  const owner = await auth.createFirstProfile({ displayName: "Synthetic owner", password });
  privateStorage = createProfilePrivateStorageService({ root: path.join(temporary, "private"), authService: auth, normalizeProject: worker.normalizeLibraryProject });
  await privateStorage.saveProject(owner.authContext, { project, activate: true });
  const artifact = { ref: "responsibility-artifact:fixture-2711", canonical: false, assessment: validated, usage };
  const address = { domain: "projects", objectId: "outline-fixture-artifact-2711" };
  await privateStorage.writePrivateJson(owner.authContext, { ...address, value: artifact });
  const other = await auth.createProfile({ displayName: "Synthetic other", password }, owner.authContext);
  assert.equal(await privateStorage.readPrivateJson(other.authContext, address), null, "Another profile cannot see the owner's proposal.");
  async function assertEncrypted(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await assertEncrypted(file);
      else assert.ok(!(await readFile(file, "utf8")).includes(validated.structural.reason), "The assessment must not appear as plaintext in private files.");
    }
  }
  await assertEncrypted(path.join(temporary, "private"));
  auth.lock(owner.authContext);
  await assert.rejects(privateStorage.readPrivateJson(owner.authContext, address));
  privateStorage.close(); auth.close();
  auth = await createPlotPickleAuthService(authOptions);
  privateStorage = createProfilePrivateStorageService({ root: path.join(temporary, "private"), authService: auth, normalizeProject: worker.normalizeLibraryProject });
  const reopened = await auth.authenticate({ profileId: owner.profile.profileId, password });
  assert.deepEqual(await privateStorage.readPrivateJson(reopened.authContext, address), artifact);
  assert.equal((await privateStorage.loadProject(reopened.authContext, project.id)).id, project.id);

  const report = { issue: 2711, status: "PASS", sourceHead: process.env.PLOTPICKLE_PROOF_SOURCE_HEAD || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), platform: process.platform, actualMastraExecution: "PASS", providerEvidence: "synthetic-loopback-fixture", structuredAssessmentValidated: true, usageReported: usage, missingUsageRemainsUnknown: true, preCancelledRequests: 0, inFlightCancellationDenied: true, accountingFailureRejected: true, protectedArtifactReopen: "PASS", crossProfileArtifactHidden: true, lockedProfileReadDenied: true, fixtureRequests: requests, realUserProvider: "UNPROVEN", protectedTaskRecovery: "UNPROVEN", productResume: "UNPROVEN" };
  await writeFile(path.join(outputRoot, "proof.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
} finally {
  privateStorage?.close();
  auth?.close();
  server?.closeAllConnections();
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
