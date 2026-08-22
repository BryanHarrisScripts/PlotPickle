import { randomUUID } from "node:crypto";
import { extractPageState, resultText } from "./mcp-runtime.mjs";
import { evaluateComfyUiWrongPortFault, evaluateSageFallbackFault } from "../casebook-live-verifiers.mjs";
import { runProfileIsolationLiveCase } from "./casebook-profile-isolation-live.mjs";

const clean = (value, limit = 900) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);

function artifact(id, source, passed, summary, metadata = {}) {
  return { id, kind: "evaluation", status: passed ? "verified" : "contradicted", source, independent: true, summary: clean(summary), metadata };
}

function fault(id, detected, observed, kind = "real-machine") {
  return { id, injected: true, detected, outcome: detected ? "blocked" : "pass", kind, observed: clean(observed) };
}

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

async function browserRequest(client, pathname, { method = "GET", body, label = pathname } = {}) {
  return browserValue(client, `async () => {
    const response = await fetch(${JSON.stringify(pathname)}, {
      method: ${JSON.stringify(method)}, cache: 'no-store',
      headers: ${body === undefined ? "{ Accept: 'application/json' }" : "{ Accept: 'application/json', 'Content-Type': 'application/json' }"},
      ${body === undefined ? "" : `body: JSON.stringify(${JSON.stringify(body)}),`}
    });
    const text = await response.text();
    let parsed = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text.slice(0, 500) }; }
    return JSON.stringify({ ok: response.ok, status: response.status, body: parsed });
  }`, label);
}

async function clickFirst(browser, labels) {
  for (const label of labels) if (await browser.clickVisible(label)) return label;
  return "";
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

async function privateBuzzKeyFieldState(client) {
  return browserValue(client, `() => {
    const surface = document.querySelector('[data-profile-identity-surface="v1"]');
    const labels = [...(surface?.querySelectorAll('label') || [])];
    const label = labels.find((node) => /Private identity key/i.test(node.textContent || ''));
    const input = label?.querySelector('input[type="password"]');
    if (!input) return JSON.stringify({ visible: false, hasValue: false });
    const style = getComputedStyle(input);
    const visible = style.display !== 'none' && style.visibility !== 'hidden' && input.getClientRects().length > 0;
    return JSON.stringify({ visible, hasValue: visible && input.value.length > 0 });
  }`, "masked BUZZ private identity field");
}

const messageMatches = (messages, marker) => (Array.isArray(messages) ? messages : []).filter((message) => clean(message?.content) === marker);

function signerFrom(message) {
  const raw = message?.raw;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  return ["pubkey", "author_pubkey", "authorPubkey", "public_key", "publicKey", "npub"].map((key) => raw[key]).find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

export function verifyGreatHallEvidence({ marker, initialMessages = [], reloadMessages = [], humanIdentity = {} } = {}) {
  const initial = messageMatches(initialMessages, marker);
  const reloaded = messageMatches(reloadMessages, marker);
  const firstId = clean(initial[0]?.id, 300);
  const reloadId = clean(reloaded[0]?.id, 300);
  const signer = signerFrom(initial[0]);
  const expectedSigner = clean(humanIdentity?.pubkey, 300);
  const reasons = [];
  if (!marker) reasons.push("the unique Casebook message marker is missing");
  if (initial.length !== 1) reasons.push(`initial BUZZ read-back found ${initial.length} matching events instead of exactly one`);
  if (reloaded.length !== 1) reasons.push(`reload BUZZ read-back found ${reloaded.length} matching events instead of exactly one`);
  if (!firstId) reasons.push("the independently read BUZZ event has no stable event id");
  if (firstId && reloadId && firstId !== reloadId) reasons.push("the BUZZ event id changed after reload");
  if (signer && expectedSigner && signer !== expectedSigner) reasons.push("the read-back event signer does not match the connected Human identity");
  return artifact("great-hall-signed-event", "buzz-event-observer", reasons.length === 0,
    reasons.length ? `Great Hall outcome did not meet the Business Case: ${reasons.join("; ")}.` : "One stable Great Hall BUZZ event was independently read back before and after reload, with no duplicate competing event.",
    { eventId: firstId, initialMatches: initial.length, reloadMatches: reloaded.length, signerObserved: Boolean(signer), signerMatched: signer && expectedSigner ? signer === expectedSigner : null });
}

async function ensureProfileIsolation(runState) {
  if (!runState.profileIsolation) runState.profileIsolation = await runProfileIsolationLiveCase();
  return runState.profileIsolation;
}

const profileObservation = (result, id) => (result?.observations || []).find((item) => item.id === id) || null;

export function createPhase3b3StepDrivers({ browser, client, runState }) {
  const drivers = new Map();
  for (const [stepId, observationId, target] of [
    ["unlock-a", "profile-a-state", "Human A test profile"],
    ["create-private-a", "profile-a-state", "Human A private state"],
    ["switch-b", "profile-b-state", "Human B test profile"],
    ["deny-cross-profile", "cross-profile-denial", "Cross-profile project and private-state access"],
    ["restart-and-recheck", "restart-isolation", "Restarted profile services"],
  ]) {
    drivers.set(`profile-isolation:${stepId}`, async () => {
      const observation = profileObservation(await ensureProfileIsolation(runState), observationId);
      return stepResult(observation?.status === "verified", observation?.summary || `${target} was not verified.`, "security-exercise", target);
    });
  }

  drivers.set("buzz-connect-existing-identity:open-profile-buzz", async () => {
    const state = await waitFor(
      () => openProfileIdentitySurface(client),
      (value) => value?.buzzVisible === true,
      12,
      250,
    );
    return stepResult(state?.buzzVisible === true,
      state?.buzzVisible === true ? "The exact PlotPickle Profile overlay is open and its BUZZ Identity surface is visible." : "The PlotPickle Profile overlay did not expose the BUZZ Identity surface.",
      "pointer",
      "PlotPickle Profile overlay");
  });

  drivers.set("buzz-connect-existing-identity:enter-existing-key", async ({ checkpoint }) => {
    await openProfileIdentitySurface(client);
    const clicked = await clickFirst(browser, ["Connect Existing Identity", "Replace identity"]);
    if (!clicked) return { outcome: "uncertain", workerClaim: "uncertain", observed: "Connect Existing Identity or Replace identity was not available in the open Profile overlay.", interaction: "pointer", target: "Connect Existing Identity", critical: false };
    const fieldState = await waitFor(
      () => privateBuzzKeyFieldState(client),
      (value) => value?.visible === true,
      12,
      250,
    );
    if (!fieldState?.visible) return { outcome: "uncertain", workerClaim: "uncertain", observed: "The masked BUZZ private identity field did not become visible after opening the connection flow.", interaction: "focus", target: "Private identity key", critical: false };
    const humanCheckpoint = checkpoint ? {
      ...checkpoint,
      instruction: `${checkpoint.instruction} Casebook is now paused with no time limit; it will not continue until you return to this terminal and press Enter.`,
    } : checkpoint;
    return {
      outcome: "uncertain",
      workerClaim: "uncertain",
      observed: "The masked BUZZ private identity field is visible. Secret entry is Human-only and Casebook is waiting indefinitely for operator Enter.",
      interaction: "focus",
      target: "Private identity key",
      humanCheckpoint,
      critical: false,
      afterHuman: async () => {
        const after = await privateBuzzKeyFieldState(client);
        return {
          outcome: after?.visible && after?.hasValue ? "pass" : "uncertain",
          workerClaim: after?.visible && after?.hasValue ? "pass" : "uncertain",
          observed: after?.visible && after?.hasValue
            ? "Human entry is present in the masked BUZZ field; Casebook verified only that the field is non-empty and did not read or log the secret."
            : "The masked BUZZ field is still empty or no longer visible after the Human checkpoint.",
          interaction: "focus",
          target: "Private identity key",
          critical: false,
        };
      },
    };
  });

  drivers.set("buzz-connect-existing-identity:verify-signer", async () => {
    if (!await clickFirst(browser, ["Connect identity"])) return stepResult(false, "Connect identity was not available after Human key entry.", "pointer", "Connect identity");
    const response = await waitFor(
      () => browserRequest(client, "/api/local-buzz/human-identity", { label: "connected BUZZ Human identity" }),
      (value) => value?.ok && value?.body?.identityVerified === true && value?.body?.humanCommunityAllowed === true && Boolean(value?.body?.pubkey), 24);
    runState.buzzIdentity = { ...(runState.buzzIdentity || {}), connected: response?.body || {} };
    const passed = response?.ok && response?.body?.identityVerified === true && response?.body?.humanCommunityAllowed === true && Boolean(response?.body?.pubkey);
    return stepResult(passed, passed ? `BUZZ independently resolved the connected Human signer as ${clean(response.body.displayName || "the Human identity", 160)}.` : "BUZZ did not independently resolve a verified Human signer.", "evaluation", "Connected BUZZ Human signer");
  });

  drivers.set("buzz-connect-existing-identity:persist-connected", async () => {
    const current = await browser.currentState();
    const url = clean(current?.url, 2000);
    if (!url) return stepResult(false, "PlotPickle did not expose a current URL for the persistence reload, so Casebook refused to navigate with an undefined target.", "navigate", "Current PlotPickle URL");
    await browser.navigate(url);
    await new Promise((resolve) => setTimeout(resolve, 700));
    await openProfileIdentitySurface(client);
    const response = await browserRequest(client, "/api/local-buzz/human-identity", { label: "persisted BUZZ Human identity" });
    const before = clean(runState.buzzIdentity?.connected?.pubkey, 300);
    const after = clean(response?.body?.pubkey, 300);
    const passed = response?.ok && response?.body?.identityVerified === true && Boolean(before) && before === after;
    runState.buzzIdentity = { ...(runState.buzzIdentity || {}), persisted: response?.body || {} };
    return stepResult(passed, passed ? "The same verified BUZZ public signer remained connected after a full PlotPickle reload." : "The connected BUZZ public signer did not survive reload unchanged.", "navigate", "Profile after reload");
  });

  drivers.set("buzz-connect-existing-identity:open-community", async () => {
    const clicked = await clickFirst(browser, ["Community"]);
    const identity = await browserRequest(client, "/api/local-buzz/human-identity", { label: "Community BUZZ Human identity" });
    const expected = clean(runState.buzzIdentity?.connected?.pubkey, 300);
    const actual = clean(identity?.body?.pubkey, 300);
    const passed = Boolean(clicked) && identity?.body?.humanCommunityAllowed === true && Boolean(expected) && expected === actual;
    runState.buzzIdentity = { ...(runState.buzzIdentity || {}), communityOpened: passed, community: identity?.body || {} };
    return stepResult(passed, passed ? "Community opened using the same verified Human BUZZ signer." : "Community did not open with the same verified Human BUZZ signer.", "pointer", clicked || "Community");
  });

  drivers.set("buzz-great-hall-signed-conversation:open-great-hall", async () => {
    await clickFirst(browser, ["Community"]);
    const clicked = await clickFirst(browser, ["The Great Hall", "Great Hall"]);
    const [rooms, identity] = await Promise.all([
      browserRequest(client, "/api/local-buzz/rooms", { label: "BUZZ rooms" }),
      browserRequest(client, "/api/local-buzz/human-identity", { label: "Great Hall Human identity" }),
    ]);
    const greatHall = (rooms?.body?.rooms || []).find((room) => clean(room?.name, 160).toLowerCase() === "great-hall") || null;
    runState.greatHall = { ...(runState.greatHall || {}), channelId: greatHall?.id || "", humanIdentity: identity?.body || {} };
    const passed = Boolean(clicked) && Boolean(greatHall?.id) && identity?.body?.humanCommunityAllowed === true;
    return stepResult(passed, passed ? "The Human-visible Great Hall is open and its real BUZZ channel plus verified Human identity are resolved." : "Great Hall, its BUZZ channel, or the verified Human identity could not be resolved.", "pointer", clicked || "Great Hall");
  });

  drivers.set("buzz-great-hall-signed-conversation:send-message", async () => {
    const marker = `PlotPickle Casebook ${randomUUID()}`;
    runState.greatHall = { ...(runState.greatHall || {}), marker };
    const filled = await browser.fillByLabel("MESSAGE TO HALL 1 / GREAT HALL", marker);
    const clicked = filled.ok && await clickFirst(browser, ["[ENTER] SEND SIGNED MESSAGE"]);
    return stepResult(Boolean(clicked), clicked ? "A unique disposable Casebook message was submitted through the visible signed Great Hall send control." : "The unique Great Hall message could not be entered and sent through the visible controls.", "pointer", "[ENTER] SEND SIGNED MESSAGE");
  });

  drivers.set("buzz-great-hall-signed-conversation:observe-signed-event", async () => {
    const { channelId, marker } = runState.greatHall || {};
    if (!channelId || !marker) return stepResult(false, "Great Hall channel or unique message marker is missing.", "evaluation", "BUZZ Great Hall read-back");
    const response = await waitFor(
      () => browserRequest(client, `/api/local-buzz/messages?channel=${encodeURIComponent(channelId)}&limit=40`, { label: "Great Hall event read-back" }),
      (value) => messageMatches(value?.body?.messages, marker).length >= 1, 20);
    const matches = messageMatches(response?.body?.messages, marker);
    const event = matches[0] || null;
    runState.greatHall = { ...runState.greatHall, initialMessages: response?.body?.messages || [], event };
    return stepResult(matches.length === 1 && Boolean(event?.id), matches.length === 1 && event?.id ? `BUZZ independently read back exactly one event with stable id ${clean(event.id, 160)}.` : `BUZZ read-back found ${matches.length} matching events or no stable event id.`, "evaluation", "BUZZ event read-back");
  });

  drivers.set("buzz-great-hall-signed-conversation:read-back", async () => {
    const marker = clean(runState.greatHall?.marker);
    const page = await waitFor(
      () => browserValue(client, `() => JSON.stringify({ text: (document.body.innerText || '').slice(0, 20000) })`, "Great Hall visible read-back"),
      (value) => String(value?.text || "").includes(marker), 14);
    const passed = String(page?.text || "").includes(marker);
    runState.greatHall = { ...(runState.greatHall || {}), visibleReadBack: passed };
    return stepResult(passed, passed ? "PlotPickle rendered the same BUZZ-backed Great Hall message in the Human-visible conversation." : "The signed BUZZ event did not become visible in PlotPickle.", "observe", "Great Hall conversation");
  });

  drivers.set("buzz-great-hall-signed-conversation:reload-and-confirm", async () => {
    const current = await browser.currentState();
    const url = clean(current?.url, 2000);
    if (!url) return stepResult(false, "PlotPickle did not expose a current Great Hall URL for reload, so Casebook refused to navigate with an undefined target.", "navigate", "Great Hall current URL");
    await browser.navigate(url);
    await new Promise((resolve) => setTimeout(resolve, 700));
    await clickFirst(browser, ["Community"]);
    await clickFirst(browser, ["The Great Hall", "Great Hall"]);
    const { channelId, marker, event } = runState.greatHall || {};
    const response = await browserRequest(client, `/api/local-buzz/messages?channel=${encodeURIComponent(channelId)}&limit=40`, { label: "Great Hall reload read-back" });
    const matches = messageMatches(response?.body?.messages, marker);
    const page = await waitFor(
      () => browserValue(client, `() => JSON.stringify({ text: (document.body.innerText || '').slice(0, 20000) })`, "Great Hall visible reload"),
      (value) => String(value?.text || "").includes(marker), 14);
    const passed = matches.length === 1 && Boolean(event?.id) && clean(event.id, 300) === clean(matches[0]?.id, 300) && String(page?.text || "").includes(marker);
    runState.greatHall = { ...runState.greatHall, reloadMessages: response?.body?.messages || [], visibleAfterReload: String(page?.text || "").includes(marker) };
    return stepResult(passed, passed ? "After a full reload, the same unique BUZZ event id was read back once and remained visible in Great Hall." : "Great Hall reload did not preserve one stable visible BUZZ event identity.", "navigate", "Great Hall after reload");
  });
  return drivers;
}

export async function finalizePhase3b3Proof({ caseDefinition, runState }) {
  if (caseDefinition.id === "profile-isolation") return (await ensureProfileIsolation(runState)).independentVerification;
  if (caseDefinition.id === "buzz-connect-existing-identity") {
    const connected = runState.buzzIdentity?.connected || {};
    const persisted = runState.buzzIdentity?.persisted || {};
    const pubkey = clean(connected.pubkey, 300);
    const passed = connected.identityVerified === true && connected.humanCommunityAllowed === true && Boolean(pubkey) && pubkey === clean(persisted.pubkey, 300) && runState.buzzIdentity?.communityOpened === true;
    return artifact("buzz-connected-signer", "buzz-signer-observer", passed, passed ? "The real connected BUZZ signer was independently resolved, survived reload unchanged, and opened Community as the authenticated Human." : "The connected BUZZ signer, persistence boundary, or Community binding was not independently verified.", { signerObserved: Boolean(pubkey), persistedMatch: Boolean(pubkey) && pubkey === clean(persisted.pubkey, 300), communityOpened: runState.buzzIdentity?.communityOpened === true });
  }
  if (caseDefinition.id === "buzz-great-hall-signed-conversation") return verifyGreatHallEvidence({ marker: runState.greatHall?.marker, initialMessages: runState.greatHall?.initialMessages, reloadMessages: runState.greatHall?.reloadMessages, humanIdentity: runState.greatHall?.humanIdentity });
  return null;
}

export async function runPhase3b3Faults({ caseDefinition, client, runState }) {
  if (caseDefinition.id === "profile-isolation") return (await ensureProfileIsolation(runState)).faults.map((item) => fault(item.id, ["blocked", "fail"].includes(item.outcome), item.observed, "real-machine-security"));
  if (caseDefinition.id === "buzz-connect-existing-identity") {
    const before = await browserRequest(client, "/api/local-buzz/human-identity", { label: "BUZZ identity before invalid-key fault" });
    const invalid = await browserRequest(client, "/api/local-buzz/human-identity", { method: "POST", body: { action: "import", privateKey: "casebook-invalid-private-key", displayName: before?.body?.displayName || "Casebook Human" }, label: "invalid BUZZ private-key fault" });
    const after = await browserRequest(client, "/api/local-buzz/human-identity", { label: "BUZZ identity after invalid-key fault" });
    const beforePubkey = clean(before?.body?.pubkey, 300);
    const detected = invalid?.ok === false && Boolean(beforePubkey) && beforePubkey === clean(after?.body?.pubkey, 300) && after?.body?.humanCommunityAllowed === true;
    return [fault("invalid-private-key-rejected-without-overwrite", detected, detected ? "A deliberately invalid BUZZ private key was rejected and the previously verified Human signer remained unchanged." : "The invalid BUZZ key fault was not rejected cleanly or altered the connected Human signer.", "real-machine-api")];
  }
  if (caseDefinition.id === "buzz-great-hall-signed-conversation") {
    const event = runState.greatHall?.event;
    if (!event) return [fault("duplicate-event-detection", false, "No real Great Hall event was available for duplicate mutation testing.", "mutation")];
    const detected = verifyGreatHallEvidence({ marker: runState.greatHall?.marker, initialMessages: [event, event], reloadMessages: [event], humanIdentity: runState.greatHall?.humanIdentity }).status === "contradicted";
    return [fault("duplicate-event-detection", detected, detected ? "A deliberate duplicate of the real Great Hall event was rejected by the independent event verifier." : "The independent Great Hall verifier failed to detect a duplicate/replayed event.", "mutation-from-real-event")];
  }
  if (caseDefinition.id === "sage-local-text-usable-response") {
    const injected = evaluateSageFallbackFault("That local reply didn’t come through cleanly, so I dropped it. Ask me again and I’ll keep it short and direct.");
    return [fault("known-vague-sage-fallback", injected.outcome === "fail", injected.observed, "mutation")];
  }
  if (caseDefinition.id === "comfyui-local-image-visible") {
    const diagnostic = await browserRequest(client, "/api/provider-diagnostics/comfyui", { method: "POST", body: { baseUrl: "http://127.0.0.1:65534" }, label: "ComfyUI wrong-port fault" });
    const injected = evaluateComfyUiWrongPortFault(diagnostic?.body || {});
    return [fault("comfyui-wrong-port-detected", injected.outcome === "blocked", injected.observed, "real-machine-diagnostic")];
  }
  return [];
}
