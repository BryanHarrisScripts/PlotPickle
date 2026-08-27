"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReleaseHistoryPanel from "../modules/dashboard/ui/release-history";
import ArchiveStoriesPanel from "../modules/library/ui/archive-stories-panel";
import AgentObservabilityPanel from "./agent-observability-panel";
import BuzzLiveHealthCard from "./buzz-live-health-card";
import BuzzSettingsPanel from "./buzz-settings-panel";
import DeepSeekHarnessPanel from "./deepseek-harness-panel";
import LocalRuntimePanel from "./local-runtime-panel";
import MediaRoutingPanel from "./media-routing-panel";
import AiComputeWorkspace from "./settings/compute/ai-compute-workspace";
import SettingsHelperDirectory from "./settings-helper-directory";
import SettingsReadinessOverview from "./settings-readiness-overview";
import styles from "./sage-settings-workspace.module.css";

const SETTINGS_SECTION_KEY = "plotpickle.settings.section";
const SETTINGS_QUERY_KEY = "settings";
const LEGACY_HELP_DESTINATION = { id: "settings-help", label: "Help" } as const;

type SettingsSection =
  | "overview"
  | "updates"
  | "help"
  | "sage-plan"
  | "local-compute"
  | "cloud-compute"
  | "comfyui"
  | "archive"
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
    label: "AI COMPUTE",
    items: [
      { id: "sage-plan", label: "Sage & PLAN Setup", detail: "Readiness, model selection and tests for local writing AI" },
      { id: "local-compute", label: "Local Compute", detail: "Writing, images and video on this computer" },
      { id: "cloud-compute", label: "Cloud Compute", detail: "Writing, images and video through connected online services" },
      { id: "comfyui", label: "ComfyUI Setup", detail: "Install, connect and verify the local media engine" },
    ],
  },
  {
    label: "LIBRARY",
    items: [
      { id: "archive", label: "Archive", detail: "Restore stories moved out of the active Library" },
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
  "settings-local-compute": "local-compute",
  "settings-cloud-compute": "cloud-compute",
  "settings-models": "local-compute",
  "settings-sage": "sage-plan",
  "settings-plan": "sage-plan",
  "settings-activity": "activity",
  "settings-routing": "local-compute",
  "settings-ollama": "local-compute",
  "settings-openai": "cloud-compute",
  "settings-gemini": "cloud-compute",
  "settings-minimax": "cloud-compute",
  "settings-comfyui": "comfyui",
  "settings-images": "local-compute",
  "settings-video": "local-compute",
  "settings-archive": "archive",
  "settings-buzz": "buzz",
  "settings-advanced": "runtime",
  quick: "overview",
  advanced: "runtime",
  models: "local-compute",
  sage: "sage-plan",
  plan: "sage-plan",
  routing: "local-compute",
  ollama: "local-compute",
  images: "local-compute",
  video: "local-compute",
  media: "local-compute",
  comfyui: "comfyui",
  openai: "cloud-compute",
  gemini: "cloud-compute",
  minimax: "cloud-compute",
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
    if (section !== "local-compute" && section !== "cloud-compute") url.searchParams.delete("compute");
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

  function renderSection() {
    switch (activeSection) {
      case "updates":
        return <section id="settings-updates"><SectionIntro eyebrow="Settings · Latest updates" title="What’s New in PlotPickle." detail="Review the latest user-facing release notes without interrupting the main creative workspace." /><ReleaseHistoryPanel /></section>;
      case "help":
        return <section id="settings-help"><SectionIntro eyebrow="Settings · Help" title="Meet the PlotPickle helpers." detail="Understand each helper before changing agent or runtime configuration." /><SettingsHelperDirectory /></section>;
      case "sage-plan":
        return <section id="settings-sage-plan"><AiComputeWorkspace mode="local" focus="sage-plan" /></section>;
      case "local-compute":
        return <section id="settings-local-compute"><AiComputeWorkspace mode="local" /></section>;
      case "cloud-compute":
        return <section id="settings-cloud-compute"><AiComputeWorkspace mode="cloud" /></section>;
      case "comfyui":
        return <section id="settings-comfyui"><SectionIntro eyebrow="Settings · AI Compute" title="Set up ComfyUI." detail="Install, connect and verify the local image and video engine here. Local Compute continues to own route selection, while cloud providers remain separately configured in Cloud Compute." /><MediaRoutingPanel onManage={(target) => { if (/openai|minimax|cloud/i.test(target)) navigateSection("cloud-compute"); }} /></section>;
      case "archive":
        return <section id="settings-archive"><SectionIntro eyebrow="Settings · Library" title="Archive." detail="Archived stories remain the same local projects. Restore them to Library here without creating a copy or deleting the original PPF." /><ArchiveStoriesPanel /></section>;
      case "buzz":
        return <section id="settings-buzz"><SectionIntro eyebrow="Settings · Community" title="Configure and test BUZZ transport." detail="Profile owns the Human BUZZ identity. Settings owns relay/runtime diagnostics and the signed live round-trip test without exposing credentials." /><BuzzSettingsPanel /><BuzzLiveHealthCard /></section>;
      case "activity":
        return <section id="settings-activity"><SectionIntro eyebrow="Settings · System" title="Inspect agent activity and health." detail="Use runtime evidence to confirm what is actually running without exposing prompts, answers, credentials or hidden reasoning." /><AgentObservabilityPanel /></section>;
      case "runtime":
        return <section id="settings-advanced"><SectionIntro eyebrow="Settings · Advanced Runtime" title="Inspect hardware and expert runtime details." detail="Use these controls only when Local Compute, Cloud Compute or a focused setup panel says deeper runtime work is needed." /><details className={styles.advancedRuntime}><summary>Advanced runtime details</summary><p>AI provider and capability routing now live in Local Compute and Cloud Compute so hardware diagnostics are not confused with provider setup. Hardware, model inventory and optional developer harness information remain here for expert diagnostics.</p><DeepSeekHarnessPanel /><LocalRuntimePanel /></details></section>;
      case "overview":
      default:
        return (
          <section id="settings-quick">
            <SectionIntro eyebrow="Settings · Overview" title="Set up PlotPickle." detail="Choose where AI should run first. Local Compute and Cloud Compute share one capability interface, while detailed ComfyUI installation and diagnostics have their own focused setup screen." />
            <section className={styles.quickGuide} aria-labelledby="settings-quick-steps">
              <h2 id="settings-quick-steps">Quick Setup</h2>
              <ol>
                <li><strong>Step 1:</strong> Open Local Compute and test the capabilities you want to run on this computer.</li>
                <li><strong>Step 2:</strong> Open Cloud Compute only for online providers you deliberately want to connect.</li>
                <li><strong>Step 3:</strong> Use Writing, Images and Video tabs to choose one real tested route per capability.</li>
                <li><strong>Step 4:</strong> Open Advanced Options only when you need models, endpoints, workflows, credentials or expert diagnostics.</li>
              </ol>
              <div className={styles.quickLinks}>
                <Link href="/?workspace=learn">Return to LEARN</Link>
                <Link href="/?workspace=plan">Return to PLAN</Link>
                <button type="button" onClick={() => navigateSection("local-compute")}>Configure Local Compute</button>
                <button type="button" onClick={() => navigateSection("cloud-compute")}>Configure Cloud Compute</button>
                <button type="button" onClick={() => navigateSection("comfyui")}>Set up ComfyUI</button>
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
        <div className={styles.helpShortcut}><a href="#settings-help">HELP</a><a href="#settings-local-compute">AI COMPUTE</a></div>
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
        <section><p>Simple first</p><h3>One interface for Local and Cloud.</h3><span>Choose Local Compute or Cloud Compute, then use the same Writing, Images and Video tabs. Provider jargon and expert controls stay behind Advanced Options until you need them.</span></section>
        <section><p>Readiness</p><h3>Running is not always ready.</h3><span>PlotPickle distinguishes a reachable process from a usable capability. A route becomes selectable only after the existing setup and real verification boundaries say it is ready.</span></section>
        <section><p>Privacy</p><h3>No secret status summaries.</h3><span>The overview reads public readiness only. Credentials, private keys and hidden reasoning stay out of status cards and activity summaries.</span></section>
        <section><p>Safety</p><h3>No silent cloud fallback.</h3><small>A failed local runtime never becomes an unexpected paid request. Provider tests and paid generation keep the existing explicit consent rules.</small></section>
      </aside>
    </main>
  );
}
