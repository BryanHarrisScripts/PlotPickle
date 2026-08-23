import { delay, extractPageState, resultText } from "./mcp-runtime.mjs";

export const PLOTPICKLE_MOUNT_GATE = "Opening PlotPickle…";

export function renderedAreaIsReady(area, state = {}) {
  const bodyText = String(state.bodyText || "").replace(/\s+/g, " ").trim();
  const bodyLength = Number(state.bodyLength || bodyText.length);
  if (!bodyText || bodyText === PLOTPICKLE_MOUNT_GATE) return false;
  if (bodyLength < Number(area?.minimumTextLength || 0)) return false;
  const normalized = bodyText.toLowerCase();
  return (area?.requiredTerms || []).every((term) => normalized.includes(String(term).toLowerCase()));
}

export async function readRenderedAreaState(client) {
  const stateResult = await client.call("browser_evaluate", {
    function: "() => ({ url: location.href, bodyText: (document.body.innerText || '').replace(/\\s+/g, ' ').trim(), bodyLength: (document.body.innerText || '').trim().length })",
  });
  return extractPageState(resultText(stateResult));
}

export async function waitForRenderedArea(client, area, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 12_000);
  const pollMs = Number(options.pollMs || 250);
  const deadline = Date.now() + timeoutMs;
  let state = await readRenderedAreaState(client);

  while (!renderedAreaIsReady(area, state) && Date.now() < deadline) {
    await delay(pollMs);
    state = await readRenderedAreaState(client);
  }

  return state;
}
