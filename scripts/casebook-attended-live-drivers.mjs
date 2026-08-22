import { extractPageState, resultText } from "./creative-uat/mcp-runtime.mjs";
import {
  evaluateSageVisibleAnswer,
  verifyComfyUiVisibleOutput,
  verifyLocalImageAsset,
} from "./casebook-live-verifiers.mjs";

function casebookObservedText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
}

async function casebookBrowserValue({ client, functionSource, label }) {
  const raw = resultText(await client.call("browser_evaluate", { function: functionSource }));
  if (!String(raw || "").trim()) throw new Error(`${label} returned no browser observation.`);
  const parsed = extractPageState(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${label} did not return a structured browser observation.`);
  return parsed;
}

async function browserFetchStatus({ client, pathname, label }) {
  return casebookBrowserValue({
    client,
    label,
    functionSource: `async () => {
      const response = await fetch(${JSON.stringify(pathname)}, { cache: 'no-store' });
      const text = await response.text();
      let body = {};
      try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 500) }; }
      return JSON.stringify({ ok: response.ok, status: response.status, body });
    }`,
  });
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
    last = await casebookBrowserValue({
      client,
      label: "Sage visible answer",
      functionSource: `() => {
        const room = document.querySelector('aside[aria-label="Persistent Creative Room"]');
        if (!room) return JSON.stringify({ ready: false, answer: '', relatedLessonLabels: [] });
        const candidates = [...room.querySelectorAll('div')].flatMap((node) => {
          const strong = node.querySelector(':scope > strong');
          const paragraph = node.querySelector(':scope > p');
          if (!strong || !paragraph || (strong.textContent || '').trim() !== 'Guide') return [];
          const text = (paragraph.textContent || '').replace(/\\s+/g, ' ').trim();
          if (!text || /Thinking about your question/i.test(text) || /^You.re reading /i.test(text)) return [];
          const sources = [...node.querySelectorAll('button[aria-label^="Learn more in "]')]
            .map((button) => (button.getAttribute('aria-label') || '').trim());
          return [{ answer: text, relatedLessonLabels: sources }];
        });
        const answer = candidates.at(-1) || { answer: '', relatedLessonLabels: [] };
        return JSON.stringify({ ready: Boolean(answer.answer), ...answer });
      }`,
    });
    if (last?.ready) return last;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return last || { ready: false, answer: "", relatedLessonLabels: [] };
}

async function waitForVisibleComfyImage({ client, attempts = 180 }) {
  let last = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await casebookBrowserValue({
      client,
      label: "ComfyUI visible image",
      functionSource: `() => {
        const image = document.querySelector('img[alt="Generated media route connection test"]');
        if (!image) return JSON.stringify({ visible: false, src: '', complete: false, naturalWidth: 0 });
        const style = getComputedStyle(image);
        const visible = style.display !== 'none' && style.visibility !== 'hidden' && image.getClientRects().length > 0;
        return JSON.stringify({
          visible,
          src: image.getAttribute('src') || image.currentSrc || '',
          complete: image.complete,
          naturalWidth: image.naturalWidth || 0
        });
      }`,
    });
    if (last?.visible && last?.src && last?.complete && Number(last?.naturalWidth || 0) > 0) return last;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return last || { visible: false, src: "", complete: false, naturalWidth: 0 };
}

function attendedObservation({ outcome, observed, interaction, target, extra = {} }) {
  return {
    outcome,
    workerClaim: outcome,
    observed: casebookObservedText(observed),
    interaction,
    target: casebookObservedText(target),
    ...extra,
  };
}

export function createAttendedLiveStepDrivers({ browser, client, baseUrl, runState }) {
  const drivers = new Map();

  drivers.set("sage-local-text-usable-response:ask-normal-question", async () => {
    const lesson = await casebookBrowserValue({
      client,
      label: "active LEARN lesson",
      functionSource: `() => JSON.stringify({ value: (document.querySelector('article[aria-label="Active lesson"] h1')?.textContent || '').trim() })`,
    });
    const lessonTitle = casebookObservedText(lesson?.value).slice(0, 240);
    if (!lessonTitle) {
      return attendedObservation({ outcome: "uncertain", observed: "The active LEARN lesson title could not be observed.", interaction: "observe", target: "Active lesson" });
    }
    const question = `In one concise sentence, what is the main idea of this lesson, "${lessonTitle}"?`;
    const filled = await browser.fillByLabel("Ask in your own words", question);
    runState.sage = { ...(runState.sage || {}), lessonTitle, question };
    return filled.ok
      ? attendedObservation({ outcome: "pass", observed: `A normal lesson-grounded question was visibly entered for Sage using ${filled.method}.`, interaction: "typing", target: "Ask in your own words" })
      : attendedObservation({ outcome: "uncertain", observed: "Casebook could not enter the Sage lesson question through the visible composer.", interaction: "typing", target: "Ask in your own words" });
  });

  drivers.set("sage-local-text-usable-response:invoke-selected-provider", async () => {
    const route = await browserFetchStatus({ client, pathname: "/api/ai-routing/status", label: "AI routing status" });
    const selected = route?.body?.text?.selected || route?.body?.choice?.text || "";
    const ready = route?.body?.text?.options?.ollama?.ready === true;
    runState.sage = { ...(runState.sage || {}), routeStatus: route?.body || {} };
    if (selected !== "ollama" || !ready) {
      return attendedObservation({
        outcome: "blocked",
        observed: `Sage cannot run the P0 local-text Case because the selected writing route is ${selected || "unknown"} and Ollama ready=${ready}.`,
        interaction: "observe",
        target: "Ollama · Local",
      });
    }
    const clicked = await browser.clickVisible("Ask the Guide");
    if (!clicked) {
      return attendedObservation({ outcome: "uncertain", observed: "The visible Ask the Guide control could not be exercised.", interaction: "pointer", target: "Ask the Guide" });
    }
    const visible = await waitForSageVisibleAnswer({ client });
    runState.sage = { ...(runState.sage || {}), answer: visible.answer || "", relatedLessonLabels: visible.relatedLessonLabels || [] };
    return visible.ready
      ? attendedObservation({ outcome: "pass", observed: "The request was sent through the selected ready Ollama route and a Human-visible Guide response returned.", interaction: "pointer", target: "Ask the Guide" })
      : attendedObservation({ outcome: "fail", observed: "The selected Ollama route was invoked but no completed Human-visible Guide answer appeared before the bounded timeout.", interaction: "pointer", target: "Ask the Guide" });
  });

  drivers.set("sage-local-text-usable-response:render-answer", async () => {
    const visible = runState.sage?.answer
      ? { ready: true, answer: runState.sage.answer, relatedLessonLabels: runState.sage.relatedLessonLabels || [] }
      : await waitForSageVisibleAnswer({ client, attempts: 15 });
    runState.sage = { ...(runState.sage || {}), answer: visible.answer || "", relatedLessonLabels: visible.relatedLessonLabels || [] };
    return visible.ready
      ? attendedObservation({ outcome: "pass", observed: `Sage rendered a Human-visible answer (${casebookObservedText(visible.answer).length} characters).`, interaction: "observe", target: "Persistent Creative Room" })
      : attendedObservation({ outcome: "fail", observed: "Sage did not render a completed Human-visible answer.", interaction: "observe", target: "Persistent Creative Room" });
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
    return attendedObservation({
      outcome: artifact.status === "verified" ? "pass" : "fail",
      observed: artifact.summary,
      interaction: "evaluation",
      target: "Sage Human-visible response",
      extra: { evidence: [artifact] },
    });
  });

  drivers.set("comfyui-local-image-visible:configure-comfyui", async () => {
    await browser.clickVisible("Settings");
    await clickFirstVisible({ browser, labels: ["Images Setup", "Images & Video", "Images"] });
    const observed = await casebookBrowserValue({
      client,
      label: "ComfyUI setup surface",
      functionSource: `() => JSON.stringify({
        setup: Boolean(document.querySelector('[aria-label="ComfyUI connection setup"]')),
        text: (document.body.innerText || '').slice(0, 10000)
      })`,
    });
    return observed?.setup || /Local ComfyUI connection/i.test(String(observed?.text || ""))
      ? attendedObservation({ outcome: "pass", observed: "The Human-visible local ComfyUI setup surface is open.", interaction: "pointer", target: "Images & Video" })
      : attendedObservation({ outcome: "uncertain", observed: "Settings opened but the local ComfyUI setup surface was not found.", interaction: "pointer", target: "Images & Video" });
  });

  drivers.set("comfyui-local-image-visible:start-or-connect", async ({ checkpoint }) => ({
    ...attendedObservation({
      outcome: "uncertain",
      observed: "Waiting for Human-authorized ComfyUI Desktop/native startup before Casebook observes service readiness.",
      interaction: "human-authority",
      target: "Install / start local ComfyUI",
      extra: { humanCheckpoint: checkpoint },
    }),
    afterHuman: async () => {
      const status = await browserFetchStatus({ client, pathname: "/api/media-routing/status", label: "ComfyUI media status after Human approval" });
      runState.comfyui = { ...(runState.comfyui || {}), mediaStatus: status?.body || {} };
      const comfy = status?.body?.comfyui || {};
      return comfy.reachable === true
        ? attendedObservation({ outcome: "pass", observed: `ComfyUI is reachable at ${casebookObservedText(comfy.baseUrl || "the configured local endpoint").slice(0, 200)} after the Human-authorized startup boundary.`, interaction: "observe", target: "ComfyUI service" })
        : attendedObservation({ outcome: "blocked", observed: `ComfyUI did not become reachable after Human authorization: ${casebookObservedText(comfy.error || "no local service response")}`, interaction: "observe", target: "ComfyUI service" });
    },
  }));

  drivers.set("comfyui-local-image-visible:verify-prerequisites", async () => {
    const status = await browserFetchStatus({ client, pathname: "/api/media-routing/status", label: "ComfyUI prerequisite status" });
    runState.comfyui = { ...(runState.comfyui || {}), mediaStatus: status?.body || {} };
    const comfy = status?.body?.comfyui || {};
    const checkpoint = casebookObservedText(comfy.checkpoint || comfy.selectedCheckpoint || "").slice(0, 260);
    const ready = comfy.reachable === true && comfy.imageNodesReady === true && Boolean(checkpoint);
    return ready
      ? attendedObservation({ outcome: "pass", observed: `ComfyUI service, required image workflow nodes, and checkpoint-backed VAE path are ready (${checkpoint}).`, interaction: "observe", target: "ComfyUI workflow prerequisites" })
      : attendedObservation({ outcome: "blocked", observed: `ComfyUI prerequisites are incomplete: reachable=${comfy.reachable === true}; imageNodesReady=${comfy.imageNodesReady === true}; checkpoint=${checkpoint || "missing"}; missing=${(comfy.missingImageNodes || []).join(", ") || "none reported"}.`, interaction: "observe", target: "ComfyUI workflow prerequisites" });
  });

  drivers.set("comfyui-local-image-visible:run-test-image", async () => {
    const clicked = await browser.clickVisible("Test image");
    if (!clicked) {
      return attendedObservation({ outcome: "blocked", observed: "The ComfyUI Test image control is absent or disabled; the real generation could not be started.", interaction: "pointer", target: "Test image" });
    }
    const visible = await waitForVisibleComfyImage({ client });
    runState.comfyui = { ...(runState.comfyui || {}), visibleImage: visible };
    return visible.visible && visible.src
      ? attendedObservation({ outcome: "pass", observed: "A real ComfyUI test generation completed and PlotPickle produced a visible image element.", interaction: "pointer", target: "Test image" })
      : attendedObservation({ outcome: "fail", observed: "The ComfyUI test was started but no completed visible test image appeared before the bounded timeout.", interaction: "pointer", target: "Test image" });
  });

  drivers.set("comfyui-local-image-visible:observe-output-asset", async () => {
    const image = runState.comfyui?.visibleImage || await waitForVisibleComfyImage({ client, attempts: 10 });
    const asset = await verifyLocalImageAsset({ baseUrl, imageSrc: image?.src });
    runState.comfyui = { ...(runState.comfyui || {}), visibleImage: image, assetProof: asset };
    return asset.ok
      ? attendedObservation({ outcome: "pass", observed: `Independent local asset read-back succeeded (${asset.assetBytes} bytes; ${asset.contentType || "image asset"}).`, interaction: "evaluation", target: "Generated local image asset" })
      : attendedObservation({ outcome: "fail", observed: asset.error || "Independent local asset read-back failed.", interaction: "evaluation", target: "Generated local image asset" });
  });

  drivers.set("comfyui-local-image-visible:render-output", async () => {
    const image = await waitForVisibleComfyImage({ client, attempts: 10 });
    runState.comfyui = { ...(runState.comfyui || {}), visibleImage: image };
    return image.visible && image.complete && Number(image.naturalWidth || 0) > 0
      ? attendedObservation({ outcome: "pass", observed: `The same generated image is visibly rendered in PlotPickle (natural width ${image.naturalWidth}).`, interaction: "observe", target: "Generated media route connection test" })
      : attendedObservation({ outcome: "fail", observed: "The generated asset exists but PlotPickle does not show a completed visible image.", interaction: "observe", target: "Generated media route connection test" });
  });

  drivers.set("comfyui-local-image-visible:enable-local-route", async () => {
    const before = await browserFetchStatus({ client, pathname: "/api/ai-routing/status", label: "AI routing readiness before local selection" });
    const option = before?.body?.image?.options?.["ollama-comfyui"] || {};
    if (option.ready !== true) {
      runState.comfyui = { ...(runState.comfyui || {}), aiStatus: before?.body || {} };
      return attendedObservation({ outcome: "fail", observed: `Ollama + ComfyUI · Local is still not selectable after the visible image test: ${casebookObservedText(option.error || "route remains Test needed")}.`, interaction: "observe", target: "Ollama + ComfyUI · Local" });
    }
    await clickFirstVisible({ browser, labels: ["AI Routing", "LLM Routing"] });
    const selected = await browser.clickVisible("Choose Ollama + ComfyUI · Local for images", ["radio"]);
    if (!selected) {
      return attendedObservation({ outcome: "uncertain", observed: "The local route is ready in the routing contract, but its visible radio control could not be exercised from Settings.", interaction: "pointer", target: "Ollama + ComfyUI · Local" });
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    const after = await browserFetchStatus({ client, pathname: "/api/ai-routing/status", label: "AI routing status after local selection" });
    runState.comfyui = { ...(runState.comfyui || {}), aiStatus: after?.body || {} };
    return after?.body?.image?.selected === "ollama-comfyui"
      ? attendedObservation({ outcome: "pass", observed: "Ollama + ComfyUI · Local is ready, visibly selectable, and became the active image route.", interaction: "pointer", target: "Ollama + ComfyUI · Local" })
      : attendedObservation({ outcome: "fail", observed: `The visible local-route selection did not persist; selected=${casebookObservedText(after?.body?.image?.selected || "unknown")}.`, interaction: "pointer", target: "Ollama + ComfyUI · Local" });
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
    return verifyComfyUiVisibleOutput({
      baseUrl,
      imageSrc: image?.src,
      mediaStatus: media?.body || {},
      aiStatus: ai?.body || {},
    });
  }
  return null;
}
