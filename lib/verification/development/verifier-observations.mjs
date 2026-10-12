import { createHash, createPublicKey, verify } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/u;
const SHA = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const present = (value) => typeof value === "string" && value.trim().length > 0;
const stable = (value) => value && typeof value === "object" && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const same = (left, right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));

// Host trust configuration only. Never populate this from an HTTP request or stored claim.
export function verifierObservationAuthority(env = process.env) {
  return {
    root: env.PLOTPICKLE_OBSERVATION_RECEIPT_ROOT || "",
    publicKey: env.PLOTPICKLE_OBSERVATION_PUBLIC_KEY || "",
    source: env.PLOTPICKLE_OBSERVATION_VERIFIER || "",
    environment: env.PLOTPICKLE_OBSERVATION_ENVIRONMENT || "",
    configuration: env.PLOTPICKLE_OBSERVATION_CONFIGURATION || "",
  };
}

async function localFile(root, relative, maximum) {
  if (!present(relative) || relative.includes("\\") || path.posix.isAbsolute(relative) ||
      relative.split("/").some((part) => !part || part === "." || part === "..") || /[:\u0000-\u001f]/u.test(relative)) {
    throw new Error("unsafe-artifact-path");
  }
  const actual = await realpath(path.join(root, relative));
  if (!actual.startsWith(`${root}${path.sep}`)) throw new Error("artifact-outside-root");
  const info = await stat(actual);
  if (!info.isFile() || info.size > maximum) throw new Error("invalid-artifact-size");
  const bytes = await readFile(actual);
  if (bytes.length > maximum) throw new Error("invalid-artifact-size");
  return bytes;
}

// Receipts authenticate actual record contents, not arbitrary records sharing the same ref.
export async function readVerifierObservations({ authority, subject, testedCommit, receiptIds = [], receiptDigests = {}, now = Date.now() }) {
  const observations = [], diagnostics = [];
  const reject = (id, reason) => diagnostics.push({ receiptId: id, reason });
  if (!Array.isArray(receiptIds) || receiptIds.length > 128 || receiptIds.some((id) => typeof id !== "string" || !ID.test(id))) {
    return { observations, verifiedArtifactRefs: [], diagnostics: [{ receiptId: "", reason: "invalid-receipt-identities" }] };
  }
  if (!receiptIds.length) return { observations, verifiedArtifactRefs: [], diagnostics };
  const validSubject = subject?.kind === "dsdd"
    ? [subject.profileId, subject.sessionId, subject.requirementId, subject.promise].every(present) &&
      Number.isInteger(subject.intentVersion) && subject.intentVersion > 0 && SHA.test(subject.intentDigest || "")
    : subject?.kind === "casebook" && [subject.caseId, subject.runId].every(present);
  if (!validSubject) return { observations, verifiedArtifactRefs: [], diagnostics: [{ receiptId: "", reason: "invalid-observation-subject" }] };
  let root, key;
  try {
    if (![authority?.root, authority?.publicKey, authority?.source, authority?.environment, authority?.configuration].every(present)) throw new Error();
    root = await realpath(authority.root);
    key = createPublicKey(authority.publicKey);
    if (key.asymmetricKeyType !== "ed25519" || !COMMIT.test(testedCommit || "") || !Number.isFinite(now)) throw new Error();
  } catch {
    return { observations, verifiedArtifactRefs: [], diagnostics: [{ receiptId: "", reason: "verifier-authority-unavailable" }] };
  }
  for (const id of new Set(receiptIds)) {
    try {
      const envelope = JSON.parse((await localFile(root, `${id}.json`, 128 * 1024)).toString("utf8"));
      if (envelope.schemaVersion !== 1 || !present(envelope.payload) || !present(envelope.signature)) throw new Error("invalid-receipt-envelope");
      const bytes = Buffer.from(envelope.payload, "base64");
      if (!verify(null, bytes, key, Buffer.from(envelope.signature, "base64"))) throw new Error("invalid-verifier-signature");
      const receiptDigest = createHash("sha256").update(bytes).digest("hex");
      if (Object.hasOwn(receiptDigests, id) && receiptDigests[id] !== receiptDigest) throw new Error("receipt-replaced");
      const payload = JSON.parse(bytes.toString("utf8"));
      const record = payload.observation;
      if (payload.schemaVersion !== 1 || payload.receiptId !== id || !same(payload.subject, subject)) throw new Error("receipt-subject-mismatch");
      const observedAt = Date.parse(payload.observedAt), expiresAt = Date.parse(payload.expiresAt);
      if (!Number.isFinite(observedAt) || !Number.isFinite(expiresAt) || observedAt > now || expiresAt <= now || expiresAt <= observedAt) throw new Error("receipt-expired-or-invalid-time");
      if (record?.source !== authority.source || record?.testedCommit !== testedCommit ||
          record?.environment !== authority.environment || record?.configuration !== authority.configuration) throw new Error("observation-identity-mismatch");
      if (record?.independent !== true || record?.simulated !== false || record?.scope !== "real-product-observation") throw new Error("observation-scope-insufficient");
      if (!["supports", "contradicts", "blocked"].includes(record.finding) ||
          ![record.action, record.observedResult, record.promise, record.contractId, record.contractVersion, record.obligationId].every(present) ||
          (record.finding === "blocked" && !present(record.blocker))) throw new Error("incomplete-observation");
      if (!SHA.test(payload.artifact?.sha256 || "")) throw new Error("invalid-artifact-digest");
      const artifact = await localFile(root, payload.artifact.path, 64 * 1024 * 1024);
      if (createHash("sha256").update(artifact).digest("hex") !== payload.artifact.sha256) throw new Error("artifact-digest-mismatch");
      // A ref is derived from the signed artifact identity, never supplied by public intake.
      observations.push({ ...record, receiptId: id, receiptDigest, ref: `verifier:${id}:sha256:${payload.artifact.sha256}` });
    } catch (error) {
      const known = new Set(["unsafe-artifact-path", "artifact-outside-root", "invalid-artifact-size", "invalid-receipt-envelope",
        "invalid-verifier-signature", "receipt-subject-mismatch", "receipt-expired-or-invalid-time", "observation-identity-mismatch",
        "observation-scope-insufficient", "incomplete-observation", "invalid-artifact-digest", "artifact-digest-mismatch", "receipt-replaced"]);
      reject(id, known.has(error.message) ? error.message : "receipt-or-artifact-unavailable");
    }
  }
  return { observations, verifiedArtifactRefs: observations.map((record) => record.ref), diagnostics };
}
