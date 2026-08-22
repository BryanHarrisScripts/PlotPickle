import path from "node:path";

export const CASEBOOK_ATTENDED_SCHEMA_VERSION = 1;
export const CASEBOOK_ATTENDED_MODE = "attended-real-machine";

const SECRET_TEXT_PATTERNS = [
  /\bnsec1[a-z0-9]{8,}\b/gi,
  /\b(?:sk|pk)-[A-Za-z0-9_-]{8,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi,
  /\b(?:password|passphrase|secret|token|cookie|authorization|api[_-]?key|private[_-]?key)\b\s*[:=]\s*[^\s,;]+/gi,
];

const CHECKPOINTS = Object.freeze({
  "profile-isolation:unlock-a": {
    title: "Human authentication required",
    instruction: "Unlock test Human A in the visible PlotPickle window. Do not paste credentials into this terminal. Press Enter here only after PlotPickle shows Human A as active.",
    secretEntry: true,
  },
  "profile-isolation:switch-b": {
    title: "Human authentication required",
    instruction: "Switch to and unlock test Human B in the visible PlotPickle window. Press Enter here only after PlotPickle shows Human B as active.",
    secretEntry: true,
  },
  "profile-isolation:restart-and-recheck": {
    title: "Human authentication may be required",
    instruction: "If PlotPickle asks you to unlock a Human after restart, complete that authentication in the visible app. Press Enter when the expected Human is active again.",
    secretEntry: true,
  },
  "buzz-connect-existing-identity:enter-existing-key": {
    title: "Private BUZZ identity required",
    instruction: "Paste the existing BUZZ private identity only into PlotPickle's masked Private identity key field. Do not paste it into this terminal. Leave the field on screen and press Enter here; Casebook will resume without reading or logging the secret value.",
    secretEntry: true,
  },
  "comfyui-local-image-visible:start-or-connect": {
    title: "Native approval may be required",
    instruction: "If Windows, ComfyUI Desktop, or UAC asks for approval, complete that native prompt yourself. Press Enter when the prompt is finished; Casebook will continue by observing the service state.",
    secretEntry: false,
  },
});

function expand(value, replacements) {
  let result = String(value ?? "");
  for (const [token, replacement] of Object.entries(replacements || {})) result = result.replaceAll(token, replacement);
  return result;
}

export function scrubAttendedText(value) {
  let safe = String(value ?? "");
  for (const pattern of SECRET_TEXT_PATTERNS) safe = safe.replace(pattern, "[REDACTED]");
  safe = safe
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, "[local-user]")
    .replace(/\/Users\/[^/\s]+/g, "/Users/[user]")
    .replace(/\/home\/[^/\s]+/g, "/home/[user]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return safe;
}

export function buildAttendedPlaywrightServer(server, { pluginRoot, pluginData, browser = "chrome" } = {}) {
  if (!server || server.type !== "stdio") throw new Error("Attended Casebook requires the existing Playwright MCP stdio server.");
  const replacements = {
    "${PLUGIN_ROOT}": path.resolve(pluginRoot || "."),
    "${PLUGIN_DATA}": path.resolve(pluginData || "."),
  };
  const expandedArgs = (server.args || []).map((value) => expand(value, replacements));
  const args = [];
  for (let index = 0; index < expandedArgs.length; index += 1) {
    const token = expandedArgs[index];
    if (token === "--headless") continue;
    if (token === "--browser") {
      args.push(token, browser);
      index += 1;
      continue;
    }
    args.push(token);
  }
  if (!args.includes("--browser")) args.push("--browser", browser);
  return {
    command: expand(server.command, replacements),
    args,
    cwd: expand(server.cwd || pluginRoot || ".", replacements),
    env: {
      ...Object.fromEntries(Object.entries(server.env || {}).map(([key, value]) => [key, expand(value, replacements)])),
      PLOTPICKLE_CASEBOOK_ATTENDED: "1",
    },
  };
}

export function attendedCheckpoint(caseId, stepId) {
  const raw = CHECKPOINTS[`${caseId}:${stepId}`];
  return raw ? Object.freeze({
    schemaVersion: CASEBOOK_ATTENDED_SCHEMA_VERSION,
    caseId,
    stepId,
    title: raw.title,
    instruction: raw.instruction,
    secretEntry: raw.secretEntry === true,
    evidencePolicy: raw.secretEntry === true ? "pause-sensitive-capture" : "normal-capture",
    resumePolicy: "operator-enter",
  }) : null;
}

export function buildAttendedOverlayScript({ caseIndex, caseCount, caseTitle, stepIndex, stepCount, stepAction, state = "working", detail = "" } = {}) {
  const payload = JSON.stringify({
    caseIndex: Number(caseIndex || 0),
    caseCount: Number(caseCount || 0),
    caseTitle: scrubAttendedText(caseTitle),
    stepIndex: Number(stepIndex || 0),
    stepCount: Number(stepCount || 0),
    stepAction: scrubAttendedText(stepAction),
    state: scrubAttendedText(state),
    detail: scrubAttendedText(detail),
  });
  return `() => {
    const value = ${payload};
    let panel = document.querySelector('[data-plotpickle-casebook-attended="true"]');
    if (!panel) {
      panel = document.createElement('aside');
      panel.setAttribute('data-plotpickle-casebook-attended', 'true');
      panel.setAttribute('aria-label', 'PlotPickle Casebook attended verification');
      Object.assign(panel.style, {
        position: 'fixed', right: '16px', bottom: '16px', width: '360px', maxWidth: 'calc(100vw - 32px)',
        zIndex: '2147483647', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,.22)',
        background: 'rgba(12,16,24,.94)', color: '#fff', font: '13px/1.45 system-ui, sans-serif', boxShadow: '0 14px 40px rgba(0,0,0,.35)',
        pointerEvents: 'none', whiteSpace: 'normal'
      });
      document.body.appendChild(panel);
    }
    panel.innerHTML = '';
    const eyebrow = document.createElement('div');
    eyebrow.textContent = 'CASEBOOK ATTENDED VERIFICATION';
    eyebrow.style.cssText = 'font-size:11px;letter-spacing:.09em;opacity:.72;margin-bottom:6px';
    const title = document.createElement('strong');
    title.textContent = 'Case ' + value.caseIndex + '/' + value.caseCount + ' · ' + value.caseTitle;
    title.style.cssText = 'display:block;font-size:14px;margin-bottom:5px';
    const step = document.createElement('div');
    step.textContent = 'Step ' + value.stepIndex + '/' + value.stepCount + ' · ' + value.stepAction;
    step.style.cssText = 'margin-bottom:6px';
    const status = document.createElement('div');
    status.textContent = value.state.toUpperCase() + (value.detail ? ' · ' + value.detail : '');
    status.style.cssText = 'font-size:12px;opacity:.82';
    panel.append(eyebrow, title, step, status);
    return JSON.stringify({ ok: true, state: value.state });
  }`;
}

export function buildHumanCheckpointOverlayScript(checkpoint) {
  const safe = JSON.stringify({
    title: scrubAttendedText(checkpoint?.title || "Human action required"),
    instruction: scrubAttendedText(checkpoint?.instruction || "Complete the requested action in PlotPickle and continue from the terminal."),
    secretEntry: checkpoint?.secretEntry === true,
  });
  return `() => {
    const value = ${safe};
    const panel = document.querySelector('[data-plotpickle-casebook-attended="true"]');
    if (!panel) return JSON.stringify({ ok: false });
    panel.innerHTML = '';
    const title = document.createElement('strong');
    title.textContent = value.title;
    title.style.cssText = 'display:block;font-size:15px;margin-bottom:8px';
    const text = document.createElement('div');
    text.textContent = value.instruction;
    const privacy = document.createElement('div');
    privacy.textContent = value.secretEntry ? 'Sensitive capture paused. Enter secrets only in PlotPickle.' : 'Casebook is waiting for your native approval.';
    privacy.style.cssText = 'margin-top:10px;font-size:11px;opacity:.75';
    panel.append(title, text, privacy);
    return JSON.stringify({ ok: true });
  }`;
}

export function attendedRecordSkeleton(caseDefinition) {
  return {
    schemaVersion: 1,
    caseId: caseDefinition.id,
    mode: "real-machine",
    attendedMode: CASEBOOK_ATTENDED_MODE,
    recordedAt: new Date().toISOString(),
    steps: [],
    faults: [],
    blockers: [],
    criticalInteractionsUnreached: 0,
    independentVerification: {
      id: `${caseDefinition.id}-attended-independent-proof-pending`,
      kind: "evaluation",
      status: "unverified",
      source: caseDefinition.independentVerification.source,
      independent: true,
      summary: "Attended run has not yet supplied independent outcome proof.",
    },
  };
}

export function assertAttendedRecordSafe(record) {
  const serialized = JSON.stringify(record || {});
  if (/\bnsec1[a-z0-9]{8,}\b/i.test(serialized)) throw new Error("Attended Casebook record contains an unredacted BUZZ private key.");
  if (/\b(?:sk|pk)-[A-Za-z0-9_-]{8,}\b/.test(serialized)) throw new Error("Attended Casebook record contains an unredacted provider key.");
  if (/"(?:reasoning|chainOfThought|chain_of_thought|scratchpad|prompt|messages)"\s*:/i.test(serialized)) throw new Error("Attended Casebook record contains hidden reasoning or prompt material.");
  return true;
}
