const SAGE_FORBIDDEN = [
  /that local reply didn.t come through cleanly/i,
  /ask me again and i.ll keep it short and direct/i,
  /local curriculum block/i,
  /curriculum_context/i,
  /conversation_memory/i,
  /response quality retry/i,
  /system prompt/i,
  /hidden reasoning/i,
];

const COMMON_WORDS = new Set([
  "about", "after", "again", "also", "because", "being", "from", "have", "into", "lesson", "main", "more", "that", "their", "there", "these", "this", "what", "when", "where", "which", "with", "would", "your",
]);

function casebookVerifierText(value) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200);
}

function words(value) {
  return casebookVerifierText(value).toLowerCase().match(/[a-z0-9]+/g) || [];
}

function distinctiveWords(value) {
  return [...new Set(words(value).filter((word) => word.length >= 4 && !COMMON_WORDS.has(word)))];
}

function verifiedArtifact({ id, source, summary, metadata = {} }) {
  return { id, kind: "evaluation", status: "verified", source, independent: true, summary: casebookVerifierText(summary), metadata };
}

function contradictedArtifact({ id, source, summary, metadata = {} }) {
  return { id, kind: "evaluation", status: "contradicted", source, independent: true, summary: casebookVerifierText(summary), metadata };
}

export function evaluateSageVisibleAnswer({ question, answer, lessonTitle, relatedLessonLabels = [], routeStatus = {} } = {}) {
  const source = "sage-response-evaluator";
  const cleanQuestion = casebookVerifierText(question);
  const cleanAnswer = casebookVerifierText(answer);
  const cleanTitle = casebookVerifierText(lessonTitle);
  const selected = routeStatus?.text?.selected || routeStatus?.choice?.text || "";
  const ollama = routeStatus?.text?.options?.ollama || {};
  const reasons = [];

  if (selected !== "ollama") reasons.push(`selected text route is ${selected || "unknown"}, not ollama`);
  if (ollama.ready !== true) reasons.push("Ollama text route is not ready");
  if (cleanAnswer.length < 20) reasons.push("Human-visible answer is too short to evaluate as useful");
  if (SAGE_FORBIDDEN.some((pattern) => pattern.test(cleanAnswer))) reasons.push("Human-visible answer contains a known internal/vague fallback marker");
  if (cleanAnswer && cleanQuestion && cleanAnswer.toLowerCase() === cleanQuestion.toLowerCase()) reasons.push("answer only repeats the Human question");

  const groundingTerms = distinctiveWords(`${cleanTitle} ${cleanQuestion}`);
  const answerWords = new Set(words(cleanAnswer));
  const lexicalGrounding = groundingTerms.filter((term) => answerWords.has(term));
  const sourceGrounding = relatedLessonLabels.some((label) => {
    const folded = casebookVerifierText(label).toLowerCase();
    return cleanTitle && (folded.includes(cleanTitle.toLowerCase()) || cleanTitle.toLowerCase().includes(folded));
  });
  if (!sourceGrounding && lexicalGrounding.length === 0) reasons.push("answer has no independently visible lesson/source grounding signal");

  const metadata = {
    selectedRoute: selected,
    model: casebookVerifierText(ollama.model || "").slice(0, 240),
    answerLength: cleanAnswer.length,
    lessonTitle: cleanTitle,
    lexicalGrounding: lexicalGrounding.slice(0, 8),
    sourceGrounding,
  };
  return reasons.length
    ? contradictedArtifact({ id: "sage-human-visible-answer", source, summary: `Sage outcome did not meet the Business Case: ${reasons.join("; ")}.`, metadata })
    : verifiedArtifact({ id: "sage-human-visible-answer", source, summary: "The Human-visible Sage answer is non-fallback, lesson-grounded, and came through the ready Ollama route.", metadata });
}

function localAssetUrl(value, baseUrl) {
  const url = new URL(String(value || ""), baseUrl);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (!["127.0.0.1", "localhost", "::1"].includes(hostname)) throw new Error(`Generated asset is not local (${hostname || "unknown host"}).`);
  return url;
}

export async function verifyLocalImageAsset({ baseUrl, imageSrc, fetchImpl = fetch } = {}) {
  if (!casebookVerifierText(imageSrc)) return { ok: false, assetUrl: "", assetBytes: 0, contentType: "", error: "No Human-visible generated image is present." };
  try {
    const url = localAssetUrl(imageSrc, baseUrl);
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
    const contentType = response.headers?.get?.("content-type") || "";
    if (!response.ok) return { ok: false, assetUrl: url.toString(), assetBytes: 0, contentType, error: `Generated asset read-back returned HTTP ${response.status}.` };
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1_000) return { ok: false, assetUrl: url.toString(), assetBytes: bytes.length, contentType, error: `Generated asset is unexpectedly small (${bytes.length} bytes).` };
    if (contentType && !contentType.toLowerCase().startsWith("image/")) return { ok: false, assetUrl: url.toString(), assetBytes: bytes.length, contentType, error: `Generated asset content type is ${contentType}, not image/*.` };
    return { ok: true, assetUrl: url.toString(), assetBytes: bytes.length, contentType, error: "" };
  } catch (error) {
    return { ok: false, assetUrl: "", assetBytes: 0, contentType: "", error: error instanceof Error ? error.message : String(error) };
  }
}

export async function verifyComfyUiVisibleOutput({ baseUrl, imageSrc, mediaStatus = {}, aiStatus = {}, fetchImpl = fetch } = {}) {
  const source = "comfyui-output-observer";
  const reasons = [];
  const comfy = mediaStatus?.comfyui || {};
  const combinedRoute = aiStatus?.image?.options?.["ollama-comfyui"] || {};
  if (comfy.reachable !== true) reasons.push("ComfyUI service is not reachable");
  if (comfy.imageNodesReady !== true) reasons.push("required ComfyUI image nodes are not ready");
  if (!casebookVerifierText(comfy.checkpoint || comfy.selectedCheckpoint)) reasons.push("no verified ComfyUI checkpoint is selected");
  if (!casebookVerifierText(comfy.imageVerifiedAt)) reasons.push("PlotPickle has no successful ComfyUI image verification timestamp");
  if (combinedRoute.ready !== true) reasons.push("Ollama + ComfyUI local route is not ready/selectable");

  const asset = await verifyLocalImageAsset({ baseUrl, imageSrc, fetchImpl });
  if (!asset.ok) reasons.push(asset.error);

  const metadata = {
    assetUrl: asset.assetUrl,
    assetBytes: asset.assetBytes,
    contentType: asset.contentType,
    comfyVersion: casebookVerifierText(comfy.version || "").slice(0, 120),
    checkpoint: casebookVerifierText(comfy.checkpoint || comfy.selectedCheckpoint || "").slice(0, 260),
    imageVerifiedAt: casebookVerifierText(comfy.imageVerifiedAt || "").slice(0, 120),
    combinedRouteReady: combinedRoute.ready === true,
    combinedRouteModel: casebookVerifierText(combinedRoute.model || "").slice(0, 260),
  };
  return reasons.length
    ? contradictedArtifact({ id: "comfyui-human-visible-output", source, summary: `ComfyUI outcome did not meet the Business Case: ${reasons.join("; ")}.`, metadata })
    : verifiedArtifact({ id: "comfyui-human-visible-output", source, summary: "A real local ComfyUI image was independently read back, is visibly rendered in PlotPickle, and the Ollama + ComfyUI route is ready.", metadata });
}

export function evaluateComfyUiWrongPortFault(diagnostic = {}) {
  const reachable = diagnostic?.comfyui?.reachable === true;
  const message = casebookVerifierText(diagnostic?.comfyui?.error || diagnostic?.message || "");
  return reachable
    ? { outcome: "pass", observed: "Injected wrong-port diagnostic was incorrectly reported reachable; fault was not detected." }
    : { outcome: "blocked", observed: `Injected wrong-port diagnostic was detected as unavailable${message ? `: ${message}` : "."}` };
}

export function evaluateSageFallbackFault(answer) {
  const text = casebookVerifierText(answer);
  const rejected = SAGE_FORBIDDEN.some((pattern) => pattern.test(text)) || text.length < 20;
  return rejected
    ? { outcome: "fail", observed: "Injected unusable/vague Sage response was rejected by the independent Human-response evaluator." }
    : { outcome: "pass", observed: "Injected unusable Sage response was not detected by the independent evaluator." };
}
