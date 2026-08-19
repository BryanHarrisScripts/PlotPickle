"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { currentMarketingReference } from "../../../core/contracts/build-progress";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import { applyStoryCommand } from "../../../core/project/apply-command";
import type { PPFProject } from "../../../core/project/project";
import {
  FOUNDATION_PROJECT_SAVED_EVENT,
  loadFoundationProject,
  saveFoundationProject,
} from "../../../core/storage/foundation-project-browser";
import {
  buildFoundationsMarketingPosterPrompt,
  buildMarqueeConversationPrompt,
  createFirstMarketingReferenceArtifact,
  deriveMarketingContextV1,
  isMarqueeDirectorUnlocked,
} from "../model/marquee-director";
import styles from "./marquee-agent-overlay.module.css";

type ActiveAgent = "sage" | "marquee";
type RoomMessage = { readonly id: string; readonly role: "writer" | "director"; readonly text: string };
type ImageRouteStatus = {
  readonly choice?: { readonly image?: string };
  readonly image?: {
    readonly selected?: string;
    readonly options?: Readonly<Record<string, {
      readonly ready?: boolean;
      readonly locality?: string;
      readonly model?: string;
      readonly error?: string;
    }>>;
  };
};
type ImageGenerationResponse = {
  readonly ok?: boolean;
  readonly assetUrl?: string;
  readonly revisedPrompt?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly message?: string;
};
type ChatResponse = {
  readonly text?: string;
  readonly model?: string;
  readonly provider?: string;
  readonly message?: string;
};

const SAGE_PORTRAIT = "/assets/curriculum-guide-master-storyteller.png";
const MARQUEE_PORTRAIT = "/assets/marquee-director-portrait.svg";

function id(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(result.message || `PlotPickle returned ${response.status}.`);
  return result;
}

export default function MarqueeAgentOverlay({ curriculum }: { readonly curriculum: readonly CurriculumLesson[] }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [project, setProject] = useState<PPFProject | null>(null);
  const [activeAgent, setActiveAgent] = useState<ActiveAgent>("sage");
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [routeStatus, setRouteStatus] = useState<ImageRouteStatus | null>(null);
  const [billingAcknowledged, setBillingAcknowledged] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const room = document.querySelector<HTMLElement>('aside[aria-label="Persistent Creative Room"]');
    if (!room) return;
    const previousPosition = room.style.position;
    room.style.position = "relative";
    setTarget(room);
    return () => {
      room.style.position = previousPosition;
    };
  }, []);

  useEffect(() => {
    const sync = () => setProject(loadFoundationProject());
    sync();
    window.addEventListener(FOUNDATION_PROJECT_SAVED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(FOUNDATION_PROJECT_SAVED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai-routing/status", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<ImageRouteStatus> : null)
      .then((value) => {
        if (!cancelled && value) setRouteStatus(value);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const unlocked = useMemo(
    () => project ? isMarqueeDirectorUnlocked(curriculum, project) : false,
    [curriculum, project],
  );
  const context = useMemo(() => project ? deriveMarketingContextV1(project) : null, [project]);
  const reference = useMemo(
    () => project ? currentMarketingReference(project.build.foundations.visualArtifacts) : null,
    [project],
  );

  useEffect(() => {
    if (!unlocked && activeAgent === "marquee") setActiveAgent("sage");
  }, [activeAgent, unlocked]);

  if (!target || !project || !context) return null;

  const selectedRoute = routeStatus?.choice?.image || routeStatus?.image?.selected || "current Settings route";
  const selectedOption = routeStatus?.image?.options?.[selectedRoute];
  const cloudRoute = selectedOption?.locality === "cloud";
  const manualRoute = selectedOption?.locality === "manual" || selectedRoute === "manual";
  const routeReady = selectedOption?.ready !== false;

  async function askDirector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || chatBusy || !unlocked) return;
    const writer: RoomMessage = { id: id("marquee-writer"), role: "writer", text };
    const prior = messages;
    setMessages((current) => [...current, writer]);
    setDraft("");
    setChatBusy(true);
    setStatus("Asking The Marquee Director…");
    try {
      const result = await postJson<ChatResponse>("/api/writing-assistant/chat", {
        agentId: "visual-director",
        tone: "collaborative",
        message: buildMarqueeConversationPrompt(context, text),
        history: prior.map((message) => ({
          role: message.role === "writer" ? "user" : "assistant",
          content: message.text,
        })),
      });
      if (!result.text?.trim()) throw new Error("The Marquee Director returned no usable reply.");
      setMessages((current) => [...current, {
        id: id("marquee-director"),
        role: "director",
        text: result.text!.trim(),
      }]);
      setStatus(`${result.provider || "configured provider"} · ${result.model || "configured model"}`);
    } catch (error) {
      setDraft(text);
      setStatus(error instanceof Error ? error.message : "The Marquee Director could not answer.");
    } finally {
      setChatBusy(false);
    }
  }

  async function generateFirstPoster() {
    if (!unlocked || generating || reference) return;
    if (manualRoute) {
      setStatus("Manual image mode is selected. Choose a configured image route in Settings before creating the Marketing Reference.");
      return;
    }
    if (!routeReady) {
      setStatus(selectedOption?.error || "The selected image route is not ready yet.");
      return;
    }
    if (cloudRoute && !billingAcknowledged) {
      setStatus("Confirm the paid image request before PlotPickle sends the first poster to the selected cloud provider.");
      return;
    }

    setGenerating(true);
    setStatus("The Marquee Director is creating the first PPF Marketing Reference poster…");
    const prompt = buildFoundationsMarketingPosterPrompt(context);
    try {
      const result = await postJson<ImageGenerationResponse>("/api/local-ai/generate/image", {
        prompt,
        assetId: `marketing-${project.id}-foundations-poster-${Date.now()}`,
        aspect: "portrait",
        requestCount: 1,
        billingAcknowledged: cloudRoute ? billingAcknowledged : false,
      });
      if (!result.ok || !result.assetUrl) throw new Error(result.message || "The image provider returned no usable poster.");
      const now = new Date().toISOString();
      const artifact = createFirstMarketingReferenceArtifact({
        id: id("marketing-reference"),
        assetUrl: result.assetUrl,
        prompt: result.revisedPrompt?.trim() || prompt,
        createdAt: now,
        provider: result.provider || selectedRoute,
        model: result.model || selectedOption?.model || "",
        context,
      });
      const next = applyStoryCommand(loadFoundationProject(), {
        type: "foundations.visual.store",
        artifact,
        occurredAt: now,
      });
      saveFoundationProject(next);
      setProject(next);
      setStatus("First poster created and automatically saved as the PPF Marketing Reference. It is marketing key art, not story canon.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The first poster could not be generated. No Marketing Reference was created.");
    } finally {
      setGenerating(false);
    }
  }

  return createPortal(
    <>
      <div className={styles.selector} aria-label="Creative Room agent selector">
        <button
          aria-label="Sage Brinewick · Curriculum Guide"
          aria-pressed={activeAgent === "sage"}
          className={styles.agentChoice}
          onClick={() => setActiveAgent("sage")}
          title="Talk with Sage Brinewick"
          type="button"
        >
          <img alt="" aria-hidden="true" src={SAGE_PORTRAIT} />Sage</button>
        <button
          aria-label={unlocked ? "Marquee · Marketing Director" : "Marquee · locked until Foundations is complete"}
          aria-pressed={activeAgent === "marquee"}
          className={styles.agentChoice}
          data-locked={unlocked ? "false" : "true"}
          disabled={!unlocked}
          onClick={() => unlocked && setActiveAgent("marquee")}
          title={unlocked ? "Talk with The Marquee Director" : "Complete Foundations to unlock"}
          type="button"
        >
          <img alt="" aria-hidden="true" src={MARQUEE_PORTRAIT} />Marquee{unlocked ? "" : " · locked"}</button>
      </div>

      {activeAgent === "marquee" ? (
        <section className={styles.panel} aria-label="The Marquee Director private project agent">
          <header className={styles.identity}>
            <img alt="The Marquee Director" src={MARQUEE_PORTRAIT} />
            <div>
              <h2>The Marquee Director</h2>
              <p>Private Key Art & Trailer Director · unlocked by completed Foundations.</p>
            </div>
          </header>

          <div className={styles.thread} aria-live="polite">
            <div className={styles.message}>
              <strong>Marquee Director</strong>
              <p>Foundations is complete, so I can now work from its accepted story and visual evidence. At this stage we make one first poster. PlotPickle saves it automatically as the PPF Marketing Reference; it does not become story canon.</p>
            </div>

            {messages.map((message) => (
              <div className={message.role === "writer" ? styles.writerMessage : styles.message} key={message.id}>
                <strong>{message.role === "writer" ? "You" : "Marquee Director"}</strong>
                <p>{message.text}</p>
              </div>
            ))}

            {reference ? (
              <figure className={styles.reference} data-marketing-reference="current">
                <strong>PPF Marketing Reference</strong>
                <img alt={`Marketing Reference poster for ${project.title}`} src={reference.assetUrl} />
                <p>This is the current visual marketing anchor. It is not story canon.</p>
                <small>{reference.provider || selectedRoute} · {reference.model || "configured model"} · {reference.workflow}</small>
                <small>Later curriculum stages can unlock additional posters and selection. This stage intentionally has no approve, reject or regenerate control.</small>
              </figure>
            ) : (
              <div className={styles.generate}>
                <div className={styles.message}>
                  <strong>First poster</strong>
                  <p>One poster will be generated from the completed Foundations Marketing Context and immediately stored as the project's Marketing Reference.</p>
                </div>
                {cloudRoute ? (
                  <label className={styles.consent}>
                    <input checked={billingAcknowledged} onChange={(event) => setBillingAcknowledged(event.target.checked)} type="checkbox" />
                    I understand this sends one paid image request through my selected cloud provider.
                  </label>
                ) : null}
                <button disabled={generating || manualRoute || !routeReady} onClick={() => void generateFirstPoster()} type="button">
                  {generating ? "Creating first poster…" : "Create first poster"}
                </button>
              </div>
            )}
          </div>

          {status ? <p className={styles.status} role="status">{status}</p> : null}

          <form className={styles.composer} onSubmit={askDirector}>
            <textarea
              aria-label="Message The Marquee Director"
              disabled={chatBusy}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about the story's first marketing impression…"
              rows={3}
              value={draft}
            />
            <button disabled={chatBusy || !draft.trim()} type="submit">Send to Marquee Director</button>
          </form>
        </section>
      ) : null}
    </>,
    target,
  );
}
