import { resultText } from "./creative-uat/mcp-runtime.mjs";
import {
  evaluateSageVisibleAnswer,
  verifyComfyUiVisibleOutput,
  verifyLocalImageAsset,
} from "./casebook-live-verifiers.mjs";

function clean(value, limit = 900) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

async function casebookBrowserValue(client, functionSource, label) {
  const raw = resultText(await client.call("browser_evaluate", { function: functionSource }));
  const text = String(raw || "").trim();
  if (!text) throw new Error(`${label} returned no browser observation.`);
  try { return JSON.parse(text); }
  catch { return text.replace(/^"|"$/g, ""); }
}

async function browserFetchStatus({ client, pathname, label }) {
  return casebookBrowserValue(client, `async () => {
    const response = await fetch(${JSON.stringify(pathname)}, { cache: 'no-store' });
    const text = await response.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 500) }; }
    return JSON.stringify({ ok: response.ok, status: response.status, body });
  }`, label);
}

async function clickFirstVisible({ browser, labels }) {
  for (const label of labels) {
    if (await browser.clickVisible(label)) return label;
  }
  return "";
}

async function waitForSageVisibleAnswer({ client, attempts = 90 }) {
  let last = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await casebookBrowserValue(client, `() => {
      const room = document.querySelector('aside[aria-label="Persistent Creative Room"]');
      if (!room) return JSON.stringify({ ready: false, answer: '', relatedLessonLabels: [] });
      const candidates = [...room.querySelectorAll('div')].flatMap((node) => {
        const strong = node.querySelector(':scope > strong');
        const paragraph = node.querySelector(':scope > p');
        if (!strong || !paragraph || (strong.textContent || '').trim() !== 'Guide') return [];
        const text = (paragraph.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text || /Thinking about your question/i.test(text) || /^You.re reading /i.test(text)) return [];
        const sources = [...node.querySelectorAll('button[aria-label^="Learn more in "]')].map((button) => (button.getAttribute('aria-label') || '').trim());
        return [{ answer: text, relatedLessonLabels: sources }];
      });
      const answer = candidates.at(-1) || { answer: '', relatedLessonLabels: [] };
      return JSON.stringify({ ready: Boolean(answer.answer), ...answer });
    }`, "Sage visible answer");
    if (last?.ready) return last;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return last || { ready: false, answer: "", relatedLessonLabels: [] };
}

async function waitForVisibleComfyImage({ client, attempts = 180 }) {
  let last = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await casebookBrowserValue(client, `() => {
      const image = document.querySelector('img[alt="Generated media route connection test"]');
      if (!image) return JSON.stringify({ visible: false, src: '', complete: false, naturalWidth: 0 });
      const style = getComputedStyle(image);
      const visible = style.display !== 'none' && style.visibility !== 'hidden' && image.getClientRects().length > 0;
      return JSON.stringify({ visible, src: image.getAttribute('src') || image.currentSrc || '', complete: image.complete, naturalWidth: image.naturalWidth || 0 });
    }`, "ComfyUI visible image");
    if (last?.visible && last?.src && last?.complete && Number(last?.naturalWidth || 0) > 0) return last;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return last || { visible: false, src: "", complete: false, naturalWidth: 0 };
}

function result(outcome, observed, interaction, target, extra = {}) {
  return { outcome, workerClaim: outcome, observed: clean(observed), interaction, target: clean(target), ...extra };
}

export function createAttendedLiveStepDrivers({ browser, client, baseUrl, runState }) {
  const drivers = new Map();

  drivers.set("sage-local-text-usable-response:ask-normal-question", async () => {
    const lessonTitle = clean(await casebookBrowserValue(client, `() => (document.querySelector('article[aria-label="Active lesson"] h1')?.textContent || '').trim()`, "active LEARN lesson"), 240);
    if (!lessonTitle) return result("uncertain", "The active LEARN lesson title could not be observed.", "observe", "Active lesson");
    const question = `In one concise sentence, what is the main idea of this lesson, "${lessonTitle}"?`;
    const filled = await browser.fillByLabel("Ask in your own words", question);
    runState.sage = { ...(runState.sage || {}), lessonTitle, question };
    return filled.ok
      ? result("pass", `A normal lesson-grounded question was visibly entered for Sage using ${filled.method}.`, "typing", "Ask in your own words")
      : result("uncertain", "Casebook could not enter the Sage lesson question through the visible composer.", "typing", "Ask in your own words");
  });

  drivers.set("sage-local-text-usable-response:invoke-selected-provider", async () => {
    const route = await browserFetchStatus({ client, pathname: "/api/ai-routing/status", label: "AI routing status" });
    const selected = route?.body?.text?.selected || route?.body?.choice?.text || "";
    const ready = route?.body?.text?.options?.ollama?.ready === true;
    runState.sage = { ...(runState.sage || {}), routeStatus: route?.body || {} };
    if (selected !== "ollama" || !ready) {
      return result("blocked", `Sage cannot run the P0 local-text Case because the selected writing route is ${selected || "unknown"} and Ollama ready=${ready}.`, "observe", "Ollama · Local");
    }
    const clicked = await browser.clickVisible("Ask the Guide");
    if (!clicked) return result("uncertain", "The visible Ask the Guide control could not be exercised.", "pointer", "Ask the Guide");
    const visible = await waitForSageVisibleAnswer({ client });
    runState.sage = { ...(runState.sage || {}), answer: visible.answer || "", relatedLessonLabels: visible.relatedLessonLabels || [] };
    return visible.ready
      ? result("pass", "The request was sent through the selected ready Ollama route and a Human-visible Guide response returned.", "pointer", "Ask the Guide")
      : result("fail", "The selected Ollama route was invoked but no completed Human-visible Guide answer appeared before the bounded timeout.", "pointer", "Ask the Guide");
  });

  drivers.set("sage-local-text-usable-response:render-answer", async () => {
    const visible = runState.sage?.answer ? { ready: true, answer: runState.sage.answer, relatedLessonLabels: runState.sage.relatedLessonLabels || [] } : await waitForSageVisibleAnswer({ client, attempts: 15 });
    runState.sage = { ...(runState.sage || {}), answer: visible.answer || "", relatedLessonLabels: visible.relatedLessonLabels || [] };
    return visible.ready
      ? result("pass", `Sage rendered a Human-visible answer (${clean(visible.answer).length} characters).`, "observe", "Persistent Creative Room")
      : result("fail", "Sage did not render a completed Human-visible answer.", "observe", "Persistent Creative Room");
  });

  drivers.set("sage-local-text-usable-response:evaluate-answer", async () => {
    const artifact = evaluateSageVisibleAnswer({
      question: runState.sage?.question,
      answer: runState.sage?.answer,
      lessonTitle: runState.sage?.lessonTitle,
      relatedLessonLabels: runState.sage?.relatedLessonLabels,
      routeStatus: runState.sage?.routeStatus,
    });
    runState.sage = { ...(runState.sage || {}), independentProof: artifact };
    return artifact.status === "verified"
      ? result("pass", artifact.summary, "evaluation", "Sage Human-visible response", { evidence: [artifact] })
      : result("fail", artifact.summary, "evaluation", "Sage Human-visible response", { evidence: [artifact] });
  });

  drivers.set("comfyui-local-image-visible:configure-comfyui", async () => {
    await browser.clickVisible("Settings");
    await clickFirstVisible({ browser, labels: ["Images Setup", "Images & Video", "Images"] });
    const observed = await casebookBrowserValue(client, `() => JSON.stringify({
      setup: Boolean(document.querySelector('[aria-label="ComfyUI connection setup"]')),
      text: (document.body.innerText || '').slice(0, 10000)
    })`, "ComfyUI setup surface");
    return observed?.setup || /Local ComfyUI connection/i.test(String(observed?.text || ""))
      ? result("pass", "The Human-visible local ComfyUI setup surface is open.", "pointer", "Images & Video")
      : result("uncertain", "Settings opened but the local ComfyUI setup surface was not found.", "pointer", "Images & Video");
  });

  drivers.set("comfyui-local-image-visible:start-or-connect", async ({ checkpoint }) => ({
    ...result("uncertain", "Waiting for Human-authorized ComfyUI Desktop/native startup before Casebook observes service readiness.", "human-authority", "Install / start local ComfyUI", { humanCheckpoint: checkpoint }),
    afterHuman: async () => {
      const status = await browserFetchStatus({ client, pathname: "/api/media-routing/status", label: "ComfyUI media status after Human approval" });
      runState.comfyui = { ...(runState.comfyui || {}), mediaStatus: status?.body || {} };
      const comfy = status?.body?.comfyui || {};
      return comfy.reachable === true
        ? result("pass", `ComfyUI is reachable at ${clean(comfy.baseUrl || "the configured local endpoint", 200)} after the Human-authorized startup boundary.`, "observe", "ComfyUI service")
        : result("blocked", `ComfyUI did not become reachable after Human authorization: ${clean(comfy.error || "no local service response")}`, "observe", "ComfyUI service");
    },
  }));

  drivers.set("comfyui-local-image-visible:verify-prerequisites", async () => {
    const status = await browserFetchStatus({ client, pathname: "/api/media-routing/status", label: "ComfyUI prerequisite status" });
    runState.comfyui = { ...(runState.comfyui || {}), mediaStatus: status?.body || {} };
    const comfy = status?.body?.comfyui || {};
    const checkpoint = clean(comfy.checkpoint || comfy.selectedCheckpoint || "", 260);
    const ready = comfy.reachable === true && comfy.imageNodesReady === true && Boolean(checkpoint);
    return ready
      ? result("pass", `ComfyUI service, required image workflow nodes, and checkpoint-backed VAE path are ready (${checkpoint}).`, "observe", "ComfyUI workflow prerequisites")
      : result("blocked", `ComfyUI prerequisites are incomplete: reachable=${comfy.reachable === true}; imageNodesReady=${comfy.imageNodesReady === true}; checkpoint=${checkpoint || "missing"}; missing=${(comfy.missingImageNodes || []).join(", ") || "none reported"}.`, "observe", "ComfyUI workflow prerequisites");
  });

  drivers.set("comfyui-local-image-visible:run-test-image", async () => {
    const clicked = await browser.clickVisible("Test image");
    if (!clicked) return result("blocked", "The ComfyUI Test image control is absent or disabled; the real generation could not be started.", "pointer", "Test image");
    const visible = await waitForVisibleComfyImage({ client });
    runState.comfyui = { ...(runState.comfyui || {}), visibleImage: visible };
    return visible.visible && visible.src
      ? result("pass", "A real ComfyUI test generation completed and PlotPickle produced a visible image element.", "pointer", "Test image")
      : result("fail", "The ComfyUI test was started but no completed visible test image appeared before the bounded timeout.", "pointer", "Test image");
  });

  drivers.set("comfyui-local-image-visible:observe-output-asset", async () => {
    const image = runState.comfyui?.visibleImage || await waitForVisibleComfyImage({ client, attempts: 10 });
    const asset = await verifyLocalImageAsset({ baseUrl, imageSrc: image?.src });
    runState.comfyui = { ...(runState.comfyui || {}), visibleImage: image, assetProof: asset };
    return asset.ok
      ? result("pass", `Independent local asset read-back succeeded (${asset.assetBytes} bytes; ${asset.contentType || "image asset"}).`, "evaluation", "Generated local image asset")
      : result("fail", asset.error || "Independent local asset read-back failed.", "evaluation", "Generated local image asset");
  });

  drivers.set("comfyui-local-image-visible:render-output", async () => {
    const image = await waitForVisibleComfyImage({ client, attempts: 10 });
    runState.comfyui = { ...(runState.comfyui || {}), visibleImage: image };
    return image.visible && image.complete && Number(image.naturalWidth || 0) > 0
      ? result("pass", `The same generated image is visibly rendered in PlotPickle (natural width ${image.naturalWidth}).`, "observe", "Generated media route connection test")
      : result("fail", "The generated asset exists but PlotPickle does not show a completed visible image.", "observe", "Generated media route connection test");
  });

  drivers.set("comfyui-local-image-visible:enable-local-route", async () => {
    const before = await browserFetchStatus({ client, pathname: "/api/ai-routing/status", label: "AI routing readiness before local selection" });
    const option = before?.body?.image?.options?.["ollama-comfyui"] || {};
    if (option.ready !== true) {
      runState.comfyui = { ...(runState.comfyui || {}), aiStatus: before?.body || {} };
      return result("fail", `Ollama + ComfyUI · Local is still not selectable after the visible image test: ${clean(option.error || "route remains Test needed")}.`, "observe", "Ollama + ComfyUI · Local");
    }
    await clickFirstVisible({ browser, labels: ["AI Routing", "LLM Routing"] });
    const selected = await browser.clickVisible("Choose Ollama + ComfyUI · Local for images", ["radio"]);
    if (!selected) return result("uncertain", "The local route is ready in the routing contract, but its visible radio control could not be exercised from Settings.", "pointer", "Ollama + ComfyUI · Local");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const after = await browserFetchStatus({ client, pathname: "/api/ai-routing/status", label: "AI routing status after local selection" });
    runState.comfyui = { ...(runState.comfyui || {}), aiStatus: after?.body || {} };
    return after?.body?.image?.selected === "ollama-comfyui"
      ? result("pass", "Ollama + ComfyUI · Local is ready, visibly selectable, and became the active image route.", "pointer", "Ollama + ComfyUI · Local")
      : result("fail", `The visible local-route selection did not persist; selected=${clean(after?.body?.image?.selected || "unknown")}.`, "pointer", "Ollama + ComfyUI · Local");
  });

  return drivers;
}

export async function finalizeAttendedLiveProof({ caseDefinition, client, baseUrl, runState }) {
  if (caseDefinition.id === "sage-local-text-usable-response") {
    return runState.sage?.independentProof || evaluateSageVisibleAnswer({
      question: runState.sage?.question,
      answer: runState.sage?.answer,
      lessonTitle: runState.sage?.lessonTitle,
      relatedLessonLabels: runState.sage?.relatedLessonLabels,
      routeStatus: runState.sage?.routeStatus,
    });
  }
  if (caseDefinition.id === "comfyui-local-image-visible") {
    const media = await browserFetchStatus({ client, pathname: "/api/media-routing/status", label: "final ComfyUI media status" });
    const ai = await browserFetchStatus({ client, pathname: "/api/ai-routing/status", label: "final AI routing status" });
    const image = runState.comfyui?.visibleImage || await waitForVisibleComfyImage({ client, attempts: 5 });
    return verifyComfyUiVisibleOutput({ baseUrl, imageSrc: image?.src, mediaStatus: media?.body || {}, aiStatus: ai?.body || {} });
  }
  return null;
}
