const NO_ACTION_PATTERN = /(?:not a problem|no (?:development )?(?:action|change) (?:is )?required|no development action is required)/iu;
const CHANGE_INTENT_PATTERN = /\b(?:move|moved|moving|rename|renamed|change|changed|remove|removed|add|added|replace|replaced|make|made|need|needs|want|wants|expect|expects|should|must|fix|update|simplif(?:y|ied)|show|hide)\b/iu;
const BOUNDED_MARKER = "[DSDD interpretation bounded for session persistence.]";

const STOP_WORDS = new Set([
  "about","after","again","against","also","and","are","because","been","before","being","but","can","could",
  "did","does","doing","down","each","everything","first","for","from","going","have","here","how","into","its",
  "just","like","more","most","not","now","okay","one","only","other","our","out","over","same","say","should",
  "some","than","that","the","their","them","then","there","these","they","thing","this","those","through","too",
  "under","very","want","was","were","what","when","where","which","while","who","will","with","would","yeah",
  "you","your","test","thank","talked","earlier","actually","ahead",
]);

function normalizedToken(value) {
  let token = String(value || "").toLowerCase().replace(/[^a-z0-9-]+/gu, "");
  if (token.length > 5 && token.endsWith("ies")) token = `${token.slice(0, -3)}y`;
  else if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) token = token.slice(0, -1);
  return token;
}

function meaningfulTokens(value) {
  return String(value || "")
    .match(/[a-z0-9][a-z0-9'-]*/giu)
    ?.map(normalizedToken)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)) || [];
}

function sentenceKeys(value) {
  return String(value || "")
    .split(/(?:[.!?]+\s*|\r?\n+)/u)
    .map((sentence) => meaningfulTokens(sentence).join(" "))
    .filter(Boolean);
}

function repetitionMetrics(value) {
  const tokens = meaningfulTokens(value);
  const sentences = sentenceKeys(value);
  const sentenceCounts = new Map();
  for (const sentence of sentences) sentenceCounts.set(sentence, (sentenceCounts.get(sentence) || 0) + 1);
  const maxSentenceCount = Math.max(0, ...sentenceCounts.values());
  const sentenceDominance = sentences.length ? maxSentenceCount / sentences.length : 0;

  const fourGrams = new Map();
  for (let index = 0; index <= tokens.length - 4; index += 1) {
    const gram = tokens.slice(index, index + 4).join(" ");
    fourGrams.set(gram, (fourGrams.get(gram) || 0) + 1);
  }
  const maxFourGramCount = Math.max(0, ...fourGrams.values());
  const uniqueTokenRatio = tokens.length ? new Set(tokens).size / tokens.length : 0;
  return { tokenCount: tokens.length, sentenceCount: sentences.length, maxSentenceCount, sentenceDominance, maxFourGramCount, uniqueTokenRatio };
}

function requestedChange(humanStatement) {
  const human = String(humanStatement || "");
  if (!CHANGE_INTENT_PATTERN.test(human)) return false;
  if (/\b(?:there is|there's|this is|it's|it is) not a problem\b/iu.test(human) && meaningfulTokens(human).length < 8) return false;
  return true;
}

function sharedAnchors(humanStatement, interpretation) {
  const human = [...new Set(meaningfulTokens(humanStatement))];
  const interpreted = new Set(meaningfulTokens(interpretation));
  return human.filter((token) => interpreted.has(token));
}

export function evaluateDsddInterpretationIntegrity({ humanStatement, interpretation }) {
  const human = String(humanStatement || "").trim();
  const meaning = String(interpretation || "").trim();
  const reasons = [];
  const repetition = repetitionMetrics(meaning);
  const anchors = sharedAnchors(human, meaning);
  const humanAnchorCount = new Set(meaningfulTokens(human)).size;
  const noAction = NO_ACTION_PATTERN.test(meaning);
  const changeRequested = requestedChange(human);

  if (!meaning || repetition.tokenCount < 3) reasons.push("interpretation-too-thin");
  if (
    (repetition.sentenceCount >= 3 && repetition.maxSentenceCount >= 3 && repetition.sentenceDominance >= 0.5)
    || (repetition.tokenCount >= 16 && repetition.maxFourGramCount >= 3)
    || (repetition.tokenCount >= 24 && repetition.uniqueTokenRatio < 0.3)
  ) reasons.push("pathological-repetition");
  if (noAction && changeRequested) reasons.push("no-action-conflicts-with-human-change-request");

  if (!noAction || changeRequested) {
    const requiredShared = humanAnchorCount >= 4 ? 2 : humanAnchorCount > 0 ? 1 : 0;
    if (anchors.length < requiredShared) reasons.push("human-meaning-anchors-missing");
  }

  return {
    state: reasons.length ? "invalid" : "valid",
    reasons: [...new Set(reasons)],
    metrics: {
      humanAnchorCount,
      sharedAnchorCount: anchors.length,
      tokenCount: repetition.tokenCount,
      uniqueTokenRatio: Number(repetition.uniqueTokenRatio.toFixed(3)),
      maxRepeatedSentenceCount: repetition.maxSentenceCount,
      maxRepeatedFourGramCount: repetition.maxFourGramCount,
      boundedOutput: meaning.includes(BOUNDED_MARKER),
      noAction,
      humanRequestedChange: changeRequested,
    },
  };
}

export function requirementTextsFromInterpretation(interpretation) {
  const value = String(interpretation || "").trim();
  const bullets = value.split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+\S/u.test(line))
    .map((line) => line.replace(/^[-*]\s+/u, "").trim());

  const candidates = bullets.length
    ? bullets
    : value.split(/(?:[.!?]+\s+|\r?\n+)/u).map((line) => line.trim()).filter(Boolean);

  const seen = new Set();
  const requirements = [];
  for (const candidate of candidates) {
    const bounded = candidate.replace(/\s+/gu, " ").trim().slice(0, 1200);
    const key = meaningfulTokens(bounded).join(" ");
    if (!bounded || key.length < 8 || seen.has(key)) continue;
    const repetition = repetitionMetrics(bounded);
    if (
      (repetition.tokenCount >= 12 && repetition.maxFourGramCount >= 3)
      || (repetition.tokenCount >= 20 && repetition.uniqueTokenRatio < 0.3)
    ) continue;
    seen.add(key);
    requirements.push(bounded);
    if (requirements.length >= 8) break;
  }
  return requirements;
}

export function validateDsddRequirements({ humanStatement, requirements }) {
  const values = Array.isArray(requirements) ? requirements.map((item) => String(item || "").trim()).filter(Boolean) : [];
  if (!values.length) return { state: "invalid", reasons: ["requirements-empty"] };
  const combined = values.join("\n");
  const integrity = evaluateDsddInterpretationIntegrity({ humanStatement, interpretation: combined });
  const reasons = integrity.reasons.filter((reason) => reason !== "no-action-conflicts-with-human-change-request");
  if (values.some((item) => item.length > 1200)) reasons.push("requirement-too-long");
  return { state: reasons.length ? "invalid" : "valid", reasons: [...new Set(reasons)] };
}

export function dsddNoActionInterpretation(value) {
  return NO_ACTION_PATTERN.test(String(value || ""));
}
