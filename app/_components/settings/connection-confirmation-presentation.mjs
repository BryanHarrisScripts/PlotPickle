/**
 * Present, never execute, a one-time connection preview confirmation.
 * Dynamic session tokens stay in the local transcript only, not in source or logs.
 */
const CONFIRMATION = /\bPlotPickle connections confirm [a-f0-9]{16}(?: (?:charges|share|performance)){0,3}\b/giu;

/**
 * Only a host-authored Connection Preview may highlight an action.
 * A user's typed command, a story passage, a past error, or ordinary DSDD
 * narration must remain plain text.
 *
 * @param {string} text
 * @param {boolean} connectionToolPreview
 * @returns {ReadonlyArray<Readonly<{ text: string, emphasis: boolean }>>}
 */
export function splitConnectionConfirmationPreview(text, connectionToolPreview) {
  const value = String(text || "");
  if (!connectionToolPreview || !value.startsWith("CONNECTION PREVIEW - ")) {
    return Object.freeze([{ text: value, emphasis: false }]);
  }
  const sections = [];
  let offset = 0;
  for (const match of value.matchAll(CONFIRMATION)) {
    const index = match.index;
    if (index > offset) sections.push({ text: value.slice(offset, index), emphasis: false });
    sections.push({ text: match[0], emphasis: true });
    offset = index + match[0].length;
  }
  if (offset < value.length || !sections.length) sections.push({ text: value.slice(offset), emphasis: false });
  return Object.freeze(sections.map(section => Object.freeze(section)));
}
