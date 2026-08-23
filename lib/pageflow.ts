export type PageFlowScan = {
  words: number;
  paragraphs: number;
  averageSentence: number;
  invisible: string[];
  directing: string[];
  weak: string[];
  emotions: string[];
  longParagraphs: number;
  signal: number;
};

const invisibleTerms = [
  "thinks",
  "feels",
  "knows",
  "realizes",
  "remembers",
  "decides",
  "believes",
  "understands",
  "wants",
  "because",
];

const directingTerms = [
  "camera",
  "close-up",
  "close up",
  "wide shot",
  "angle on",
  "pan",
  "tilt",
  "zoom",
  "cut to",
  "we see",
  "we hear",
];

const weakPhrases = ["starts to", "begins to", "seems to", "appears to", "tries to"];
const emotionLabels = ["angry", "sad", "nervous", "afraid", "happy", "upset", "confused", "frustrated", "excited", "anxious"];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phrasePattern(phrase: string) {
  const escaped = escapeRegExp(phrase).replace(/\\ /g, "\\s+");
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, "iu");
}

function uniqueMatches(text: string, terms: string[]) {
  return terms.filter((term) => phrasePattern(term).test(text));
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function actionOnlyText(text: string) {
  const lines = text.split(/\r?\n/);
  return lines
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      const isCharacterCue = /^[A-Z][A-Z0-9 .()'’-]{1,40}$/.test(trimmed);
      const isDialogue = /^\s{2,}\S/.test(line);
      return !isCharacterCue && !isDialogue;
    })
    .join("\n");
}

export function scanPageFlowDraft(text: string): PageFlowScan {
  const actionText = actionOnlyText(text);
  const paragraphs = actionText
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const sentences = actionText
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const words = wordCount(actionText);
  const invisible = uniqueMatches(actionText, invisibleTerms);
  const directing = uniqueMatches(actionText, directingTerms);
  const weak = uniqueMatches(actionText, weakPhrases);
  const emotions = uniqueMatches(actionText, emotionLabels);
  const longParagraphs = paragraphs.filter((paragraph) => wordCount(paragraph) > 55).length;
  const averageSentence = sentences.length ? Math.round(words / sentences.length) : 0;
  const deductions = invisible.length * 7 + directing.length * 5 + weak.length * 5 + emotions.length * 4 + longParagraphs * 8;

  return {
    words,
    paragraphs: paragraphs.length,
    averageSentence,
    invisible,
    directing,
    weak,
    emotions,
    longParagraphs,
    signal: Math.max(0, Math.min(100, 100 - deductions)),
  };
}
