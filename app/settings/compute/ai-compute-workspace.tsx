"use client";

import { useEffect, useMemo, useState } from "react";
import AiRoutingPanel from "../../ai-routing-panel";
import LocalAiReadinessSummary from "../../local-ai-readiness-summary";
import LocalRuntimePanel from "../../local-runtime-panel";
import SageFastModelSetup from "../../sage-fast-model-setup";
import AiProviderSetupPanel from "../ai-provider/ai-provider-setup-panel";
import CloudModelCatalogPanel from "./cloud-model-catalog-panel";
import LocalModelCatalogPanel from "./local-model-catalog-panel";
import styles from "./ai-compute-workspace.module.css";

type ComputeMode = "local" | "cloud";
type ComputeCapability = "writing" | "images" | "video";
type ProviderTarget = "ollama" | "openai" | "minimax" | "comfyui";
type ComputeFocus = "sage-plan";

type CapabilityDefinition = {
  id: ComputeCapability;
  routingCapability: "text" | "image" | "video";
  label: string;
  localDetail: string;
  cloudDetail: string;
};

const CAPABILITIES: CapabilityDefinition[] = [
  {
    id: "writing",
    routingCapability: "text",
    label: "Writing",
    localDetail: "Use this computer for Sage, PLAN and story work.",
    cloudDetail: "Use an explicitly connected remote model for writing and planning.",
  },
  {
    id: "images",
    routingCapability: "image",
    label: "Images",
    localDetail: "Generate artwork on this computer with a verified local image route.",
    cloudDetail: "Use an explicitly connected remote image provider or compute service.",
  },
  {
    id: "video",
    routingCapability: "video",
    label: "Video",
    localDetail: "Use a supported local video route when this Node can provide one.",
    cloudDetail: "Use an explicitly connected remote video provider with the existing consent gates.",
  },
];

const LEGACY_CAPABILITY_TARGETS: Record<string, ComputeCapability> = {
  "settings-models": "writing",
  "settings-sage": "writing",
  "settings-plan": "writing",
  "settings-routing": "writing",
  "settings-ollama": "writing",
  "settings-openai": "writing",
  "settings-minimax": "writing",
  "settings-images": "images",
  "settings-video": "video",
};

function sessionKey(mode: ComputeMode) {
  return `plotpickle.settings.compute.${mode}.capability`;
}

function readInitialCapability(mode: ComputeMode): ComputeCapability {
  if (typeof window === "undefined") return "writing";
  const url = new URL(window.location.href);
  const query = url.searchParams.get("compute");
  if (CAPABILITIES.some((item) => item.id === query)) return query as ComputeCapability;
  const legacyTarget = url.hash.replace(/^#/, "").trim().toLowerCase();
  if (legacyTarget in LEGACY_CAPABILITY_TARGETS) return LEGACY_CAPABILITY_TARGETS[legacyTarget];
  const saved = window.sessionStorage.getItem(sessionKey(mode));
  return CAPABILITIES.some((item) => item.id === saved) ? saved as ComputeCapability : "writing";
}

function modeCopy(mode: ComputeMode) {
  return mode === "local"
    ? {
        eyebrow: "Settings · AI Compute",
        title: "Local Compute",
        detail: "Run AI privately on this PlotPickle Node. Start with the simple setup below; open Advanced Options only when you need model, endpoint, workflow or runtime details.",
        badge: "THIS COMPUTER",
      }
    : {
        eyebrow: "Settings · AI Compute",
        title: "Remote Compute",
        detail: "Connect a private server, managed cloud server farm, or provider cloud deliberately. PlotPickle keeps execution location separate from connection method and model/provider identity.",
        badge: "REMOTE / CLOUD",
      };
}

function RemoteExecutionGuide() {
  return (
    <section className={styles.connectionMethods} aria-labelledby="remote-execution-title">
      <header>
        <p>Where it runs</p>
        <h3 id="remote-execution-title">Choose the kind of remote compute you are connecting.</h3>
      </header>
      <div>
        <article data-available="true">
          <strong>My Private Server</strong>
          <span>A machine or LAN/server environment you control. Common connections include an OpenAI-compatible API from vLLM, llama.cpp, LM Studio or another private runtime.</span>
        </article>
        <article data-available="true">
          <strong>Cloud Server Farm</strong>
          <span>A managed GPU or inference platform such as AtlasCloud. PlotPickle connects through the farm&apos;s supported API, OpenAI-compatible endpoint or MCP service while keeping cost and data-sharing explicit.</span>
        </article>
        <article data-available="true">
          <strong>Provider Cloud</strong>
          <span>A direct model provider such as Google Gemini, OpenAI or MiniMax. PlotPickle uses the provider&apos;s supported API and never silently promotes local work to a paid route.</span>
        </article>
      </div>
    </section>
  );
}

export default function AiComputeWorkspace({ mode, focus }: { mode: ComputeMode; focus?: ComputeFocus }) {
  const [activeCapability, setActiveCapability] = useState<ComputeCapability>("writing");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [providerFocus, setProviderFocus] = useState<ProviderTarget | null>(null);
  const copy = modeCopy(mode);
  const capability = useMemo(
    () => CAPABILITIES.find((item) => item.id === activeCapability) || CAPABILITIES[0],
    [activeCapability],
  );

  useEffect(() => {
    if (focus === "sage-plan") {
      setActiveCapability("writing");
      setAdvancedOpen(true);
      setProviderFocus(null);
      return;
    }
    setActiveCapability(readInitialCapability(mode));
  }, [focus, mode]);

  function selectCapability(next: ComputeCapability) {
    setActiveCapability(next);
    setAdvancedOpen(false);
    setProviderFocus(null);
    window.sessionStorage.setItem(sessionKey(mode), next);
    const url = new URL(window.location.href);
    url.searchParams.set("compute", next);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }

  function openAdvanced(target?: ProviderTarget) {
    if (target) setProviderFocus(target);
    setAdvancedOpen(true);
    window.requestAnimationFrame(() => document.getElementById(`${mode}-compute-advanced`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function openComfyUiSetup() {
    window.dispatchEvent(new CustomEvent("plotpickle:settings-section", { detail: "comfyui" }));
  }

  function renderLocalAdvanced() {
    if (activeCapability === "writing") {
      return (
        <div className={styles.advancedStack}>
          <SageFastModelSetup />
          <LocalModelCatalogPanel />
          <details className={styles.expertDetails}>
            <summary>Expert runtime diagnostics</summary>
            <p>Inspect hardware, installed models and lower-level local runtime information. These controls reuse the existing local runtime authority.</p>
            <LocalRuntimePanel />
          </details>
        </div>
      );
    }

    return (
      <div className={styles.advancedStack}>
        <p className={styles.advancedNote}>Local Compute keeps the current ComfyUI readiness and route selection visible above. Installation, server addresses, checkpoints, workflows and live diagnostics now have one dedicated Settings screen.</p>
        <button type="button" onClick={openComfyUiSetup}>Open ComfyUI Setup</button>
      </div>
    );
  }

  function renderCloudAdvanced() {
    return (
      <div className={styles.advancedStack}>
        <section className={styles.connectionMethods} aria-labelledby="cloud-connection-methods-title">
          <header><p>How PlotPickle connects</p><h3 id="cloud-connection-methods-title">Use the connection contract the selected service supports.</h3></header>
          <div>
            <article data-available="true"><strong>Provider API</strong><span>Direct provider connections use a protected user-owned credential and the provider&apos;s supported API contract.</span></article>
            <article data-available="true"><strong>OpenAI-Compatible API</strong><span>Private servers and cloud server farms can expose one compatible endpoint without becoming an OpenAI provider.</span></article>
            <article data-available="false"><strong>MCP</strong><span>MCP is a connection mechanism for tools/services, not an AI model identity. It remains unavailable until a real MCP adapter is registered.</span></article>
          </div>
        </section>
        <CloudModelCatalogPanel capability={activeCapability} />
        <AiProviderSetupPanel provider="openai" />
        <AiProviderSetupPanel provider="minimax" />
      </div>
    );
  }

  return (
    <section className={styles.workspace} data-ai-compute-mode={mode} data-ai-compute-capability={activeCapability} data-ai-compute-focus={focus}>
      <header className={styles.hero}>
        <div><p>{copy.eyebrow}</p><h1>{copy.title}</h1><span>{copy.detail}</span></div>
        <strong>{copy.badge}</strong>
      </header>

      <nav className={styles.tabs} aria-label={`${copy.title} capabilities`}>
        {CAPABILITIES.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-current={activeCapability === item.id ? "page" : undefined}
            data-compute-tab={item.id}
            onClick={() => selectCapability(item.id)}
          >
            <strong>{item.label}</strong>
            <span>{mode === "local" ? item.localDetail : item.cloudDetail}</span>
          </button>
        ))}
      </nav>

      <section className={styles.capabilityIntro} aria-labelledby={`${mode}-${activeCapability}-title`}>
        <div>
          <p>{copy.title} · {capability.label}</p>
          <h2 id={`${mode}-${activeCapability}-title`}>{capability.label} setup</h2>
          <span>{mode === "local" ? capability.localDetail : capability.cloudDetail}</span>
        </div>
        <button type="button" onClick={() => openAdvanced()} aria-expanded={advancedOpen}>Advanced Options</button>
      </section>

      {mode === "local" && activeCapability === "writing" ? <LocalAiReadinessSummary onOpenAdvanced={() => openAdvanced()} /> : null}
      {mode === "cloud" ? <RemoteExecutionGuide /> : null}

      <AiRoutingPanel
        capability={capability.routingCapability}
        locality={mode}
        onManage={(target) => { if (target === "comfyui") openComfyUiSetup(); else openAdvanced(target); }}
      />

      <details id={`${mode}-compute-advanced`} className={styles.advanced} open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
        <summary>
          <span><strong>Advanced Options</strong><small>{mode === "local" ? "Models, runtimes and expert diagnostics" : "Provider credentials, models, endpoints and connection methods"}</small></span>
          {providerFocus ? <em>Requested: {providerFocus}</em> : null}
        </summary>
        <div className={styles.advancedBody}>
          {mode === "local" ? renderLocalAdvanced() : renderCloudAdvanced()}
        </div>
      </details>

      <footer className={styles.boundary}>
        <strong>{mode === "local" ? "Local means this Node." : "Remote describes execution location, not provider identity."}</strong>
        <span>{mode === "local"
          ? "No local failure silently promotes work to a paid provider."
          : "Private servers, cloud server farms and direct provider clouds remain separate choices; credentials and paid-use consent stay explicit."}</span>
      </footer>
    </section>
  );
}
