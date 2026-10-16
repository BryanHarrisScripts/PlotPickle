/** Pure presentation-only splitting for a bounded local CMD preview. */
export function splitConnectionConfirmationPreview(
  text: string,
  connectionToolPreview: boolean,
): readonly Readonly<{ text: string; emphasis: boolean }>[];
