import { extractPageState, resultText } from "./mcp-runtime.mjs";
import {
  createPhase3b3StepDrivers as createCorePhase3b3StepDrivers,
  finalizePhase3b3Proof,
  runPhase3b3Faults,
  verifyGreatHallEvidence,
} from "./casebook-phase3b3-live-core.mjs";

export { finalizePhase3b3Proof, runPhase3b3Faults, verifyGreatHallEvidence };

const clean = (value, limit = 900) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);

function stepResult(passed, observed, interaction, target, extra = {}) {
  return { outcome: passed ? "pass" : "fail", workerClaim: passed ? "pass" : "fail", observed: clean(observed), interaction, target: clean(target), ...extra };
}

async function browserValue(client, functionSource, label) {
  const raw = resultText(await client.call("browser_evaluate", { function: functionSource }));
  if (!String(raw || "").trim()) throw new Error(`${label} returned no browser observation.`);
  const parsed = extractPageState(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${label} did not return a structured browser observation.`);
  return parsed;
}

async function waitFor(operation, predicate, attempts = 16, delayMs = 500) {
  let value = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    value = await operation();
    if (predicate(value)) return value;
    if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return value;
}

async function openProfileIdentitySurface(client) {
  return browserValue(client, `() => {
    const overlay = document.querySelector('[aria-label="PlotPickle Profile"]');
    const details = overlay?.querySelector('details');
    const summary = details?.querySelector('summary');
    if (!overlay || !details || !summary) return JSON.stringify({ found: false, opened: false, buzzVisible: false });
    if (!details.open) summary.click();
    const surface = overlay.querySelector('[data-profile-identity-surface="v1"]');
    return JSON.stringify({
      found: true,
      opened: details.open,
      buzzVisible: Boolean(surface) && /BUZZ Identity/i.test(surface?.textContent || ''),
    });
  }`, "PlotPickle Profile identity surface");
}

async function humanSessionState(client) {
  return browserValue(client, `async () => {
    const active = document.querySelector('[aria-label="Active PlotPickle Human"]');
    let response;
    let body = {};
    try {
      response = await fetch('/api/auth/profile', { credentials: 'same-origin', cache: 'no-store' });
      const text = await response.text();
      try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    } catch {
      return JSON.stringify({ authenticated: false, profileId: '', displayName: '', domActive: Boolean(active), status: 0 });
    }
    const profile = body && typeof body === 'object' && body.profile && typeof body.profile === 'object' ? body.profile : null;
    return JSON.stringify({
      authenticated: response.ok && body.authenticated === true && Boolean(profile?.profileId),
      profileId: typeof profile?.profileId === 'string' ? profile.profileId : '',
      displayName: typeof profile?.displayName === 'string' ? profile.displayName : (active?.querySelector('strong')?.textContent || '').trim(),
      domActive: Boolean(active),
      status: response.status,
    });
  }`, "PlotPickle authenticated Human session");
}

function visibleHumanCheckpoint() {
  return {
    schemaVersion: 1,
    caseId: "buzz-connect-existing-identity",
    stepId: "open-profile-buzz",
    title: "Unlock your PlotPickle Human",
    instruction: "In the visible Casebook browser, select and unlock the PlotPickle Human you want to test. Enter the passphrase only in PlotPickle. Casebook will wait with no time limit; return to this terminal and press Enter only after PlotPickle shows that Human as active.",
    secretEntry: true,
    evidencePolicy: "pause-sensitive-capture",
    resumePolicy: "operator-enter",
  };
}

async function observeAuthenticatedProfileSurface(client, human) {
  const state = await waitFor(
    () => openProfileIdentitySurface(client),
    (value) => value?.buzzVisible === true,
    24,
    250,
  );
  const displayName = clean(human?.displayName || "the selected Human", 120);
  return stepResult(
    state?.buzzVisible === true,
    state?.buzzVisible === true
      ? `The authenticated PlotPickle profile session belongs to ${displayName}; the Profile overlay exposes BUZZ Identity${human?.domActive === true ? " and the active-Human UI marker agrees" : " even though the supporting active-Human UI marker was not yet mounted"}.`
      : `The authenticated PlotPickle profile session belongs to ${displayName}, but the Profile overlay did not expose BUZZ Identity.`,
    "pointer",
    "PlotPickle Profile overlay",
  );
}

export function createPhase3b3StepDrivers({ browser, client, runState }) {
  const drivers = createCorePhase3b3StepDrivers({ browser, client, runState });

  drivers.set("buzz-connect-existing-identity:open-profile-buzz", async () => {
    const human = await humanSessionState(client);
    if (human?.authenticated === true) return observeAuthenticatedProfileSurface(client, human);

    return {
      outcome: "uncertain",
      workerClaim: "uncertain",
      observed: `The current browser session is not authenticated to a PlotPickle Human yet (profile API status ${Number(human?.status || 0) || "unavailable"}). Casebook is pausing for Human-only profile unlock before testing BUZZ.`,
      interaction: "human-authority",
      target: "PlotPickle Human profile",
      humanCheckpoint: visibleHumanCheckpoint(),
      afterHuman: async () => {
        const after = await waitFor(
          () => humanSessionState(client),
          (value) => value?.authenticated === true,
          30,
          300,
        );
        if (after?.authenticated !== true) {
          return stepResult(
            false,
            `PlotPickle's authenticated profile API still reports no active Human after the Human checkpoint (status ${Number(after?.status || 0) || "unavailable"}; supporting DOM marker=${after?.domActive === true ? "present" : "absent"}).`,
            "human-authority",
            "PlotPickle Human profile",
          );
        }
        return observeAuthenticatedProfileSurface(client, after);
      },
    };
  });

  return drivers;
}
