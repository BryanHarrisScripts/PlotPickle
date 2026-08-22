import { randomUUID } from "node:crypto";
import { extractPageState, resultText } from "./creative-uat/mcp-runtime.mjs";
import { evaluateComfyUiWrongPortFault, evaluateSageFallbackFault } from "./casebook-live-verifiers.mjs";
import { runProfileIsolationLiveCase } from "./casebook-profile-isolation-live.mjs";

function clean(value, limit = 900) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function artifact({ id, source, passed, summary, metadata = {} }) {
  return {
    id,
    kind: "evaluation",
    status: passed ? "verified" : "contradicted",
    source,
    independent: true,
    summary: clean(summary),
    metadata,
  };
}

function fault(id, detected, observed, kind = "real-machine") {
  return {
    id,
    injected: true,
    detected,
    outcome: detected ? "blocked" : "pass",
    kind,
    observed: clean(observed),
  };
}

async function browserValue(client, functionSource, label) {
  const raw = resultText(await client.call("browser_evaluate", { function: functionSource }));
  if (!String(raw || "").trim()) throw new Error(`${label} returned no browser observation.`);
  const parsed = extractPageState(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${label} did not return a structured browser observation.`);
  return parsed;
}

async function browserRequest(client, pathname, { method = "GET", body = undefined, label = pathname } = {}) {
  return browserValue(client, `async () => {
    const response = await fetch(${JSON.stringify(pathname)}, {
      method: ${JSON.stringify(method)},
      cache: 'no-store',
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

async function waitFor(client, operation, predicate, attempts = 16, delayMs = 500) {
  let value = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    value = await operation();
    if (predicate(value)) return value;
    if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return value;
}

function roomNamed(rooms, name) {
  return (Array.isArray(rooms) ? rooms : []).find((room) => clean(room?.name, 160).toLowerCase() === name.toLowerCase()) || null;
}

function messageMatches(messages, marker) {
  return (Array.isArray(messages) ? messages : []).filter((message) => clean(message?.content, 900) === marker);
}

function signerFrom(message) {
  const raw = message?.raw;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  for (const key of ["pubkey", "author_pubkey", "authorPubkey", "public_key", "publicKey", "npub"]) {
    if (typeof raw[key] === "string" && raw[key].trim()) return raw[key].trim();
  }
  return "";
}

export function verifyGreatHallEvidence({ marker, initialMessages = [], reloadMessages = [], humanIdentity = {} } = {}) {
  const initial = messageMatches(initialMessages, marker);
  const reloaded = messageMatches(reloadMessages, marker);
  const reasons = [];
  if (!marker) reasons.push("the unique Casebook message marker is missing");
  if (initial.length !== 1) reasons.push(`initial BUZZ read-back found ${initial.length} matching events instead of exactly one`);
  if (reloaded.length !== 1) reasons.push(`reload BUZZ read-back found ${reloaded.length} matching events instead of exactly one`);
  const firstId = clean(initial[0]?.id, 300);
  const reloadId = clean(reloaded[0]?.id, 300);
  if (!firstId) reasons.push("the independently read BUZZ event has no stable event id");
  if (firstId && reloadId && firstId !== reloadId) reasons.push("the BUZZ event id changed after reload");
  const signer = signerFrom(initial[0]);
  const expectedSigner = clean(humanIdentity?.pubkey, 300);
  if (signer && expectedSigner && signer !== expectedSigner) reasons.push("the read-back event signer does not match the connected Human identity");
  return artifact({
    id: "great-hall-signed-event",
    source: "buzz-event-observer",
    passed: reasons.length === 0,
    summary: reasons.length
      ? `Great Hall outcome did not meet the Business Case: ${reasons.join("; ")}.`
      : "One stable Great Hall BUZZ event was independently read back before and after reload, with no duplicate competing event.",
    metadata: {
      eventId: firstId,
      initialMatches: initial.length,
      reloadMatches: reloaded.length,
      signerObserved: Boolean(signer),
      signerMatched: signer && expectedSigner ? signer === expectedSigner : null,
    },
  });
}

async function ensureProfileIsolation(runState) {
  if (!runState.profileIsolation) runState.profileIsolation = await runProfileIsolationLiveCase();
  return runState.profileIsolation;
}

function profileObservation(result, id) {
  return (result?.observations || []).find((item) => item.id === id) || null;
}

function stepResult(passed, observed, interaction, target, extra = {}) {
  return {
    outcome: passed ? "pass" : "fail",
    workerClaim: passed ? "pass" : "fail",
    observed: clean(observed),
    interaction,
    target: clean(target),
    ...extra,
  };
}

export function createPhase3b3StepDrivers({ browser, client, runState }) {
  const drivers = new Map();

  drivers.set("profile-isolation:unlock-a", async () => {
    const result = await ensureProfileIsolation(runState);
    const observation = profileObservation(result, "profile-a-state");
    return stepResult(observation?.status === "verified", observation?.summary || "Human A test-scoped profile state was not verified.", "security-exercise", "Human A test profile");
  });
  drivers.set("profile-isolation:create-private-a", async () => {
    const result = await ensureProfileIsolation(runState);
    const observation = profileObservation(result, "profile-a-state");
    return stepResult(observation?.status === "verified", observation?.summary || "Human A private state was not verified.", "security-exercise", "Human A private state");
  });
  drivers.set("profile-isolation:switch-b", async () => {
    const result = await ensureProfileIsolation(runState);
    const observation = profileObservation(result, "profile-b-state");
    return stepResult(observation?.status === "verified", observation?.summary || "Human B test-scoped profile state was not verified.", "security-exercise", "Human B test profile");
  });
  drivers.set("profile-isolation:deny-cross-profile", async () => {
    const result = await ensureProfileIsolation(runState);
    const observation = profileObservation(result, "cross-profile-denial");
    return stepResult(observation?.status === "verified", observation?.summary || "Cross-profile denial was not verified.", "security-exercise", "Cross-profile project and private-state access");
  });
  drivers.set("profile-isolation:restart-and-recheck", async () => {
    const result = await ensureProfileIsolation(runState);
    const observation = profileObservation(result, "restart-isolation");
    return stepResult(observation?.status === "verified", observation?.summary || "Restart isolation was not verified.", "security-exercise", "Restarted profile services");
  });

  drivers.set("buzz-connect-existing-identity:verify-signer", async () => {
    const clicked = await clickFirst(browser, ["Connect identity"]);
    if (!clicked) return stepResult(false, "Connect identity was not available after Human key entry.", "pointer", "Connect identity");
    const response = await waitFor(client,
      () => browserRequest(client, "/api/local-buzz/human-identity", { label: "connected BUZZ Human identity" }),
      (value) => value?.ok && value?.body?.identityVerified === true && value?.body?.humanCommunityAllowed === true && Boolean(value?.body?.pubkey),
      24,
      500,
    );
    const identity = response?.body || {};
    runState.buzzIdentity = { ...(runState.buzzIdentity || {}), connected: identity };
    return stepResult(
      response?.ok && identity.identityVerified === true && identity.humanCommunityAllowed === true && Boolean(identity.pubkey),
      response?.ok ? `BUZZ independently resolved the connected Human signer as ${clean(identity.displayName || "the Human identity", 160)}.` : `BUZZ signer verification failed with HTTP ${response?.status || "unknown"}.`,
      "evaluation",
      "Connected BUZZ Human signer",
    );
  });

  drivers.set("buzz-connect-existing-identity:persist-connected", async () => {
    const location = await browserValue(client, `() => JSON.stringify({ url: location.href })`, "current PlotPickle URL");
    await browser.navigate(location.url);
    await new Promise((resolve) => setTimeout(resolve, 700));
    await clickFirst(browser, ["Profile"]);
    const response = await browserRequest(client, "/api/local-buzz/human-identity", { label: "persisted BUZZ Human identity" });
    const before = clean(runState.buzzIdentity?.connected?.pubkey, 300);
    const after = clean(response?.body?.pubkey, 300);
    const passed = response?.ok && response?.body?.identityVerified === true && Boolean(before) && before === after;
    runState.buzzIdentity = { ...(runState.buzzIdentity || {}), persisted: response?.body || {} };
    return stepResult(passed, passed ? "The same verified BUZZ public signer remained connected after a full PlotPickle reload." : "The connected BUZZ public signer did not survive reload unchanged.", "navigate", "Profile after reload");
  });

  drivers.set("buzz-connect-existing-identity:open-community", async () => {
    const clicked = await clickFirst(browser, ["Community"]);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const page = await browserValue(client, `() => JSON.stringify({ text: (document.body.innerText || '').slice(0, 16000) })`, "Community surface");
    const identity = await browserRequest(client, "/api/local-buzz/human-identity", { label: "Community BUZZ Human identity" });
    const expected = clean(runState.buzzIdentity?.connected?.pubkey, 300);
    const actual = clean(identity?.body?.pubkey, 300);
    const passed = Boolean(clicked) && /Community|Great Hall|BUZZ/i.test(page.text || "") && identity?.body?.humanCommunityAllowed === true && Boolean(expected) && expected === actual;
    runState.buzzIdentity = { ...(runState.buzzIdentity || {}), communityOpened: passed, community: identity?.body || {} };
    return stepResult(passed, passed ? "Community opened using the same verified Human BUZZ signer." : "Community did not open with the same verified Human BUZZ signer.", "pointer", clicked || "Community");
  });

  drivers.set("buzz-great-hall-signed-conversation:open-great-hall", async () => {
    await clickFirst(browser, ["Community"]);
    const clicked = await clickFirst(browser, ["The Great Hall", "Great Hall"]);
    const rooms = await browserRequest(client, "/api/local-buzz/rooms", { label: "BUZZ rooms" });
    const greatHall = roomNamed(rooms?.body?.rooms, "great-hall");
    const identity = await browserRequest(client, "/api/local-buzz/human-identity", { label: "Great Hall Human identity" });
    runState.greatHall = { ...(runState.greatHall || {}), channelId: greatHall?.id || "", humanIdentity: identity?.body || {} };
    const passed = Boolean(clicked) && Boolean(greatHall?.id) && identity?.body?.humanCommunityAllowed === true;
    return stepResult(passed, passed ? "The Human-visible Great Hall is open and its real BUZZ channel plus verified Human identity are resolved." : "Great Hall, its BUZZ channel, or the verified Human identity could not be resolved.", "pointer", clicked || "Great Hall");
  });

  drivers.set("buzz-great-hall-signed-conversation:send-message", async () => {
    const marker = `PlotPickle Casebook ${randomUUID()}`;
    runState.greatHall = { ...(runState.greatHall || {}), marker };
    const filled = await browser.fillByLabel("MESSAGE TO HALL 1 / GREAT HALL", marker);
    if (!filled.ok) return stepResult(false, "Casebook could not enter the unique Great Hall test message through the visible composer.", "typing", "Great Hall message composer");
    const clicked = await clickFirst(browser, ["[ENTER] SEND SIGNED MESSAGE"]);
    return stepResult(Boolean(clicked), clicked ? "A unique disposable Casebook message was submitted through the visible signed Great Hall send control." : "The Great Hall signed send control could not be exercised.", "pointer", "[ENTER] SEND SIGNED MESSAGE");
  });

  drivers.set("buzz-great-hall-signed-conversation:observe-signed-event", async () => {
    const channelId = clean(runState.greatHall?.channelId, 300);
    const marker = clean(runState.greatHall?.marker, 900);
    if (!channelId || !marker) return stepResult(false, "Great Hall channel or unique message marker is missing.", "evaluation", "BUZZ Great Hall read-back");
    const response = await waitFor(client,
      () => browserRequest(client, `/api/local-buzz/messages?channel=${encodeURIComponent(channelId)}&limit=40`, { label: "Great Hall event read-back" }),
      (value) => messageMatches(value?.body?.messages, marker).length >= 1,
      20,
      500,
    );
    const matches = messageMatches(response?.body?.messages, marker);
    const event = matches[0] || null;
    runState.greatHall = { ...(runState.greatHall || {}), initialMessages: response?.body?.messages || [], event };
    const passed = matches.length === 1 && Boolean(event?.id);
    return stepResult(passed, passed ? `BUZZ independently read back exactly one event for the message with stable id ${clean(event.id, 160)}.` : `BUZZ read-back found ${matches.length} matching events or no stable event id.`, "evaluation", "BUZZ event read-back");
  });

  drivers.set("buzz-great-hall-signed-conversation:read-back", async () => {
    const marker = clean(runState.greatHall?.marker, 900);
    let page = await browserValue(client, `() => JSON.stringify({ text: (document.body.innerText || '').slice(0, 20000) })`, "Great Hall visible read-back");
    if (!String(page.text || "").includes(marker)) {
      await clickFirst(browser, ["Refresh", "Refresh Community"]);
      page = await waitFor(client,
        () => browserValue(client, `() => JSON.stringify({ text: (document.body.innerText || '').slice(0, 20000) })`, "Great Hall visible read-back"),
        (value) => String(value?.text || "").includes(marker),
        14,
        500,
      );
    }
    const passed = String(page?.text || "").includes(marker);
    runState.greatHall = { ...(runState.greatHall || {}), visibleReadBack: passed };
    return stepResult(passed, passed ? "PlotPickle rendered the same BUZZ-backed Great Hall message in the Human-visible conversation." : "The signed event exists in BUZZ read-back but did not become visible in PlotPickle.", "observe", "Great Hall conversation");
  });

  drivers.set("buzz-great-hall-signed-conversation:reload-and-confirm", async () => {
    const current = await browserValue(client, `() => JSON.stringify({ url: location.href })`, "Great Hall current URL");
    await browser.navigate(current.url);
    await new Promise((resolve) => setTimeout(resolve, 700));
    await clickFirst(browser, ["Community"]);
    await clickFirst(browser, ["The Great Hall", "Great Hall"]);
    const channelId = clean(runState.greatHall?.channelId, 300);
    const marker = clean(runState.greatHall?.marker, 900);
    const response = await browserRequest(client, `/api/local-buzz/messages?channel=${encodeURIComponent(channelId)}&limit=40`, { label: "Great Hall reload read-back" });
    const matches = messageMatches(response?.body?.messages, marker);
    const previousId = clean(runState.greatHall?.event?.id, 300);
    const nextId = clean(matches[0]?.id, 300);
    const page = await waitFor(client,
      () => browserValue(client, `() => JSON.stringify({ text: (document.body.innerText || '').slice(0, 20000) })`, "Great Hall visible reload"),
      (value) => String(value?.text || "").includes(marker),
      14,
      500,
    );
    const passed = matches.length === 1 && Boolean(previousId) && previousId === nextId && String(page?.text || "").includes(marker);
    runState.greatHall = { ...(runState.greatHall || {}), reloadMessages: response?.body?.messages || [], visibleAfterReload: String(page?.text || "").includes(marker) };
    return stepResult(passed, passed ? "After a full reload, the same unique BUZZ event id was read back once and remained visible in Great Hall." : "Great Hall reload did not preserve one stable visible BUZZ event identity.", "navigate", "Great Hall after reload");
  });

  return drivers;
}

export async function finalizePhase3b3Proof({ caseDefinition, runState }) {
  if (caseDefinition.id === "profile-isolation") {
    const result = await ensureProfileIsolation(runState);
    return result.independentVerification;
  }
  if (caseDefinition.id === "buzz-connect-existing-identity") {
    const connected = runState.buzzIdentity?.connected || {};
    const persisted = runState.buzzIdentity?.persisted || {};
    const pubkey = clean(connected.pubkey, 300);
    const passed = connected.identityVerified === true
      && connected.humanCommunityAllowed === true
      && Boolean(pubkey)
      && pubkey === clean(persisted.pubkey, 300)
      && runState.buzzIdentity?.communityOpened === true;
    return artifact({
      id: "buzz-connected-signer",
      source: "buzz-signer-observer",
      passed,
      summary: passed
        ? "The real connected BUZZ signer was independently resolved, survived reload unchanged, and opened Community as the authenticated Human."
        : "The connected BUZZ signer, persistence boundary, or Community binding was not independently verified.",
      metadata: { signerObserved: Boolean(pubkey), persistedMatch: Boolean(pubkey) && pubkey === clean(persisted.pubkey, 300), communityOpened: runState.buzzIdentity?.communityOpened === true },
    });
  }
  if (caseDefinition.id === "buzz-great-hall-signed-conversation") {
    return verifyGreatHallEvidence({
      marker: runState.greatHall?.marker,
      initialMessages: runState.greatHall?.initialMessages,
      reloadMessages: runState.greatHall?.reloadMessages,
      humanIdentity: runState.greatHall?.humanIdentity,
    });
  }
  return null;
}

export async function runPhase3b3Faults({ caseDefinition, client, runState }) {
  if (caseDefinition.id === "profile-isolation") {
    const result = await ensureProfileIsolation(runState);
    return (result.faults || []).map((item) => fault(item.id, ["blocked", "fail"].includes(item.outcome), item.observed, "real-machine-security"));
  }

  if (caseDefinition.id === "buzz-connect-existing-identity") {
    const before = await browserRequest(client, "/api/local-buzz/human-identity", { label: "BUZZ identity before invalid-key fault" });
    const invalid = await browserRequest(client, "/api/local-buzz/human-identity", {
      method: "POST",
      body: {
        action: "import",
        privateKey: "casebook-invalid-private-key",
        displayName: before?.body?.displayName || "Casebook Human",
      },
      label: "invalid BUZZ private-key fault",
    });
    const after = await browserRequest(client, "/api/local-buzz/human-identity", { label: "BUZZ identity after invalid-key fault" });
    const beforePubkey = clean(before?.body?.pubkey, 300);
    const afterPubkey = clean(after?.body?.pubkey, 300);
    const detected = invalid?.ok === false && Boolean(beforePubkey) && beforePubkey === afterPubkey && after?.body?.humanCommunityAllowed === true;
    return [fault("invalid-private-key-rejected-without-overwrite", detected, detected
      ? "A deliberately invalid BUZZ private key was rejected and the previously verified Human signer remained unchanged."
      : "The invalid BUZZ key fault was not rejected cleanly or altered the connected Human signer.", "real-machine-api")];
  }

  if (caseDefinition.id === "buzz-great-hall-signed-conversation") {
    const event = runState.greatHall?.event;
    if (!event) return [fault("duplicate-event-detection", false, "No real Great Hall event was available for duplicate mutation testing.", "mutation")];
    const mutated = verifyGreatHallEvidence({
      marker: runState.greatHall?.marker,
      initialMessages: [event, event],
      reloadMessages: [event],
      humanIdentity: runState.greatHall?.humanIdentity,
    });
    const detected = mutated.status === "contradicted";
    return [fault("duplicate-event-detection", detected, detected
      ? "A deliberate duplicate of the real Great Hall event was rejected by the independent event verifier."
      : "The independent Great Hall verifier failed to detect a duplicate/replayed event.", "mutation-from-real-event")];
  }

  if (caseDefinition.id === "sage-local-text-usable-response") {
    const injected = evaluateSageFallbackFault("That local reply didn’t come through cleanly, so I dropped it. Ask me again and I’ll keep it short and direct.");
    const detected = injected.outcome === "fail";
    return [fault("known-vague-sage-fallback", detected, injected.observed, "mutation")];
  }

  if (caseDefinition.id === "comfyui-local-image-visible") {
    const diagnostic = await browserRequest(client, "/api/provider-diagnostics/comfyui", {
      method: "POST",
      body: { baseUrl: "http://127.0.0.1:65534" },
      label: "ComfyUI wrong-port fault",
    });
    const injected = evaluateComfyUiWrongPortFault(diagnostic?.body || {});
    const detected = injected.outcome === "blocked";
    return [fault("comfyui-wrong-port-detected", detected, injected.observed, "real-machine-diagnostic")];
  }

  return [];
}
