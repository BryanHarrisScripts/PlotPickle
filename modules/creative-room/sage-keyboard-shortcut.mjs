/**
 * #2959 / PP-SAGE-KEY-001
 * Pure decision boundary for the global Sage keyboard shortcut.
 * Missing, non-string or unsupported keys never open Sage or throw.
 * Only Shift+S (any string case accepted by the legacy handler) without
 * Ctrl, Meta or Alt may proceed to the existing editing/overlay gates.
 */
export function isSageOpenShortcut(event) {
  // Synthetic browser and automation events can have arbitrary property
  // accessors. A malformed event cannot become shortcut authority or throw
  // before the global listener reaches its normal editing/overlay guards.
  try {
    if (!event || event.defaultPrevented || event.repeat) return false;
    const key = event.key;
    if (typeof key !== "string" || key.toLowerCase() !== "s") return false;
    return event.shiftKey === true && !event.ctrlKey && !event.metaKey && !event.altKey;
  } catch {
    return false;
  }
}
