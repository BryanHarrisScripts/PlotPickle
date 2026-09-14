import { createHash } from "node:crypto";

const API = "https://api.github.com";
const REPOSITORY_ID = /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/iu;

function headers(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${String(token || "").trim()}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "PlotPickle-OSS-Radar",
  };
}

function repositoryPath(fullName) {
  const value = String(fullName || "").trim();
  if (!REPOSITORY_ID.test(value)) throw new Error("OSS Radar enrichment requires a valid owner/repository identity.");
  return value.split("/").map(encodeURIComponent).join("/");
}

function sourceUrl(candidate, kind, path = "") {
  const repo = repositoryPath(candidate.fullName);
  const endpoint = kind === "readme"
    ? `${API}/repos/${repo}/readme`
    : `${API}/repos/${repo}/contents/${String(path).split("/").map(encodeURIComponent).join("/")}`;
  const url = new URL(endpoint);
  if (candidate.defaultBranch) url.searchParams.set("ref", candidate.defaultBranch);
  return url.toString();
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function normalizedText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function phrasePresent(text, phrase) {
  const haystack = ` ${normalizedText(text)} `;
  const needle = normalizedText(phrase);
  return Boolean(needle) && haystack.includes(` ${needle} `);
}

export function deriveEnrichmentEvidence(text, contract) {
  const concepts = [];
  const laneIds = new Set();
  const plotPickleTargets = new Set();
  for (const definition of contract?.enrichment?.evidenceConcepts || []) {
    const matchedPhrases = (definition.phrases || []).filter((phrase) => phrasePresent(text, phrase));
    if (!matchedPhrases.length) continue;
    concepts.push({
      id: definition.id,
      matchedPhrases: [...new Set(matchedPhrases)].sort((a, b) => a.localeCompare(b)),
    });
    for (const laneId of definition.laneIds || []) laneIds.add(laneId);
    for (const target of definition.plotPickleTargets || []) plotPickleTargets.add(target);
  }
  return {
    concepts: concepts.sort((left, right) => left.id.localeCompare(right.id)),
    laneIds: [...laneIds].sort((left, right) => left.localeCompare(right)),
    plotPickleTargets: [...plotPickleTargets].sort((left, right) => left.localeCompare(right)),
  };
}

function publicSource(result) {
  const { text: _text, ...evidence } = result;
  return evidence;
}

function decodeContent(payload, { path, maximumBytes }) {
  const declaredSize = Number(payload?.size);
  if (Number.isFinite(declaredSize) && declaredSize > maximumBytes) {
    return { status: "oversized", path, bytes: declaredSize, digest: "", reason: `content exceeds ${maximumBytes} byte limit`, text: "" };
  }
  if (payload?.encoding !== "base64" || typeof payload?.content !== "string") {
    return { status: "malformed", path, bytes: 0, digest: "", reason: "GitHub content response was not base64 text", text: "" };
  }
  try {
    const buffer = Buffer.from(payload.content.replace(/\s+/gu, ""), "base64");
    if (buffer.byteLength > maximumBytes) {
      return { status: "oversized", path, bytes: buffer.byteLength, digest: "", reason: `content exceeds ${maximumBytes} byte limit`, text: "" };
    }
    const text = buffer.toString("utf8");
    return { status: "success", path, bytes: buffer.byteLength, digest: digest(buffer), reason: "", text };
  } catch {
    return { status: "malformed", path, bytes: 0, digest: "", reason: "GitHub content could not be decoded", text: "" };
  }
}

async function responseMessage(response) {
  try {
    const payload = await response.json();
    return payload?.message ? String(payload.message) : "";
  } catch {
    return "";
  }
}

async function fetchContent(candidate, { kind, path, maximumBytes, token, fetchImpl }) {
  try {
    const response = await fetchImpl(sourceUrl(candidate, kind, path), {
      method: "GET",
      headers: headers(token),
    });
    if (response?.status === 404) {
      return { status: "missing", path, bytes: 0, digest: "", reason: "not found", text: "" };
    }
    if (!response?.ok) {
      const message = await responseMessage(response);
      return {
        status: "failed",
        path,
        bytes: 0,
        digest: "",
        reason: `HTTP ${response?.status ?? "unknown"}${message ? `: ${message}` : ""}`,
        text: "",
      };
    }
    try {
      return decodeContent(await response.json(), { path, maximumBytes });
    } catch {
      return { status: "malformed", path, bytes: 0, digest: "", reason: "GitHub content response was not valid JSON", text: "" };
    }
  } catch (error) {
    return {
      status: "failed",
      path,
      bytes: 0,
      digest: "",
      reason: `request failed: ${error instanceof Error ? error.message : String(error)}`,
      text: "",
    };
  }
}

function manifestPath(candidate, contract) {
  const map = contract?.enrichment?.manifestByLanguage || {};
  return map[String(candidate?.language || "")] || "";
}

function safeManifestEvidence(path, result) {
  if (result.status !== "success") return result;
  if (!/\.json$/iu.test(path)) return result;
  try {
    const payload = JSON.parse(result.text);
    const keywords = Array.isArray(payload?.keywords) ? payload.keywords : [];
    const dependencyNames = [
      ...Object.keys(payload?.dependencies || {}),
      ...Object.keys(payload?.devDependencies || {}),
      ...Object.keys(payload?.peerDependencies || {}),
    ];
    return {
      ...result,
      text: [
        payload?.name,
        payload?.description,
        ...keywords,
        ...dependencyNames,
      ].filter(Boolean).join(" "),
    };
  } catch {
    return { status: "malformed", path, bytes: result.bytes, digest: result.digest, reason: "package manifest JSON was malformed", text: "" };
  }
}

export async function enrichRepositoryCandidate(candidate, {
  contract,
  token,
  fetchImpl = globalThis.fetch,
} = {}) {
  const readmeLimit = Math.max(1, Number(contract?.enrichment?.readmeMaxBytes || 96000));
  const manifestLimit = Math.max(1, Number(contract?.enrichment?.manifestMaxBytes || 32000));
  const readme = await fetchContent(candidate, {
    kind: "readme",
    path: "README",
    maximumBytes: readmeLimit,
    token,
    fetchImpl,
  });
  const configuredManifest = manifestPath(candidate, contract);
  const manifest = configuredManifest
    ? safeManifestEvidence(configuredManifest, await fetchContent(candidate, {
      kind: "manifest",
      path: configuredManifest,
      maximumBytes: manifestLimit,
      token,
      fetchImpl,
    }))
    : { status: "not-configured", path: "", bytes: 0, digest: "", reason: "no primary manifest is configured for this language", text: "" };

  const evidenceText = [readme, manifest]
    .filter((source) => source.status === "success")
    .map((source) => source.text)
    .join("\n");
  const derived = deriveEnrichmentEvidence(evidenceText, contract);
  return {
    ...candidate,
    enrichment: {
      version: 1,
      attempted: true,
      evidenceAvailable: Boolean(evidenceText),
      trust: "untrusted-research-data",
      executionAuthority: false,
      readme: publicSource(readme),
      manifest: publicSource(manifest),
      evidenceConcepts: derived.concepts,
      evidenceLaneIds: derived.laneIds,
      plotPickleTargets: derived.plotPickleTargets,
    },
  };
}

export async function enrichRepositoryShortlist(candidates, {
  contract,
  token,
  fetchImpl = globalThis.fetch,
} = {}) {
  const enriched = [];
  for (const candidate of candidates || []) {
    enriched.push(await enrichRepositoryCandidate(candidate, { contract, token, fetchImpl }));
  }
  return enriched;
}
