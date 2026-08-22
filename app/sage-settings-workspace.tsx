"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReleaseHistoryPanel from "../modules/dashboard/ui/release-history";
import AgentObservabilityPanel from "./agent-observability-panel";
import AiRoutingPanel from "./ai-routing-panel";
import BuzzLiveHealthCard from "./buzz-live-health-card";
import BuzzSettingsPanel from "./buzz-settings-panel";
import DeepSeekHarnessPanel from "./deepseek-harness-panel";
import LocalRuntimePanel from "./local-runtime-panel";
import MediaRoutingPanel from "./media-routing-panel";
import SageFastModelSetup from "./sage-fast-model-setup";
import SettingsHelperDirectory from "./settings-helper-directory";
import SettingsReadinessOverview from "./settings-readiness-overview";
import WritingAssistantConsole from "./writing-assistant-console";
import AiProviderSetupPanel from "./settings/ai-provider/ai-provider-setup-panel";
import styles from "./sage-settings-workspace.module.css";

const SETTINGS_SECTION_KEY = "plotpickle.settings.section";
const SETTINGS_QUERY_KEY = "settings";
const LEGACY_HELP_DESTINATION = { id: "settings-help", label: "Help" } as const;

type SettingsSection =
  | "overview"
  | "updates"
  | "help"
  | "sage"
  | "plan"
  | "routing"
  | "images"
  | "video"
  | "ollama"
  | "openai"
  | "minimax"
  | "buzz"
  | "activity"
  | "runtime";

type SettingsItem = {
  id: SettingsSection;
  label: string;
  detail: string;
};

type SettingsGroup = {
  label: string;
  items: SettingsItem[];
};

const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    label: "START",
    items: [
      { id: "overview", label: "Overview", detail: "What is ready and what is next" },
      { id: "updates", label: "What’s New", detail: "Latest PlotPickle releases and changes" },
      { id: "help", label: "Help", detail: "Who does what in PlotPickle" },
    ],
  },
  {
    label: "LOCAL AI",
    items: [
      { id: "sage", label: "Sage Setup", detail: "Choose, configure and test Sage" },
      { id: "plan", label: "PLAN Setup", detail: "Choose, configure and test PLAN" },
      { id: "routing", label: "LLM Routing", detail: "Choose where text AI jobs run" },
      { id: "images", label: "Images Setup", detail: "Configure and test image generation" },
      { id: "video", label: "Video Setup", detail: "Configure and test video generation" },
    ],
  },
  {
    label: "MODEL PROVIDERS",
    items: [
      { id: "ollama", label: "Ollama", detail: "Optional local OpenAI-compatible runtime" },
      { id: "openai", label: "OpenAI Cloud", detail: "Configure and verify cloud provider access" },
      { id: "minimax", label: "MiniMax Cloud", detail: "Configure and verify image/video access" },
    ],
  },
  {
    label: "COMMUNITY",
    items: [
      { id: "buzz", label: "BUZZ Setup", detail: "Relay, Guildhall and live connection test" },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { id: "activity", label: "Agent Activity", detail: "Runtime activity and health evidence" },
      { id: "runtime", label: "Advanced Runtime", detail: "Hardware, models and expert controls" },
    ],
  },
];

const ALL_SECTIONS = new Set(SETTINGS_GROUPS.flatMap((group) => group.items.map((item) => item.id)));
const LEGACY_TARGETS: Record<string, SettingsSection> = {
  "settings-quick": "overview",
  "settings-updates": "updates",
  [LEGACY_HELP_DESTINATION.id]: "help",
  "settings-models": "sage",
  "settings-sage": "sage",
  "settings-plan": "plan",
  "settings-activity": "activity",
  "settings-routing": "routing",
  "settings-ollama": "ollama",
  "settings-openai": "openai",
  "settings-minimax": "minimax",
  "settings-comfyui": "images",
  "settings-images": "images",
  "settings-video": "video",
  "settings-buzz": "buzz",
  "settings-advanced": "runtime",
  quick: "overview",
  advanced: "runtime",
  models: "sage",
  media: "images",
  comfyui: "images",
};

function normalizeSection(value: string | null | undefined): SettingsSection {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized in LEGACY_TARGETS) return LEGACY_TARGETS[normalized];
  return ALL_SECTIONS.has(normalized as SettingsSection) ? normalized as SettingsSection : "overview";
}

function requestedSection() {
  if (typeof window === "undefined") return "overview" as SettingsSection;
  const url = new URL(window.location.href);
  if (url.hash) return normalizeSection(url.hash.replace(/^#/, ""));
  const querySection = url.searchParams.get(SETTINGS_QUERY_KEY);
  if (querySection) return normalizeSection(querySection);
  return normalizeSection(window.sessionStorage.getItem(SETTINGS_SECTION_KEY));
}

function SectionIntro({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <header className={styles.sectionIntro}>
      <div><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1><p>{detail}</p></div>
    </header>
  );
}

export default function SageSettingsWorkspace() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("overview");

  const navigateSection = useCallback((section: SettingsSection, replace = false) => {
    setActiveSection(section);
    window.sessionStorage.setItem(SETTINGS_SECTION_KEY, section);
    const url = new URL(window.location.href);
    url.searchParams.set("workspace", "settings");
    url.searchParams.set(SETTINGS_QUERY_KEY, section);
    url.hash = "";
    const destination = `${url.pathname}${url.search}`;
    if (replace) window.history.replaceState({ settingsSection: section }, "", destination);
    else window.history.pushState({ settingsSection: section }, "", destination);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    const sync = () => setActiveSection(requestedSection());
    sync();
    const handleSectionRequest = (event: Event) => navigateSection(normalizeSection((event as CustomEvent<string>).detail));
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    window.addEventListener("plotpickle:settings-section", handleSectionRequest);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("plotpickle:settings-section", handleSectionRequest);
    };
  }, [navigateSection]);

  const activeItem = useMemo(
    () => SETTINGS_GROUPS.flatMap((group) => group.items).find((item) => item.id === activeSection) || SETTINGS_GROUPS[0].items[0],
    [activeSection],
  );

  function openSettingsTarget(target: string) {
    navigateSection(normalizeSection(target));
  }

  function renderSection() {
    switch (activeSection) {
      case "updates":
        return <section id="settings-updates"><SectionIntro eyebrow="Settings · Latest updates" title="What’s New in PlotPickle." detail="Review the latest user-facing release notes without interrupting the main creative workspace." /><ReleaseHistoryPanel /></section>;
      case "help":
        return <section id="settings-help"><SectionIntro eyebrow="Settings · Help" title="Meet the PlotPickle helpers." detail="Understand each helper before changing agent or runtime configuration." /><SettingsHelperDirectory /></section>;
      case "sage":
        return <section id="settings-sage"><SectionIntro eyebrow="Settings · Local AI" title="Configure and test Sage." detail="Choose Sage's local runtime and model, save it, then prove the configured model can answer before returning to LEARN." /><SageFastModelSetup /></section>;
      case "plan":
        return <section id="settings-plan"><SectionIntro eyebrow="Settings · Local AI" title="Configure and test PLAN." detail="Use the existing local model setup to verify PLAN's text generation path before asking it to build story answers." /><SageFastModelSetup /></section>;
      case "routing":
        return <section id="settings-routing"><SectionIntro eyebrow="Settings · LLM Routing" title="Choose one explicit route for each text AI job." detail="One active choice per job. Local stays local unless you deliberately select and authorize a provider route. There is no silent paid fallback." /><AiRoutingPanel /></section>;
      case "images":
        return <section id="settings-images"><SectionIntro eyebrow="Settings · Images Setup" title="Configure and test image generation." detail="ComfyUI process-running and image-ready remain separate. PlotPickle verifies the required nodes, checkpoint and workflow before the local image route is ready." /><MediaRoutingPanel onManage={openSettingsTarget} /></section>;
      case "video":
        return <section id="settings-video"><SectionIntro eyebrow="Settings · Video Setup" title="Configure and test video generation." detail="Use the existing media routing authority to select and verify the video route without creating a second runtime or provider configuration." /><MediaRoutingPanel onManage={openSettingsTarget} /></section>;
      case "ollama":
        return <section id="settings-ollama"><SectionIntro eyebrow="Settings · Model Provider" title="Configure and test Ollama." detail="Ollama is optional and no longer defines the local architecture. It remains one OpenAI-compatible local runtime option behind PlotPickle's hardware-aware local AI boundary." /><WritingAssistantConsole onManage={() => openSettingsTarget("ollama")} focusProvider="ollama" /></section>;
      case "openai":
        return <section id="settings-openai"><SectionIntro eyebrow="Settings · Model Provider" title="Configure and test OpenAI Cloud." detail="Credentials stay protected and paid calls remain explicit. Verify the provider here before selecting it as an active route." /><AiProviderSetupPanel provider="openai" /><WritingAssistantConsole onManage={() => openSettingsTarget("openai")} focusProvider="openai" /></section>;
      case "minimax":
        return <section id="settings-minimax"><SectionIntro eyebrow="Settings · Model Provider" title="Configure and test MiniMax Cloud." detail="Configure image/video provider access here; paid tests and generation continue to respect existing consent rules." /><AiProviderSetupPanel provider="minimax" /><WritingAssistantConsole onManage={() => openSettingsTarget("minimax")} focusProvider="minimax" /></section>;
      case "buzz":
        return <section id="settings-buzz"><SectionIntro eyebrow="Settings · Community" title="Configure and test BUZZ transport." detail="Profile owns the Human BUZZ identity. Settings owns relay/runtime diagnostics and the signed live round-trip test without exposing credentials." /><BuzzSettingsPanel /><BuzzLiveHealthCard /></section>;
      case "activity":
        return <section id="settings-activity"><SectionIntro eyebrow="Settings · System" title="Inspect agent activity and health." detail="Use runtime evidence to confirm what is actually running without exposing prompts, answers, credentials or hidden reasoning." /><AgentObservabilityPanel /></section>;
      case "runtime":
        return <section id="settings-advanced"><SectionIntro eyebrow="Settings · Advanced Runtime" title="Inspect hardware and expert runtime details." detail="Use these controls only when the overview or a focused setup panel says deeper runtime work is needed." /><details className={styles.advancedRuntime}><summary>Advanced runtime details</summary><p>AI provider routing is configured in the dedicated LLM Routing section above so the hardware view is not repeated. Hardware, model inventory and optional developer harness information remain here for expert diagnostics.</p><DeepSeekHarnessPanel /><LocalRuntimePanel /></details></section>;
      case "overview":
      default:
        return (
          <section id="settings-quick">
            <SectionIntro eyebrow="Settings · Overview" title="Set up PlotPickle." detail="Start with the beginner steps, then use live readiness below to see what still needs configuration or testing." />
            <section className={styles.quickGuide} aria-labelledby="settings-quick-steps">
              <h2 id="settings-quick-steps">Quick Setup</h2>
              <ol>
                <li><strong>Step 1:</strong> Configure and test Sage.</li>
                <li><strong>Step 2:</strong> Configure and test PLAN.</li>
                <li><strong>Step 3:</strong> Choose explicit LLM and media routes.</li>
                <li><strong>Step 4:</strong> Configure only the providers you intend to use.</li>
              </ol>
              <div className={styles.quickLinks}>
                <Link href="/?workspace=learn">Return to LEARN</Link>
                <Link href="/?workspace=plan">Return to PLAN</Link>
                <button type="button" onClick={() => navigateSection("sage")}>Configure Sage</button>
              </div>
            </section>
            <SettingsReadinessOverview onOpen={(section) => navigateSection(normalizeSection(section))} />
          </section>
        );
    }
  }

  return (
    <main aria-label="PlotPickle settings" className={styles.page} data-plotpickle-settings="v2" data-settings-active={activeSection}>
      <aside data-settings-rail="navigation">
        <header><p>Settings</p><h2>Configure PlotPickle</h2><span>Choose a section once. The centre changes in place while this navigation and the help rail remain visible.</span></header>
        <div className={styles.helpShortcut}><a href="#settings-help">HELP</a><a href="#settings-routing">LLM ROUTING</a></div>
        <nav aria-label="Settings categories">
          {SETTINGS_GROUPS.map((group) => (
            <section className={styles.navGroup} key={group.label} aria-label={group.label}>
              <h3>{group.label}</h3>
              {group.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-current={activeSection === item.id ? "page" : undefined}
                  data-settings-nav={item.id}
                  onClick={() => navigateSection(item.id)}
                >
                  <strong>{item.label}</strong><span>{item.detail}</span>
                </button>
              ))}
            </section>
          ))}
        </nav>
      </aside>

      <section data-settings-main aria-labelledby="settings-active-title">
        <div className={styles.activeHeading}>
          <span>Current section</span>
          <strong id="settings-active-title">{activeItem.label}</strong>
        </div>
        <section data-settings-section={activeSection} key={activeSection}>{renderSection()}</section>
      </section>

      <aside aria-label="Settings help and status" data-settings-rail="context">
        <section><p>Current section</p><h2>{activeItem.label}</h2><span>{activeItem.detail}. Configure and verify the capability here; use the left rail to move elsewhere without returning to a Settings home screen.</span></section>
        <section><p>Configure + Test</p><h3>One place for each capability.</h3><span>Where PlotPickle can verify a runtime or provider, the same section contains its setup and test controls. Results should be actionable user language rather than raw developer exceptions.</span></section>
        <section><p>Readiness</p><h3>Running is not always ready.</h3><span>PlotPickle distinguishes a reachable process from a usable capability. ComfyUI, for example, still needs required nodes, a checkpoint and the appropriate workflow before media generation is ready.</span></section>
        <section><p>Privacy</p><h3>No secret status summaries.</h3><span>The overview reads public readiness only. Credentials, private keys and hidden reasoning stay out of status cards and activity summaries.</span></section>
        <section><p>Safety</p><h3>No silent cloud fallback.</h3><small>A failed local runtime never becomes an unexpected paid request. Provider tests and paid generation keep the existing explicit consent rules.</small></section>
      </aside>
    </main>
  );
}
