/**
 * Move within the current Write surface without reloading the document.
 * Never reads or mutates the project, its source evidence, or its profile.
 * Returning null means the Human rejected losing unsaved working text.
 */
export function moveWriteStoryPosition({ locationHref, history, blockNumber, miniBlockNumber, dirty, confirmDiscard }) {
  if (!Number.isInteger(blockNumber) || blockNumber < 1 || blockNumber > 24
    || !Number.isInteger(miniBlockNumber) || miniBlockNumber < 1 || miniBlockNumber > 4) {
    throw new RangeError("Write position must identify one of 24 Blocks and four Mini-Blocks.");
  }
  if (dirty && !confirmDiscard()) return null;
  const target = new URL(locationHref);
  target.searchParams.set("block", String(blockNumber));
  target.searchParams.set("mini", String(miniBlockNumber));
  // Preserve /skin-v1 (Matrix), /write (legacy), workspace, profile context,
  // other query parameters, fragment and existing navigation history entry.
  history.replaceState(history.state, "", `${target.pathname}${target.search}${target.hash}`);
  return { blockNumber, miniBlockNumber };
}
