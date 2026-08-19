"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./settings-readiness-overview.module.css";

type State = "checking" | "ready" | "attention" | "unavailable";
type LocalAiStatus = {
  ok?: boolean;
  activeRuntime?: { label?: string; reachable?: boolean };
  roles?: { fast?: { available?: boolean; selected?: string }; quality?: { available?: boolean; selected?: string } };
};
type MediaStatus = {
  imageRoute?: string;
  videoRoute?: string;
  comfyui?: { reachable?: boolean; serviceReady?: boolean; imageNodesReady?: boolean; checkpoint?: string; selectedCheckpoint?: string };
  profiles?: { openai?: { configured?: boolean }; minimax?: { configured?: boolean } };
};
type BuzzStatus = {
  connection?: { configured?: boolean; identityVerified?: boolean; community?: string };
  relay?: { reachable?: boolean };
  cli?: { available?: boolean };
  managed?: { running?: boolean; reachable?: boolean };
};

type Readiness = {
  id: string;
  label: string;
  state: State;
  summary: string;
  section: string;
  facts: Array<[string, string]>;
};

const STATE_LABELS: Record<State, string> = {
  checking: "Checking",
  ready: "Ready",
  attention: "Needs attention",
  unavailable: "Unavailable",
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store", headers: { Accept: "application/json" } });
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || `Status unavailable for ${path}`);
  return body;
}

export default function SettingsReadinessOverview({ onOpen }: { onOpen: (section: string) => void }) {
  const [localAi, setLocalAi] = useState<LocalAiStatus | null>(null);
  const [media, setMedia] = useState<MediaStatus | null>(null);
  const [buzz, setBuzz] = useState<BuzzStatus | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    setChecking(true);
    const [aiResult, mediaResult, buzzResult] = await Promise.allSettled([
      getJson<LocalAiStatus>("/api/local-ai/runtime"),
      getJson<MediaStatus>("/api/media-routing/status"),
      getJson<BuzzStatus>("/api/local-buzz/status"),
    ]);
    const failures: string[] = [];
    if (aiResult.status === "fulfilled") setLocalAi(aiResult.value); else { setLocalAi(null); failures.push("Local AI"); }
    if (mediaResult.status === "fulfilled") setMedia(mediaResult.value); else { setMedia(null); failures.push("Media"); }
    if (buzzResult.status === "fulfilled") setBuzz(buzzResult.value); else { setBuzz(null); failures.push("BUZZ"); }
    setFailed(failures);
    setChecking(false);
  }, []);

  useEffect(() => {
    void refresh();
    const handleRefresh = () => void refresh();
    window.addEventListener("plotpickle:setup-status-refresh", handleRefresh);
    window.addEventListener("plotpickle:connection-status-refresh", handleRefresh);
    return () => {
      window.removeEventListener("plotpickle:setup-status-refresh", handleRefresh);
      window.removeEventListener("plotpickle:connection-status-refresh", handleRefresh);
    };
  }, [refresh]);

  const cards = useMemo<Readiness[]>(() => {
    const runtimeReady = Boolean(localAi?.activeRuntime?.reachable);
    const sageReady = Boolean(runtimeReady && localAi?.roles?.fast?.available);
    const planReady = Boolean(runtimeReady && localAi?.roles?.quality?.available);
    const imageRoute = media?.imageRoute || "Not selected";
    const comfyReady = Boolean(media?.comfyui?.reachable && media?.comfyui?.imageNodesReady && (media?.comfyui?.checkpoint || media?.comfyui?.selectedCheckpoint));
    const imageReady = imageRoute === "manual"
      || (imageRoute === "comfyui" && comfyReady)
      || (imageRoute === "openai" && media?.profiles?.openai?.configured)
      || (imageRoute === "minimax" && media?.profiles?.minimax?.configured);
    const videoRoute = media?.videoRoute || "none";
    const videoReady = videoRoute === "none"
      ? false
      : videoRoute === "minimax-direct"
        ? Boolean(media?.profiles?.minimax?.configured)
        : Boolean(comfyReady && media?.profiles?.minimax?.configured);
    const buzzReady = Boolean(buzz?.connection?.configured && buzz?.connection?.identityVerified && buzz?.relay?.reachable && buzz?.cli?.available);

    return [
      {
        id: "sage",
        label: "Sage",
        state: !localAi ? (checking ? "checking" : "unavailable") : sageReady ? "ready" : "attention",
        summary: sageReady ? "Conversation and curriculum help have a usable local model." : "Sage still needs a reachable runtime and usable Fast model.",
        section: "models",
        facts: [["Runtime", localAi?.activeRuntime?.label || "Not detected"], ["Model", localAi?.roles?.fast?.selected || "Not selected"]],
      },
      {
        id: "plan",
        label: "PLAN",
        state: !localAi ? (checking ? "checking" : "unavailable") : planReady ? "ready" : "attention",
        summary: planReady ? "PLAN has a usable Quality model for local drafting." : "PLAN still needs a reachable runtime and usable Quality model.",
        section: "models",
        facts: [["Runtime", localAi?.activeRuntime?.label || "Not detected"], ["Model", localAi?.roles?.quality?.selected || "Not selected"]],
      },
      {
        id: "images",
        label: "Images",
        state: !media ? (checking ? "checking" : "unavailable") : imageReady ? "ready" : "attention",
        summary: imageReady ? "The selected image route has the configuration it needs." : "The selected image route still needs configuration or verification.",
        section: "media",
        facts: [["Route", imageRoute], ["ComfyUI", media?.comfyui?.reachable ? (comfyReady ? "Capability ready" : "Process reachable; capability not ready") : "Not reachable"]],
      },
      {
        id: "video",
        label: "Video",
        state: !media ? (checking ? "checking" : "unavailable") : videoRoute === "none" ? "attention" : videoReady ? "ready" : "attention",
        summary: videoRoute === "none" ? "No video route is active, which is valid until video is needed." : videoReady ? "The selected video route is configured." : "The selected video route still needs configuration or verification.",
        section: "media",
        facts: [["Route", videoRoute], ["Cloud consent", "Required only when a paid test or generation is explicitly chosen"]],
      },
      {
        id: "buzz",
        label: "BUZZ / Community",
        state: !buzz ? (checking ? "checking" : "unavailable") : buzzReady ? "ready" : "attention",
        summary: buzzReady ? "BUZZ relay, CLI and local identity are ready for signed Community work." : "BUZZ still needs a reachable relay, CLI and verified local identity.",
        section: "buzz",
        facts: [["Community", buzz?.connection?.community || "Not configured"], ["Identity", buzz?.connection?.identityVerified ? "Verified" : "Not verified"]],
      },
      {
        id: "runtime",
        label: "Local runtime",
        state: !localAi ? (checking ? "checking" : "unavailable") : runtimeReady ? "ready" : "attention",
        summary: runtimeReady ? "A local OpenAI-compatible runtime is reachable." : "No production-ready local runtime is reachable yet.",
        section: "runtime",
        facts: [["Active", localAi?.activeRuntime?.label || "None"], ["Policy", "Local-first; no silent cloud fallback"]],
      },
    ];
  }, [buzz, checking, localAi, media]);

  const next = cards.find((card) => card.state === "attention" || card.state === "unavailable");

  return (
    <section className={styles.panel} aria-labelledby="settings-readiness-title">
      <header className={styles.heading}>
        <div>
          <p>Settings overview</p>
          <h2 id="settings-readiness-title">What is ready, and what needs attention?</h2>
          <span>These statuses are read from PlotPickle's existing local runtime, media-routing and BUZZ authorities. The overview does not store a second copy of setup state.</span>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={checking}>{checking ? "Checking…" : "Refresh status"}</button>
      </header>

      <div className={styles.grid}>
        {cards.map((card) => (
          <article className={styles.card} key={card.id} data-capability={card.id}>
            <header><h3>{card.label}</h3><span className={styles.badge} data-state={card.state} role="status">{STATE_LABELS[card.state]}</span></header>
            <span>{card.summary}</span>
            <dl className={styles.meta}>{card.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <button type="button" onClick={() => onOpen(card.section)}>Configure and test {card.label}</button>
          </article>
        ))}
      </div>

      <div className={styles.next}>
        <strong>{failed.length ? `Could not read: ${failed.join(", ")}. ` : next ? `Configure next: ${next.label}. ` : "Core setup looks ready. "}</strong>
        {failed.length ? "Open the matching section for an actionable local error and retry." : next ? next.summary : "Use the left rail to revisit any section or run a verification again."}
      </div>
    </section>
  );
}