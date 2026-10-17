"use client";

import { authenticatedComputeFetch as fetch } from "../../core/auth/profile-request-browser";

import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { authenticatedProfileFetch } from "../../core/auth/profile-request-browser";
import { createConnectionCommandSession, parseConnectionCommand } from "../_components/settings/connection-command.mjs";
import { splitConnectionConfirmationPreview } from "../_components/settings/connection-confirmation-presentation.mjs";
import { createAgentHealthCommandSession, parseAgentHealthCommand } from "../../core/agents/health/command.mjs";
import { createCmdSourceProposalSession, parseCmdSourceProposal } from "../../core/contracts/imported-screenplay-evidence/cmd-source-proposal.mjs";
import { buildStoryDevelopmentFields } from "../../modules/learn/model/story-development-fields";
import { writeStoryDevelopmentFieldProposal } from "../../core/project/story-development";
import { plotPickleCurriculum } from "../../adapters/curriculum/current-catalog";
import { isPublicWebPath } from "../public-web-route";
import VoiceInputControl from "../_components/voice-input-control";
import { OPENPENCIL_COMMAND_HELP, parseOpenPencilCommand } from "../_components/settings/openpencil-command";
import { findCmdSlashSuggestions } from "../_components/settings/cmd-slash-commands.mjs";
import { parsePlotPickleCreativeCommand, describePlotPickleCreativeCommand, executePlotPickleLibraryOpen, executePlotPickleLibraryRename, inspectPlotPickleLibraryProject } from "../_components/settings/plotpickle-creative-command.mjs";
import { loadActiveLibraryProject, sessionActiveProjectId, listHumanLibraryProjects, listPersistableLibraryProjects, loadLibraryProjectSnapshot, switchActiveLibraryProject, saveActiveLibraryProject, PROJECT_LIBRARY_ACTIVE_PROFILE_KEY } from "../../core/storage/project-library-browser";
import { persistActiveProfileProject, flushProfilePrivateWrites, profilePrivateBrowserReadyFor } from "../../core/storage/profile-private-browser";
import { currentOutlineAssessment } from "../../modules/plan/outline-agent-assessment";
import { changeOutlineTask, readOutlineTasks, importOutlineTaskFindings } from "../../modules/plan/assessments/outline-task-browser";
import { selectCurrentOutlineTask, describeOutlineTaskDiagnostic } from "../../modules/plan/assessments/outline-task-selection";
import { outlineAssessmentMaterialReceipt } from "../../modules/plan/outline-agent-assessment";
import { saveFoundationProjectDurably } from "../../core/storage/project-library/revision-safe-browser";
import { captureOpenPencilTimelineSnapshot } from "./openpencil-design-snapshot";
import styles from "./global-dsdd-conversation.module.css";

type DsddContext = {
  route: string;
  surfaceId: string;
  surfaceLabel: string;
  capturedAt: string;
};

type DsddInputMode = "typed" | "voice";

type DsddMessage = {
  id: string;
  role: "human" | "dsdd" | "command" | "tool";
  text: string;
  context?: DsddContext;
  provider?: string;
  model?: string;
  inputMode?: DsddInputMode;
};

type TextResponse = {
  ok?: boolean;
  text?: string;
  message?: string;
  provider?: string;
  model?: string;
};

type DsddDeveloperBrief = {
  state: "ready";
  generatedAt: string;
  reviewer: "pi";
  piVersion: string;
  model: string;
  runtime: string;
  tools: ["read", "grep", "find", "ls"];
  repositoryMutation: false;
  text: string;
};

type DsddPublishedIssue = {
  repository: "BryanHarrisScripts/PlotPickle";
  number: number;
  title: string;
  url: string;
  publishedAt: string;
};

type OpenPencilPendingDesignSession = {
  sessionId: string;
  surface: string;
  finalizing: boolean;
  closeCheckAttempts: number;
};

type DsddLockedIntent = {
  version: number;
  locked: true;
  humanEntryId: string;
  inputMode?: DsddInputMode;
  understoodMeaning: string;
  requirements: Array<{ id: string; text: string; status: "PASS" | "FAIL" | "BLOCKED" | "UNPROVEN" }>;
  handoffPacket?: { id: string; intentDigest: string };
  developerBrief?: DsddDeveloperBrief;
  publishedIssue?: DsddPublishedIssue;
};

type ConversationalUatFinding = {
  fingerprint: string;
  head: string;
  surfaceId: string;
  route?: string;
  expected: string;
  observed: string;
  expectationSource: string;
  expectationRef: string;
  evidenceRefs?: string[];
  safeNavigationTarget?: string;
  state: "candidate" | "human-confirmed" | "human-rejected" | "unproven";
  humanDecision?: { answer: "Y" | "N"; at: string } | null;
  handoffState?: "published";
  publishedIssue?: DsddPublishedIssue;
};

type ConversationalUatState = {
  sessionId: string;
  head: string;
  runtime: "option-3";
  findings: ConversationalUatFinding[];
};

type DsddSessionPayload = {
  ok?: boolean;
  message?: string;
  uat?: ConversationalUatState;
  session?: {
    conversation?: Array<DsddMessage & { recordedAt?: string }>;
    intents?: DsddLockedIntent[];
  };
  intent?: DsddLockedIntent;
};

const MAX_MESSAGES = 40;
const MAX_INTERPRETATION_CHARS = 6000;

const DSDD_INSTRUCTIONS = [
  "You are PlotPickle's DSDD Conversational UAT interpreter.",
  "Your job is to preserve the Human's meaning while they narrate problems in the running software.",
  "Do not claim that code was changed, fixed, tested, committed, or merged.",
  "Do not redesign the product unless the Human explicitly asks for a different outcome.",
  "Interpret the Human's language as business/user intent first, not as an implementation command.",
  "Return a concise product interpretation under 1200 characters.",
  "Use at most five short bullets across expected outcome, observed behavior, constraints, and testable requirements.",
  "Microphone-originated narration is always actionable. Never conclude that no action or no change is required for microphone dictation.",
  "For typed narration only, if the Human explicitly says there is no problem and no development change is required, reply exactly: Understood. This is not a problem and no development action is required. I’ll retain it as a UAT observation.",
  "No-action is a Human declaration, never your conclusion.",
  "Do not invite Pi Draft when no development action is required. This state is valid only when a typed Human explicitly declared it; microphone narration never enters this state.",
  "If one material ambiguity prevents a deterministic requirement, ask at most one focused question.",
  "Otherwise state that the intent is ready for Human review before Pi Draft.",
  "Treat route and surface metadata as context only. Never invent private screen content that is not in the prompt.",
  "Do not reveal hidden reasoning or chain-of-thought.",
].join(" ");

function messageId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}`;
}

function boundedInterpretation(value: string) {
  const normalized = value.trim();
  if (normalized.length <= MAX_INTERPRETATION_CHARS) return normalized;
  const marker = "\n\n[DSDD interpretation bounded for session persistence.]";
  return normalized.slice(0, MAX_INTERPRETATION_CHARS - marker.length).trimEnd() + marker;
}

const NO_DEVELOPMENT_ACTION_PATTERN = /no (?:development )?(?:action|change) (?:is )?required|no development action is required/iu;

function loopbackHost() {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(window.location.hostname);
}

function visible(element: HTMLElement | null) {
  if (!element || !element.isConnected || element.getClientRects().length === 0) return false;
  return window.getComputedStyle(element).visibility !== "hidden";
}

function safeFindingCheckpoint() {
  const active = document.activeElement as HTMLElement | null;
  if (active?.matches("input, textarea, select, [contenteditable='true']")) return false;
  return !document.querySelector(
    '[aria-busy="true"], [data-generation-pending="true"], [data-destructive-confirmation="true"], [data-provider-key-entry="true"]',
  );
}

function currentSurfaceContext(pathname: string): DsddContext {
  const orchestrated = Array.from(document.querySelectorAll<HTMLElement>(
    '[data-skin-v1-orchestrator-active="true"][data-skin-v1-surface-id]',
  )).find(visible);
  const experience = Array.from(document.querySelectorAll<HTMLElement>("[data-experience-surface]")).find(visible);
  const headers = Array.from(document.querySelectorAll<HTMLElement>('[data-skin-v1-standard-header="true"]')).filter(visible);
  const header = headers.at(-1) ?? null;
  const spans = header?.querySelectorAll<HTMLSpanElement>("span");
  const surfaceLabel = spans?.item(0)?.textContent?.trim()
    || orchestrated?.dataset.skinV1SurfaceId
    || experience?.dataset.experienceSurface
    || "PLOTPICKLE";

  return {
    route: pathname || window.location.pathname || "/",
    surfaceId: orchestrated?.dataset.skinV1SurfaceId
      || experience?.dataset.experienceSurface
      || "UNKNOWN",
    surfaceLabel,
    capturedAt: new Date().toISOString(),
  };
}

function contextPrompt(context: DsddContext) {
  return [
    "CURRENT PLOTPICKLE CONTEXT",
    `Route: ${context.route}`,
    `Surface ID: ${context.surfaceId}`,
    `Surface label: ${context.surfaceLabel}`,
  ].join("\n");
}

function conversationPrompt(messages: DsddMessage[], context: DsddContext, submitted: string, inputMode: DsddInputMode) {
  const priorHuman = messages
    .filter((message) => message.role === "human")
    .slice(-4)
    .map((message) => `Human: ${message.text.slice(0, 1800)}`)
    .join("\n\n");
  const inputDirective = inputMode === "voice"
    ? "INPUT MODE: MICROPHONE DICTATION. This narration is actionable. Do not return a no-action or no-change interpretation."
    : "INPUT MODE: TYPED. A no-action interpretation is allowed only when the Human explicitly typed that no change/action is needed.";

  return [
    contextPrompt(context),
    "",
    priorHuman ? "PRIOR HUMAN NARRATION (context only)\n" + priorHuman : "",
    "",
    inputDirective,
    "",
    "NEW HUMAN NARRATION — AUTHORITATIVE FOR THIS CYCLE",
    submitted,
    "",
    "Respond as the DSDD Conversational UAT interpreter. Preserve meaning; do not claim implementation work.",
  ].filter(Boolean).join("\n");
}

export default function GlobalDsddConversation({ embedded = false }: { readonly embedded?: boolean } = {}) {
  const sessionApi = embedded ? "/api/dsdd/command" : "/api/dsdd/session";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [runtimeEligible, setRuntimeEligible] = useState(false);
  const [context, setContext] = useState<DsddContext | null>(null);
  const [messages, setMessages] = useState<DsddMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashSelection, setSlashSelection] = useState(0);
  const [draftHasVoice, setDraftHasVoice] = useState(false);
  const [activeInputMode, setActiveInputMode] = useState<DsddInputMode>("typed");
  const [working, setWorking] = useState(false);
  const [commandWorking, setCommandWorking] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [lockedIntent, setLockedIntent] = useState<DsddLockedIntent | null>(null);
  const [piDrafting, setPiDrafting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validatingFinding, setValidatingFinding] = useState(false);
  const [uat, setUat] = useState<ConversationalUatState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const narrationRef = useRef<HTMLTextAreaElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const previousJourneyRef = useRef<DsddContext | null>(null);
  const openPencilDesignSessionRef = useRef<OpenPencilPendingDesignSession | null>(null);
  const busy = clearing || working || commandWorking || piDrafting || publishing || validatingFinding;
  const slashSuggestions = useMemo(() => embedded && slashOpen ? findCmdSlashSuggestions(draft) : [], [embedded, slashOpen, draft]);
  const activeSlashIndex = Math.min(slashSelection, Math.max(0, slashSuggestions.length - 1));

  function chooseSlashCommand(command: string) {
    setDraft(`/${command}`);
    setDraftHasVoice(false);
    setSlashOpen(false);
    setSlashSelection(0);
    setError("");
    narrationRef.current?.focus();
  }
  const latestHumanIndex = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "human") return index;
    }
    return -1;
  }, [messages]);
  const latestInterpretation = useMemo(() => {
    for (let index = messages.length - 1; index > latestHumanIndex; index -= 1) {
      if (messages[index].role === "dsdd") return messages[index].text;
    }
    return "";
  }, [messages, latestHumanIndex]);
  const hasInterpretation = Boolean(latestInterpretation);
  const noActionRequired = activeInputMode === "typed" && NO_DEVELOPMENT_ACTION_PATTERN.test(latestInterpretation);
  const piDraftReady = Boolean(lockedIntent?.developerBrief);
  const briefPublished = Boolean(lockedIntent?.publishedIssue);
  const interpretStep = working ? "active" : hasInterpretation ? "complete" : draft.trim() ? "active" : "locked";
  const piDraftStep = piDrafting ? "active" : piDraftReady ? "complete" : hasInterpretation && !noActionRequired ? "active" : "locked";
  const publishStep = publishing ? "active" : briefPublished ? "complete" : piDraftReady ? "active" : "locked";
  const pendingFindings = useMemo(() => uat?.findings?.filter((finding) => finding.state === "candidate") || [], [uat]);
  const activeFinding = pendingFindings[0] || null;

  useEffect(() => {
    const refresh = () => {
      if (!loopbackHost() || isPublicWebPath(pathname)) {
        setEligible(false);
        return;
      }
      const next = currentSurfaceContext(pathname);
      const logonVisible = Boolean(document.querySelector<HTMLElement>(
        '[data-experience-surface="LOGON"][data-skin-v1-logon-state], [data-experience-surface="LOGON"]',
      ));
      setContext(next);
      setEligible(!logonVisible && next.surfaceId !== "LOGON" && (embedded || !document.querySelector("[data-settings-command]")));
    };

    refresh();
    let frame = 0;
    const scheduleRefresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(refresh);
    };
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "data-experience-surface",
        "data-skin-v1-orchestrator-active",
        "data-skin-v1-surface-id",
      ],
    });
    window.addEventListener("popstate", scheduleRefresh);
    window.addEventListener("plotpickle:return-dashboard", scheduleRefresh);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", scheduleRefresh);
      window.removeEventListener("plotpickle:return-dashboard", scheduleRefresh);
    };
  }, [pathname, embedded]);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages, lockedIntent?.developerBrief?.text, open]);

  useEffect(() => {
    if (!eligible || hydrated) return;
    let cancelled = false;
    void authenticatedProfileFetch(sessionApi, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as DsddSessionPayload;
        if (!response.ok || !body.ok) throw new Error(body.message || "DSDD session could not be restored.");
        if (cancelled) return;
        setRuntimeEligible(true);
        setUat(body.uat || null);
        const conversation = Array.isArray(body.session?.conversation) ? body.session!.conversation! : [];
        const restoredMessages = conversation.slice(-MAX_MESSAGES).map((entry) => ({
          id: entry.id,
          role: entry.role,
          text: entry.text,
          context: entry.context,
          provider: entry.provider,
          model: entry.model,
          inputMode: entry.inputMode,
        }));
        setMessages(restoredMessages);
        const intents = Array.isArray(body.session?.intents) ? body.session!.intents! : [];
        const latestHuman = [...restoredMessages].reverse().find((entry) => entry.role === "human");
        const latestIntent = intents.at(-1) || null;
        setLockedIntent(latestIntent && latestHuman?.id === latestIntent.humanEntryId ? latestIntent : null);
        setActiveInputMode(latestHuman?.inputMode === "voice" ? "voice" : "typed");
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) {
          setRuntimeEligible(false);
          setHydrated(true);
        }
      });
    return () => { cancelled = true; };
  }, [eligible, hydrated, sessionApi]);

  useEffect(() => {
    if (!eligible || !runtimeEligible) setOpen(false);
    else if (embedded) setOpen(true);
  }, [eligible, runtimeEligible, embedded]);

  useEffect(() => {
    if (embedded || !eligible || !runtimeEligible || !hydrated) return;
    const refresh = () => {
      void authenticatedProfileFetch(sessionApi, { cache: "no-store" })
        .then(async (response) => {
          const body = await response.json() as DsddSessionPayload;
          if (response.ok && body.ok && body.uat) setUat(body.uat);
        })
        .catch(() => {});
    };
    const timer = window.setInterval(refresh, 4000);
    return () => window.clearInterval(timer);
  }, [eligible, runtimeEligible, hydrated, embedded, sessionApi]);

  useEffect(() => {
    if (embedded || !eligible || !runtimeEligible || !context) return;
    const previous = previousJourneyRef.current;
    previousJourneyRef.current = context;
    if (!previous || (previous.surfaceId === context.surfaceId && previous.route === context.route)) return;
    const timer = window.setTimeout(() => {
      if (!safeFindingCheckpoint()) return;
      void authenticatedProfileFetch(sessionApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "observe-journey",
          event: {
            from: previous.surfaceId,
            to: context.surfaceId,
            actionId: `nav.${previous.surfaceId.toLowerCase()}.${context.surfaceId.toLowerCase()}`,
          },
        }),
      }).catch(() => {});
    }, 900);
    return () => window.clearTimeout(timer);
  }, [eligible, runtimeEligible, context]);

  useEffect(() => {
    if (!activeFinding || busy || draft.trim() || open) return;
    const timer = window.setTimeout(() => {
      if (safeFindingCheckpoint()) setOpen(true);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [activeFinding, busy, draft, open]);

  useEffect(() => {
    if (!open || !activeFinding || busy) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!safeFindingCheckpoint()) return;
      const key = event.key.toUpperCase();
      if (key !== "Y" && key !== "N") return;
      event.preventDefault();
      void validateFinding(key as "Y" | "N");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, activeFinding, busy]);

  useEffect(() => {
    if (!embedded || !eligible || !runtimeEligible) return;
    const finalize = () => {
      const pending = openPencilDesignSessionRef.current;
      if (!pending || pending.finalizing) return;
      pending.finalizing = true;
      const snapshot = currentSurfaceContext(pathname);
      void authenticatedProfileFetch("/api/openpencil/gui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finalize",
          surfaceName: pending.surface,
          sessionId: pending.sessionId,
        }),
      }).then(async (response) => {
        const body = await response.json() as {
          ok?: boolean;
          result?: {
            state?: "editing" | "unchanged" | "published" | "failed" | "missing";
            message?: string;
            issueNumber?: number;
            issueUrl?: string;
          };
          message?: string;
        };
        if (!response.ok || !body.ok || !body.result) throw new Error(body.message || "OpenPencil design review could not be finalized.");
        if (body.result.state === "editing") {
          pending.finalizing = false;
          if (pending.closeCheckAttempts < 6) {
            pending.closeCheckAttempts += 1;
            window.setTimeout(() => {
              if (openPencilDesignSessionRef.current === pending) finalize();
            }, 750);
          } else {
            pending.closeCheckAttempts = 0;
          }
          return;
        }
        openPencilDesignSessionRef.current = null;
        setMessages((current) => [...current, {
          id: messageId(body.result.state === "published" ? "openpencil-design-published" : "openpencil-design-finalized"),
          role: "tool",
          text: body.result.message || "OpenPencil design session finalized.",
          context: snapshot,
        }].slice(-MAX_MESSAGES));
      }).catch((cause) => {
        openPencilDesignSessionRef.current = null;
        setMessages((current) => [...current, {
          id: messageId("openpencil-design-publish-error"),
          role: "tool",
          text: cause instanceof Error ? cause.message : "OpenPencil design review could not be published.",
          context: snapshot,
        }].slice(-MAX_MESSAGES));
      });
    };
    window.addEventListener("focus", finalize);
    return () => window.removeEventListener("focus", finalize);
  }, [embedded, eligible, runtimeEligible, pathname]);

  const currentLabel = useMemo(
    () => context ? `${context.surfaceLabel} · ${context.route}` : "Detecting current surface…",
    [context],
  );

  async function clearConsole() {
    if (busy) return;
    setClearing(true);
    setError("");
    try {
      const response = await authenticatedProfileFetch(sessionApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear-conversation" }),
      });
      const result = await response.json() as DsddSessionPayload;
      if (!response.ok || !result.ok) throw new Error(result.message || "Could not clear the console.");
      connectionSession.current = null;
      setMessages([]);
      setLockedIntent(null);
      setConfirmClear(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not clear the console.");
    } finally {
      setClearing(false);
    }
  }

  async function runCreativeLibraryCommand(submitted: string) {
    if (!embedded) return false;
    const command = parsePlotPickleCreativeCommand(submitted);
    if (command?.action !== "open" && command?.action !== "library" && command?.action !== "rename" && command?.action !== "confirm-rename" && command?.action !== "inspect") return false;
    const snapshot = currentSurfaceContext(pathname);
    setMessages((current) => [...current, {
      id: messageId("creative-library-human"),
      role: "command",
      text: submitted,
      context: snapshot,
      inputMode: draftHasVoice ? "voice" : "typed",
    }].slice(-MAX_MESSAGES));
    setDraft("");
    setDraftHasVoice(false);
    setError("");
    setCommandWorking(true);
    setContext(snapshot);
    try {
      const profileId = () => window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) || "";
      const services = {
        profileReady: () => profilePrivateBrowserReadyFor(profileId()),
        profileId,
        listInventory: listPersistableLibraryProjects,
        listProjects: listHumanLibraryProjects,
        activeProjectId: sessionActiveProjectId,
        readSnapshot: loadLibraryProjectSnapshot,
        switchProject: switchActiveLibraryProject,
        saveProject: saveActiveLibraryProject,
        persistProject: (projectId?: string) => persistActiveProfileProject("", projectId || ""),
        flushWrites: flushProfilePrivateWrites,
        loadActiveProject: loadActiveLibraryProject,
        currentAssessment: (project: Parameters<typeof currentOutlineAssessment>[0], blockNumber: number) =>
          Boolean(currentOutlineAssessment(project, blockNumber)),
      };
      const result = command.action === "inspect"
        ? inspectPlotPickleLibraryProject(command, services)
        : command.action === "rename" || command.action === "confirm-rename"
          ? await executePlotPickleLibraryRename(command, services)
          : await executePlotPickleLibraryOpen(command, services);
      setMessages((current) => [...current, {
        id: messageId("creative-library-result"),
        role: "tool",
        text: result || "BLOCKED: The requested saved PPF was not opened.",
        context: snapshot,
      }].slice(-MAX_MESSAGES));
    } catch (cause) {
      setMessages((current) => [...current, {
        id: messageId("creative-library-error"),
        role: "tool",
        text: "BLOCKED: Library selection could not be verified: "
          + (cause instanceof Error ? cause.message : "unknown error"),
        context: snapshot,
      }].slice(-MAX_MESSAGES));
    } finally {
      setCommandWorking(false);
    }
    return true;
  }

  // The scheduler and its checkpoints are the existing authenticated Story
  // Architect host; Command never makes a provider request or invents a result.
  async function reconcileStoryArchitectBlock(projectId: string, blockNumber: number, production = false, pinnedRunId?: string): Promise<{ ongoing: boolean; text: string }> {
    const activeId = sessionActiveProjectId();
    if (activeId !== projectId) return { ongoing: false, text: "BLOCKED: Selected Library project changed. Protected findings remain in their owning task." };
    const project = loadActiveLibraryProject();
    if (project.id !== projectId) return { ongoing: false, text: "BLOCKED: Saved project does not match the selected session." };
    const currentReceipt = await outlineAssessmentMaterialReceipt(project);
    const task = selectCurrentOutlineTask(await readOutlineTasks(), {
      projectId, contextReceipt: currentReceipt, blockNumber, production, pinnedRunId,
    });
    if (!task) return { ongoing: false, text: "NO TASK: No matching current-material Story Architect review has started for Block "
      + String(blockNumber).padStart(2, "0") + ". No inference or import occurred." };
    if (!(production ? ["local", "ollama", "openai"] : ["local", "ollama"]).includes(task.scope.provider)) return {
      ongoing: false, text: "BLOCKED: This existing assessment is not the explicitly authorized local-only route. No candidate was imported or cloud call started.",
    };
    if (task.proposals.length) {
      const next = await importOutlineTaskFindings(project, task);
      if (next !== project) {
        if (sessionActiveProjectId() !== projectId
            || loadActiveLibraryProject().revision !== project.revision) throw new Error("Selected PPF changed before advisory findings could be saved.");
        await saveFoundationProjectDurably(next, project.revision);
      }
    }
    const packet = task.productionPass;
    if (production && packet) {
      const grantExpired = Date.parse(packet.grant.expiresAt) <= Date.now();
      const reportedAttempts = task.attempts.filter((attempt) => attempt.status === "reported").length;
      const reservedAttempts = task.attempts.length - reportedAttempts;
      const candidate = packet.candidate;
      const reviewGate = task.error ? null : task.reviewGate;
      const findings = packet.review?.findings.map(f => f.dimension + ": " + f.state + " — " + f.reason + " [" + f.passageIds.join(", ") + "]").join("\n") || "Semantic review has not completed.";
      const proposals = candidate?.miniBlocks.map(m => "Mini-Block " + blockNumber + "." + m.ordinal + ": " + m.visualQuestion
        + "\nSource: " + m.passageIds.join(", ") + "; exact dialogue references: " + (m.dialoguePassageIds.join(", ") || "none")).join("\n\n") || "No production candidate is ready.";
      return { ongoing: task.running, text: "PRODUCTION PASS · " + (task.run.state === "waiting-for-writer" && candidate ? "CANDIDATE READY" : reviewGate ? "SOURCE REVIEW REQUIRED — CANDIDATE WITHHELD" : task.error || packet.review && !candidate ? "BLOCKED" : task.running ? "EXECUTING" : task.run.state === "cancelled" ? "CANCELLED" : "PAUSED / RECOVERY REQUIRED")
        + "\nProject: " + project.title + " · task " + task.scope.runId + " · model " + task.scope.model
        + "\nModel reservations: " + task.attempts.length + "/2; usage-confirmed attempts: " + reportedAttempts + "; outstanding reservations: " + reservedAttempts
        + ". Actual provider dispatch/charge cannot be inferred from a reservation. Source-bound assessment artifacts: " + task.proposals.length
        + ". Grant expires " + packet.grant.expiresAt + (grantExpired ? " (EXPIRED)" : " (current)") + "; token ceiling " + task.run.limits.maxTokens
        + "; host cloud-cost reservation ceiling $" + task.run.limits.maxCloudCostUsd
        + ". Candidate packet: " + (candidate ? "saved in encrypted owning task" : "not ready")
        + "\n" + (task.error || (reviewGate ? "Assessment and separate semantic review saved. " + reviewGate.blockers.join(" ") : "")) + "\n" + findings + "\n\n" + proposals
        + "\nTiming follows action/dialogue; no film runtime inferred. Findings are advisory model judgments, not proof of dramatic quality. No Human Plan acceptance, locks, screenplay edits, paid media or playable export."
        + (reviewGate ? "\nNext: Review the saved structural, character, Mini-Block and semantic findings against this Block's original source. Resolve unsupported interpretations through explicit review; no automatic rewrite, acceptance or inference retry. Read-only: PlotPickle production Block " + blockNumber + "."
          + (grantExpired ? " The existing task grant has expired; RESUME is not available. Saved findings remain reviewable." : " No new model call is needed to inspect these findings.")
          : grantExpired ? "\nRecovery: The existing task grant has expired; RESUME is not available. Preserve this record for diagnosis; do not start another pass until the fault is understood."
          : task.run.state === "cancelled" ? "\nRecovery: This task is cancelled. Use production status for read-only history; resume is not permitted."
            : "\nRecovery: PlotPickle production Block " + blockNumber + " (read-only); PlotPickle resume-production Block " + blockNumber + " (explicit action only); PlotPickle cancel-production Block " + blockNumber + " (explicit action only). Do not retry an unexplained scheduler fault.") };
    }
    const confirmed = loadActiveLibraryProject();
    const accepted = Boolean(currentOutlineAssessment(confirmed, blockNumber));
    const done = task.run.state === "waiting-for-writer" && task.proposals.length === 1 && accepted;
    const label = "Story Architect Block " + String(blockNumber).padStart(2, "0") + ": ";
    if (task.error) return { ongoing: false, text: label + "BLOCKED: " + task.error
      + ". " + task.proposals.length + "/1 protected result(s); current advisory finding " + (accepted ? "saved" : "not saved")
      + ". The task did not prove completion." };
    if (done) return { ongoing: false, text: label + "ADVISORY FINDING SAVED. "
      + "Real existing Outline task " + task.scope.runId + " completed, with source/citation validation, "
      + "encrypted PPF Save acknowledgement, current Block fingerprint, and " + task.proposals.length + "/1 artifact. "
      + "Only a candidate review exists: no Plan was Human-accepted, no 25-shot production proposal was generated, "
      + "no media or provider credits were used by Command." };
    return { ongoing: Boolean(task.running), text: label
      + (task.running ? "WORKING" : "PAUSED / RECOVERY REQUIRED")
      + "; protected task " + task.scope.runId + ", state " + task.run.state
      + ", real artifact count " + task.proposals.length + "/1, current advisory finding "
      + (accepted ? "saved" : "not yet saved")
      + ". " + (task.running ? "The host is executing; Command is monitoring. " : "Resume through the existing Outline recovery UI. ")
      + "No accepted Plan or media is implied." };
  }

  async function runCreativeAssessmentCommand(submitted: string) {
    if (!embedded) return false;
    const command = parsePlotPickleCreativeCommand(submitted);
    if (command?.action !== "assess-local" && command?.action !== "assessment" && command?.action !== "produce"
      && command?.action !== "production" && command?.action !== "resume-production" && command?.action !== "cancel-production"
      && command?.action !== "diagnose") return false;
    const production = ["produce", "production", "resume-production", "cancel-production"].includes(command.action);
    const snapshot = currentSurfaceContext(pathname);
    setMessages(current => [...current, { id: messageId("assessment-human"), role: "command", text: submitted,
      context: snapshot, inputMode: draftHasVoice ? "voice" : "typed" }].slice(-MAX_MESSAGES));
    setDraft(""); setDraftHasVoice(false); setError(""); setCommandWorking(true); setContext(snapshot);
    try {
      const projectId = sessionActiveProjectId();
      const project = projectId ? loadActiveLibraryProject() : null;
      if (!project || project.id !== projectId) throw new Error("Select an authenticated saved Library PPF before assessing any Block.");
      if (command.action === "diagnose") {
        const receipt = await outlineAssessmentMaterialReceipt(project);
        const tasks = await readOutlineTasks();
        const reports = [false, true].map(productionScope => ({
          scope: productionScope ? "Production pass" : "Local assessment",
          task: selectCurrentOutlineTask(tasks, {
            projectId, contextReceipt: receipt, blockNumber: command.blockNumber,
            production: productionScope,
          }),
        }));
        const text = "STORY ARCHITECT · READ-ONLY DIAGNOSTICS · Block " + String(command.blockNumber).padStart(2, "0")
          + "\nSaved PPF: " + project.title + "; revision: " + project.revision
          + "\n" + reports.map(report => report.scope + ":\n"
            + (report.task ? describeOutlineTaskDiagnostic(report.task) : "No current-material task found; no inference was started.")).join("\n\n")
          + "\nUNKNOWN means the private Pi checkpoint and actual model dispatch were not inspected. No automatic retry is permitted.";
        setMessages(current => [...current, { id: messageId("diagnose-result"),
          role: "tool", text, context: snapshot }].slice(-MAX_MESSAGES));
        return true;
      }
      const scoped = project.sourceEvidence.screenplay?.passages.filter(p => p.blockNumber === command.blockNumber) ?? [];
      if (!scoped.length) throw new Error("The selected Block has no mapped screenplay passages. Assessment cannot substitute invented evidence.");
      if (project.sourceEvidence.screenplay?.passagesTruncated)
        throw new Error("Imported screenplay evidence is truncated; do not infer from an incomplete story.");
      await flushProfilePrivateWrites();
      if (sessionActiveProjectId() !== projectId || loadActiveLibraryProject().revision !== project.revision)
        throw new Error("Saved PPF identity/revision changed during authenticated assessment admission.");
      let text: string;
      if (command.action === "resume-production" || command.action === "cancel-production") {
        const receipt = await outlineAssessmentMaterialReceipt(project);
        const task = selectCurrentOutlineTask(await readOutlineTasks(), {
          projectId, contextReceipt: receipt, blockNumber: command.blockNumber, production: true,
        });
        if (!task) throw new Error("No current production pass exists for this Block.");
        await changeOutlineTask(command.action === "resume-production" ? "resume" : "cancel", project, { taskId: task.scope.runId });
        text = (await reconcileStoryArchitectBlock(projectId!, command.blockNumber, true, task.scope.runId)).text;
      } else if (command.action === "assess-local" || command.action === "produce") {
        const localOnly = command.action === "assess-local" || command.action === "produce" && command.localOnly;
        const task = production
          ? await changeOutlineTask(localOnly ? "start-production-local" : "start-production", project, { blocks: [command.blockNumber] })
          : await changeOutlineTask("start-local", project, { blocks: [command.blockNumber] });
        if (task.scope.projectId !== projectId || localOnly && task.scope.provider !== "local" && task.scope.provider !== "ollama"
          || production && !["local", "ollama", "openai"].includes(task.scope.provider))
          throw new Error("Story Architect host did not confirm the exact project and approved writing provider.");
        text = (production ? "Bounded production pass ADMITTED for " : "Story Architect local-only assessment ADMITTED for ") + project.title
          + ", Block " + String(command.blockNumber).padStart(2, "0") + ", project revision " + project.revision
          + ", task " + task.scope.runId + ", host provider " + task.scope.provider + ", model " + task.scope.model
          + ". Protected task state " + task.run.state + ", artifacts " + task.proposals.length + "/1. "
          + (task.scope.provider === "openai" ? "Configured paid OpenAI writing compute may be billed by your provider. " : "Local no-spend compute is selected. ")
          + "No MiniMax/video request was authorized. Assessment output and screenplay decisions remain advisory; "
          + "the existing task is executing or awaiting recovery, not yet completed.";
        // Best-effort read/import of COMPLETED HOST WORK ONLY. No retries or
        // new inference; the persistent Outline recovery owner remains canonical.
        void (async () => {
          for (let attempt = 0; attempt < 40; attempt += 1) {
            await new Promise<void>(resolve => setTimeout(resolve, 2500));
            if (sessionActiveProjectId() !== projectId) return;
            try {
              const state = await reconcileStoryArchitectBlock(projectId, command.blockNumber, production, task.scope.runId);
              if (!state.ongoing) {
                setMessages(current => [...current, { id: messageId("assessment-reconcile"),
                  role: "tool", text: state.text, context: snapshot }].slice(-MAX_MESSAGES));
                return;
              }
            } catch (error) {
              setMessages(current => [...current, { id: messageId("assessment-error"),
                role: "tool", text: "BLOCKED: Story Architect findings remain protected; automatic import not verified. "
                + (error instanceof Error ? error.message : "Unknown local error")
                + ". Use PlotPickle assessment Block " + String(command.blockNumber).padStart(2, "0") + " to reconcile.",
                context: snapshot }].slice(-MAX_MESSAGES));
              return;
            }
          }
          setMessages(current => [...current, { id: messageId("assessment-timeout"), role: "tool",
            text: "Story Architect remains in its persistent recovery task; no inference completion was claimed. "
              + "Run PlotPickle assessment Block " + String(command.blockNumber).padStart(2, "0") + " to reconcile.",
            context: snapshot }].slice(-MAX_MESSAGES));
        })();
      } else {
        text = (await reconcileStoryArchitectBlock(projectId, command.blockNumber, production)).text;
      }
      setMessages(current => [...current, { id: messageId("assessment-result"), role: "tool",
        text, context: snapshot }].slice(-MAX_MESSAGES));
    } catch(error) {
      setMessages(current => [...current, { id: messageId("assessment-blocked"), role: "tool",
        text: "BLOCKED: " + (error instanceof Error ? error.message : "Story Architect was unavailable")
          + " No advisory finding was fabricated, no paid media was authorized.",
        context: snapshot }].slice(-MAX_MESSAGES));
    } finally { setCommandWorking(false); }
    return true;
  }

  const sourceProposalSession = useRef<ReturnType<typeof createCmdSourceProposalSession> | null>(null);
  async function runCmdSourceProposal(submitted: string) {
    if (!embedded) return false;
    const cmd = parseCmdSourceProposal(submitted);
    if (!cmd) return false;
    if (!sourceProposalSession.current) {
      sourceProposalSession.current = createCmdSourceProposalSession({
        snapshot: async () => {
          const profileId = window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) || "";
          if (!profileId || !profilePrivateBrowserReadyFor(profileId)) return null;
          const activeProjectId = sessionActiveProjectId();
          return { profileId, activeProjectId, project: activeProjectId ? loadActiveLibraryProject() : null };
        },
        fields: async () => buildStoryDevelopmentFields(plotPickleCurriculum),
        token: () => crypto.randomUUID().replaceAll("-", "").slice(0, 16),
        now: () => Date.now(),
        save: async ({ project, field, proposal, passageId, expectedRevision, profileId, projectId }: {
          project: Parameters<typeof writeStoryDevelopmentFieldProposal>[0]["project"];
          field: Parameters<typeof writeStoryDevelopmentFieldProposal>[0]["field"];
          proposal: string; passageId: string; expectedRevision: number; profileId: string; projectId: string;
        }) => {
          if (window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) !== profileId
            || !profilePrivateBrowserReadyFor(profileId)
            || sessionActiveProjectId() !== projectId) throw new Error("Human authority changed.");
          const current = loadActiveLibraryProject();
          if (current.id !== projectId || current.revision !== expectedRevision
            || current.sourceEvidence?.screenplay?.passages.find(p => p.id === passageId)?.text
              !== project.sourceEvidence?.screenplay?.passages.find(p => p.id === passageId)?.text)
            throw new Error("Project or imported source changed.");
          const candidate = writeStoryDevelopmentFieldProposal({
            project: current, field, proposal, sourceRef: passageId,
          });
          await saveFoundationProjectDurably(candidate, expectedRevision);
          if (window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) !== profileId
            || sessionActiveProjectId() !== projectId) throw new Error("Human or project changed during save.");
          return loadActiveLibraryProject();
        },
      });
    }
    const snapshot = currentSurfaceContext(pathname);
    setMessages(current => [...current, { id: messageId("source-proposal-human"), role: "command",
      text: submitted, context: snapshot, inputMode: draftHasVoice ? "voice" : "typed" }].slice(-MAX_MESSAGES));
    setDraft(""); setDraftHasVoice(false); setError(""); setContext(snapshot); setCommandWorking(true);
    try {
      const answer = await sourceProposalSession.current.execute(cmd);
      setMessages(current => [...current, { id: messageId("source-proposal-result"), role: "tool",
        text: answer, context: snapshot }].slice(-MAX_MESSAGES));
    } catch {
      setMessages(current => [...current, { id: messageId("source-proposal-blocked"), role: "tool",
        text: "BLOCKED: Source proposal result could not be verified. Inspect the existing PPF field before retrying.",
        context: snapshot }].slice(-MAX_MESSAGES));
    } finally { setCommandWorking(false); }
    return true;
  }

  const agentHealthSession = useRef<ReturnType<typeof createAgentHealthCommandSession> | null>(null);
  async function runAgentHealthCommand(submitted: string) {
    if (!embedded) return false;
    const parsed = parseAgentHealthCommand(submitted);
    if (!parsed) return false;
    if (!agentHealthSession.current) agentHealthSession.current = createAgentHealthCommandSession({
      profile: async () => {
        const response = await authenticatedProfileFetch("/api/auth/profile", { cache: "no-store" });
        const data = await response.json();
        const id = window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) || "";
        return response.ok && data.authenticated === true && data.profile?.profileId === id
          && profilePrivateBrowserReadyFor(id) ? id : "";
      },
      request: async (apiPath: string, body?: object, timeoutMs?: number) => {
        const response = await authenticatedProfileFetch(apiPath, {
          cache: "no-store",
          ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
          ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
        });
        const value = await response.json();
        if (!response.ok || value.ok === false) throw new Error("Agent Health runtime denied or could not complete the request.");
        return value;
      },
      now: () => Date.now(),
      token: () => crypto.randomUUID().replaceAll("-", "").slice(0, 16),
      progress: (row: string) => {
        setMessages(current => [...current, { id: messageId("agent-health-progress"), role: "tool",
          text: "Agent Health: " + row, context: currentSurfaceContext(pathname) }].slice(-MAX_MESSAGES));
      },
    });
    const snapshot = currentSurfaceContext(pathname);
    const safeText = parsed.action === "invalid" ? "[Unrecognized agent input withheld]" : submitted;
    setMessages(current => [...current, { id: messageId("agent-health-human"), role: "command",
      text: safeText, context: snapshot, inputMode: draftHasVoice ? "voice" : "typed" }].slice(-MAX_MESSAGES));
    setDraft(""); setDraftHasVoice(false); setError(""); setCommandWorking(true); setContext(snapshot);
    try {
      const outcome = await agentHealthSession.current.execute(parsed);
      setMessages(current => [...current, { id: messageId("agent-health-result"), role: "tool",
        text: outcome, context: snapshot }].slice(-MAX_MESSAGES));
    } catch {
      setMessages(current => [...current, { id: messageId("agent-health-blocked"), role: "tool",
        text: "Agent Health could not complete. See secure diagnostics; do not assume inference or retry.", context: snapshot }].slice(-MAX_MESSAGES));
    } finally { setCommandWorking(false); }
    return true;
  }

  const connectionSession = useRef<ReturnType<typeof createConnectionCommandSession> | null>(null);
  async function runDirectConnectionsCommand(submitted: string) {
    if (!embedded) return false;
    const command = parseConnectionCommand(submitted);
    if (!command) return false;
    if (!connectionSession.current) connectionSession.current = createConnectionCommandSession({
      profile: async () => {
        const response = await authenticatedProfileFetch("/api/auth/profile", { cache: "no-store" });
        const body = await response.json();
        const profile = window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) || "";
        return response.ok && body.authenticated === true && body.profile?.profileId === profile
          && profilePrivateBrowserReadyFor(profile) ? profile : "";
      },
      request: async (path: string, body?: object) => {
        const response = await fetch(path, { cache: "no-store", ...(body ? {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        } : {}) });
        const result = await response.json();
        if (!response.ok || result.ok === false) throw new Error("Connection runtime rejected the request.");
        return result;
      },
      now: () => Date.now(), token: () => crypto.randomUUID().replaceAll("-", "").slice(0, 16),
      changed: () => {
        window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
        window.dispatchEvent(new CustomEvent("plotpickle:connection-status-refresh"));
      },
    });
    const snapshot = currentSurfaceContext(pathname);
    // Only the parsed, allowlisted grammar can be echoed. Invalid inputs may contain secrets.
    const safeInput = command.action === "invalid" ? "[Unrecognized connection input withheld]" : submitted;
    setMessages(current => [...current, { id: messageId("connections-command"), role: "command", text: safeInput, context: snapshot }].slice(-MAX_MESSAGES));
    setDraft(""); setDraftHasVoice(false); setError(""); setCommandWorking(true);
    try {
      const text = await connectionSession.current.execute(command);
      setMessages(current => [...current, { id: messageId("connections-result"), role: "tool", text, context: snapshot }].slice(-MAX_MESSAGES));
    } finally { setCommandWorking(false); }
    return true;
  }

  function runConnectionsCommand(submitted: string) {
    if (!embedded) return false;
    const command = parsePlotPickleCreativeCommand(submitted);
    if (command?.action !== "connections-help" && command?.action !== "connections-open") return false;
    const snapshot = currentSurfaceContext(pathname);
    setMessages((current) => [...current, { id: messageId("connections-human"), role: "command",
      text: submitted, context: snapshot, inputMode: draftHasVoice ? "voice" : "typed" }].slice(-MAX_MESSAGES));
    setDraft(""); setDraftHasVoice(false); setError("");
    if (command.action === "connections-help") {
      setMessages((current) => [...current, { id: messageId("connections-help"), role: "tool",
        text: "Use PlotPickle connect local, PlotPickle connect cloud or PlotPickle connect hybrid. "
          + "Each opens the matching Settings GUI with the same connection setup, tests, provider choices and readiness. "
          + "Never paste API keys into Command; enter them in the secure provider Setup screen.",
        context: snapshot }].slice(-MAX_MESSAGES));
    } else {
      // Only navigation. No credential read, provider test, Join mutation, model
      // execution or spend is performed by the Command transcript itself.
      window.dispatchEvent(new CustomEvent("plotpickle:open-story-mode", { detail: command.mode }));
    }
    return true;
  }

  function runCreativeDiscoveryCommand(submitted: string) {
    if (!embedded) return false;
    const command = parsePlotPickleCreativeCommand(submitted);
    if (!command) return false;
    const snapshot = currentSurfaceContext(pathname);
    setMessages((current) => [...current, {
      id: messageId("creative-command-human"),
      role: "command",
      text: submitted,
      context: snapshot,
      inputMode: draftHasVoice ? "voice" : "typed",
    }].slice(-MAX_MESSAGES));
    setDraft("");
    setDraftHasVoice(false);
    setError("");
    setContext(snapshot);
    let responseText = "";
    try {
      const activeProjectId = command.action === "tools" || command.action === "invalid"
        ? null : sessionActiveProjectId();
      const project = activeProjectId ? loadActiveLibraryProject() : null;
      const currentAssessment = command.action === "plan" && project?.id === activeProjectId
        ? Boolean(currentOutlineAssessment(project, command.blockNumber))
        : false;
      responseText = describePlotPickleCreativeCommand(command, {
        project, activeProjectId: activeProjectId || "", currentAssessment,
      }) || "Command produced no inspection result. Nothing was executed.";
    } catch (cause) {
      responseText = "BLOCKED: Cannot inspect the selected PPF: "
        + (cause instanceof Error ? cause.message : "unknown selected story error")
        + ". No tools ran and no story data changed.";
    }
    setMessages((current) => [...current, {
      id: messageId("creative-command-inspection"),
      role: "tool",
      text: responseText,
      context: snapshot,
    }].slice(-MAX_MESSAGES));
    return true;
  }

  async function runOpenPencilCommand(submitted: string) {
    if (!embedded) return false;
    const command = parseOpenPencilCommand(submitted);
    if (!command) return false;

    const snapshot = currentSurfaceContext(pathname);
    setMessages((current) => [...current, {
      id: messageId("command-human"),
      role: "command",
      text: submitted,
      context: snapshot,
      inputMode: draftHasVoice ? "voice" : "typed",
    }].slice(-MAX_MESSAGES));
    setDraft("");
    setDraftHasVoice(false);
    setError("");
    setCommandWorking(true);
    setContext(snapshot);

    try {
      let responseText = "";
      if (command.action === "help") {
        responseText = `OpenPencil commands:\n${OPENPENCIL_COMMAND_HELP}`;
      } else if (command.action === "open" || command.action === "review" || command.action === "publish") {
        const timelineSnapshot = command.action === "open"
          && command.surfaceName.trim().toLocaleLowerCase("en-US") === "timeline"
          ? await captureOpenPencilTimelineSnapshot()
          : null;
        const guiAction = command.action === "publish" ? "finalize" : command.action;
        const response = await authenticatedProfileFetch("/api/openpencil/gui", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: guiAction,
            surfaceName: command.surfaceName,
            ...(timelineSnapshot ? { designSnapshot: timelineSnapshot } : {}),
          }),
        });
        const body = await response.json() as {
          ok?: boolean;
          result?: {
            state?: string;
            surface?: string;
            page?: string;
            relativeFile?: string;
            message?: string;
            handoffDraft?: string;
            designReviewSessionId?: string;
            issueNumber?: number;
            issueUrl?: string;
          };
          message?: string;
        };
        if (!response.ok || !body.ok || !body.result) throw new Error(body.message || "OpenPencil GUI command failed.");
        responseText = body.result.message || "OpenPencil GUI command completed.";
        if (command.action === "open" && body.result.designReviewSessionId) {
          openPencilDesignSessionRef.current = {
            sessionId: body.result.designReviewSessionId,
            surface: command.surfaceName,
            finalizing: false,
            closeCheckAttempts: 0,
          };
        }
        if (command.action === "review" && body.result.handoffDraft) {
          setDraft(body.result.handoffDraft);
          setDraftHasVoice(false);
          responseText += "\nDesign evidence has been loaded into the request box. Choose 01 Interpret, then Pi Draft, then Publish Brief to create the GitHub issue.";
        }
      } else {
        const request = command.action === "status"
          ? authenticatedProfileFetch("/api/openpencil/mcp", { cache: "no-store" })
          : command.action === "disconnect"
            ? authenticatedProfileFetch("/api/openpencil/mcp", { method: "DELETE" })
            : authenticatedProfileFetch("/api/openpencil/mcp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workspaceRoot: command.workspaceRoot }),
              });
        const response = await request;
        const body = await response.json() as {
          ok?: boolean;
          status?: { state?: string; endpoint?: string; message?: string };
          message?: string;
        };
        if (!response.ok || !body.ok || !body.status) throw new Error(body.message || "OpenPencil command failed.");
        responseText = [
          body.status.message || "OpenPencil command completed.",
          body.status.state ? `State: ${body.status.state}` : "",
          body.status.endpoint ? `Endpoint: ${body.status.endpoint}` : "",
        ].filter(Boolean).join("\n");
      }

      setMessages((current) => [...current, {
        id: messageId("openpencil-tool"),
        role: "tool",
        text: responseText,
        context: snapshot,
      }].slice(-MAX_MESSAGES));
    } catch (cause) {
      setMessages((current) => [...current, {
        id: messageId("openpencil-tool-error"),
        role: "tool",
        text: cause instanceof Error ? cause.message : "OpenPencil command failed.",
        context: snapshot,
      }].slice(-MAX_MESSAGES));
    } finally {
      setCommandWorking(false);
    }
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitted = draft.trim();
    if (!submitted || busy) return;
    if (embedded && submitted.startsWith("/") && (submitted === "/" || (slashOpen && slashSuggestions.length === 0))) {
      setError("Choose a recognized command from the slash menu or type a supported command. Nothing was executed.");
      return;
    }
    setSlashOpen(false);
    if (await runCmdSourceProposal(submitted)) return;
    if (await runAgentHealthCommand(submitted)) return;
    if (await runDirectConnectionsCommand(submitted)) return;
    if (await runCreativeAssessmentCommand(submitted)) return;
    if (await runCreativeLibraryCommand(submitted)) return;
    if (runConnectionsCommand(submitted)) return;
    if (runCreativeDiscoveryCommand(submitted)) return;
    if (await runOpenPencilCommand(submitted)) return;

    const snapshot = currentSurfaceContext(pathname);
    const inputMode: DsddInputMode = draftHasVoice ? "voice" : "typed";
    const humanMessage: DsddMessage = {
      id: messageId("dsdd-human"),
      role: "human",
      text: submitted,
      context: snapshot,
      inputMode,
    };
    const prior = messages;
    const pending = [...prior, humanMessage].slice(-MAX_MESSAGES);
    setMessages(pending);
    setLockedIntent(null);
    setActiveInputMode(inputMode);
    setDraft("");
    setDraftHasVoice(false);
    setError("");
    setWorking(true);
    setContext(snapshot);

    try {
      const persistHuman = await authenticatedProfileFetch(sessionApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "append-human", text: submitted, context: snapshot, inputMode }),
      });
      const persistedHuman = await persistHuman.json() as DsddSessionPayload;
      if (!persistHuman.ok || !persistedHuman.ok) {
        throw new Error(persistedHuman.message || "DSDD could not preserve the Human narration.");
      }

      const response = await fetch("/api/local-ai/generate/text", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-PlotPickle-DSDD-Scope": "intent" },
        body: JSON.stringify({
          provider: "local",
          modelRole: "quality",
          instructions: DSDD_INSTRUCTIONS,
          prompt: conversationPrompt(prior, snapshot, submitted, inputMode),
        }),
      });
      const body = await response.json() as TextResponse;
      if (!response.ok || !body.text?.trim()) {
        throw new Error(body.message || "The DSDD interpreter did not return a response.");
      }
      const interpreted = boundedInterpretation(body.text!);
      const persistInterpretation = await authenticatedProfileFetch(sessionApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "append-interpretation", text: interpreted, context: snapshot }),
      });
      const persistedInterpretation = await persistInterpretation.json() as DsddSessionPayload;
      if (!persistInterpretation.ok || !persistedInterpretation.ok) {
        throw new Error(persistedInterpretation.message || "DSDD could not preserve its interpretation.");
      }
      setLockedIntent(null);
      setMessages((current) => [...current, {
        id: messageId("dsdd-interpreter"),
        role: "dsdd",
        text: interpreted,
        context: snapshot,
        provider: body.provider,
        model: body.model,
      }].slice(-MAX_MESSAGES));
    } catch (cause) {
      setDraft(submitted);
      setDraftHasVoice(inputMode === "voice");
      setError(cause instanceof Error ? cause.message : "The DSDD interpreter is unavailable.");
    } finally {
      setWorking(false);
    }
  }

  async function createPiDraft() {
    if (busy || !hasInterpretation || noActionRequired) return;
    setPiDrafting(true);
    setError("");
    try {
      let intent = lockedIntent;
      if (!intent) {
        const lockResponse = await authenticatedProfileFetch(sessionApi, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "lock-intent" }),
        });
        const lockBody = await lockResponse.json() as DsddSessionPayload;
        if (!lockResponse.ok || !lockBody.ok || !lockBody.intent) {
          throw new Error(lockBody.message || "DSDD could not lock the approved intent for Pi Draft.");
        }
        intent = lockBody.intent;
        setLockedIntent(intent);
      }
      if (intent.developerBrief?.state === "ready") return;
      const draftResponse = await authenticatedProfileFetch(sessionApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft-brief" }),
      });
      const draftBody = await draftResponse.json() as DsddSessionPayload;
      if (!draftResponse.ok || !draftBody.ok || !draftBody.intent?.developerBrief) {
        throw new Error(draftBody.message || "Pi Draft did not return a technical developer brief.");
      }
      setLockedIntent(draftBody.intent);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pi Draft is unavailable.");
    } finally {
      setPiDrafting(false);
    }
  }


  async function validateFinding(decision: "Y" | "N") {
    if (!activeFinding || busy) return;
    setValidatingFinding(true);
    setError("");
    try {
      const response = await authenticatedProfileFetch(sessionApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate-finding", fingerprint: activeFinding.fingerprint, decision }),
      });
      const body = await response.json() as DsddSessionPayload;
      if (!response.ok || !body.ok || !body.uat) {
        throw new Error(body.message || "Conversational UAT could not preserve the Human validation.");
      }
      setUat(body.uat);
      if (body.intent) setLockedIntent(body.intent);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Conversational UAT validation is unavailable.");
    } finally {
      setValidatingFinding(false);
    }
  }

  function navigateToFinding() {
    const target = activeFinding?.safeNavigationTarget;
    if (!target || !target.startsWith("/") || target.startsWith("//")) return;
    window.location.assign(target);
  }

  async function publishBrief() {
    if (busy || !lockedIntent?.developerBrief || lockedIntent.publishedIssue) return;
    setPublishing(true);
    setError("");
    try {
      const response = await authenticatedProfileFetch(sessionApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish-brief" }),
      });
      const body = await response.json() as DsddSessionPayload;
      if (!response.ok || !body.ok || !body.intent?.publishedIssue) {
        throw new Error(body.message || "DSDD could not publish the developer brief to GitHub.");
      }
      setLockedIntent(body.intent);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publish Brief is unavailable.");
    } finally {
      setPublishing(false);
    }
  }

  if (!eligible || !runtimeEligible) return embedded ? <p role="status">{hydrated ? "Command requests are unavailable. Unlock the profile and check the local runtime." : "Loading protected requests…"}</p> : null;

  return (
    <>
      {!embedded ? <button
        type="button"
        className={styles.launcher}
        aria-expanded={open}
        aria-controls="plotpickle-dsdd-conversation"
        onClick={() => setOpen((value) => !value)}
      >
        DSDD
        <span>LIVE UAT{pendingFindings.length ? ` · ${pendingFindings.length} PENDING` : ""}</span>
      </button> : null}

      {open ? (
        <aside
          id="plotpickle-dsdd-conversation"
          className={embedded ? `${styles.panel} ${styles.embedded}` : styles.panel}
          aria-labelledby="plotpickle-dsdd-title"
          data-dsdd-conversational-uat="true"
          data-dsdd-current-surface={context?.surfaceId || "UNKNOWN"}
        >
          <header className={styles.header}>
            <div>
              <small>DETERMINISTIC SPECIFICATION-DRIVEN DEVELOPMENT</small>
              <h2 id="plotpickle-dsdd-title">{embedded ? "Requests" : "Conversational UAT"}</h2>
              <p>{embedded ? "Share a comment, report a problem or request a bounded change. Review the interpretation and technical brief before publishing." : "Narrate what you expected and what actually happened while you use PlotPickle."}</p>
            </div>
            {!embedded ? <button type="button" onClick={() => setOpen(false)} aria-label="Close DSDD conversation">Close</button> : null}
          </header>

          <div className={styles.context} aria-live="polite">
            <strong>Current context</strong>
            <span>{currentLabel}</span>
            <small>Pending findings: {pendingFindings.length}</small>
          </div>

          {activeFinding ? (
            <section
              className={styles.findingCard}
              data-dsdd-finding-card={activeFinding.fingerprint}
              aria-live="assertive"
              aria-labelledby="plotpickle-uat-finding-title"
            >
              <strong id="plotpickle-uat-finding-title">Potential problem found</strong>
              <span>{activeFinding.surfaceId}{activeFinding.route ? ` · ${activeFinding.route}` : ""}</span>
              <p><b>Expected:</b> {activeFinding.expected}</p>
              <p><b>Observed:</b> {activeFinding.observed}</p>
              <small>Evidence: {activeFinding.expectationSource} · {activeFinding.expectationRef}</small>
              <div className={styles.findingActions}>
                <button type="button" disabled={busy} onClick={() => { void validateFinding("Y"); }}>[Y] Yes — this problem exists</button>
                <button type="button" disabled={busy} onClick={() => { void validateFinding("N"); }}>[N] No — this is expected behavior</button>
                {activeFinding.safeNavigationTarget?.startsWith("/") ? (
                  <button type="button" className={styles.secondary} disabled={busy} data-dsdd-safe-navigation="true" onClick={navigateToFinding}>
                    Take me to it
                  </button>
                ) : null}
              </div>
              <small>Y publishes a developer brief only. It does not edit source, run repair, create an implementation PR, or merge.</small>
            </section>
          ) : null}

          {lockedIntent ? (
            <div className={styles.context} data-dsdd-locked-intent="true" aria-live="polite">
              <strong>Locked intent v{lockedIntent.version}</strong>
              <span>{lockedIntent.understoodMeaning}</span>
              <small>{lockedIntent.requirements.map((requirement) => `${requirement.id} ${requirement.status}`).join(" · ")}</small>
              {lockedIntent.developerBrief ? <small>PI DRAFT: READY · READ-ONLY REPOSITORY REVIEW</small> : <small>PI DRAFT: NOT YET GENERATED</small>}
              {lockedIntent.publishedIssue ? (
                <a href={lockedIntent.publishedIssue.url} target="_blank" rel="noreferrer">
                  GITHUB ISSUE #{lockedIntent.publishedIssue.number}
                </a>
              ) : null}
            </div>
          ) : hasInterpretation ? (
            <div className={styles.context} data-dsdd-candidate-intent="true">
              <strong>What DSDD understood</strong>
              <span>{latestInterpretation}</span>
              <small>{noActionRequired
                ? "No development handoff is required for this observation. Add new narration when you have another UAT finding."
                : "Review this meaning. Step 02 Pi Draft locks it and adds repository-aware technical guidance without changing code."}</small>
            </div>
          ) : null}

          <div className={styles.findingActions}>
            {confirmClear ? (
              <div role="group" aria-label="Confirm clear console">
                <p>Clear all conversation messages? They will no longer be used for interpretation. Saved stories and published briefs are kept.</p>
                <button type="button" disabled={busy} onClick={() => { void clearConsole(); }}>{clearing ? "Clearing…" : "Confirm clear"}</button>
                <button type="button" className={styles.secondary} disabled={busy} onClick={() => setConfirmClear(false)}>Cancel</button>
              </div>
            ) : (
              <button type="button" className={styles.secondary} disabled={busy || !hydrated || messages.length === 0} onClick={() => setConfirmClear(true)}>Clear console</button>
            )}
          </div>

          <div className={styles.thread} ref={threadRef} role="log" aria-live="polite" aria-relevant="additions text">
            {messages.length === 0 ? (
              <div className={styles.dsddMessage}>
                <strong>DSDD</strong>
                <p>Walk through the product normally. Tell me what you are trying to do, what you expected, and what behaved differently. I will preserve the intent and reflect back what I understand.</p>
              </div>
            ) : null}
            {messages.map((message) => (
              <div className={message.role === "human" || message.role === "command" ? styles.humanMessage : styles.dsddMessage} key={message.id}>
                <strong>{message.role === "human" || message.role === "command" ? "You" : message.role === "tool" ? "Tool" : "DSDD"}</strong>
                <p>{splitConnectionConfirmationPreview(
                  message.text,
                  message.role === "tool" && message.id.startsWith("connections-result"),
                ).map((segment, index) => segment.emphasis ? (
                  <span key={index} className={styles.connectionConfirmation} data-cmd-confirmation="action">
                    {segment.text}
                  </span>
                ) : <span key={index}>{segment.text}</span>)}</p>
                {message.context ? <small>{message.context.surfaceLabel} · {message.context.route}</small> : null}
                {message.role === "dsdd" && message.model ? (
                  <small>Intent model: {message.provider ? `${message.provider} · ` : ""}{message.model}</small>
                ) : null}
              </div>
            ))}
            {lockedIntent?.developerBrief ? (
              <div className={styles.dsddMessage} data-dsdd-pi-draft="ready">
                <strong>Pi technical developer draft</strong>
                <p>{lockedIntent.developerBrief.text}</p>
                <small>Read-only Pi {lockedIntent.developerBrief.piVersion} · tools: read, grep, find, ls · repository mutation: none</small>
              </div>
            ) : null}
            {working ? <p className={styles.working} role="status">Interpreting your UAT narration with local AI…</p> : null}
            {commandWorking ? <p className={styles.working} role="status">Running the requested Command operation…</p> : null}
            {piDrafting ? <p className={styles.working} role="status">Pi is inspecting the repository read-only and drafting developer guidance…</p> : null}
            {publishing ? <p className={styles.working} role="status">Publishing the approved developer brief as a GitHub Issue…</p> : null}
            {validatingFinding ? <p className={styles.working} role="status">Preserving Human validation and preparing the specification handoff…</p> : null}
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error} No source code change was attempted by DSDD.
            </p>
          ) : null}

          <form className={styles.composer} onSubmit={submit}>
            <label htmlFor="plotpickle-dsdd-narration">{embedded ? "Enter a request or local tool command" : "Narrate the workflow or problem"}</label>
            <textarea
              ref={narrationRef}
              data-voice-input="false"
              id="plotpickle-dsdd-narration"
              aria-label={embedded ? "PlotPickle Command input" : "DSDD narration"}
              data-purpose="natural-language developer uat narration"
              disabled={busy}
              role={embedded ? "combobox" : undefined}
              aria-autocomplete={embedded ? "list" : undefined}
              aria-expanded={embedded ? slashOpen : undefined}
              aria-controls={embedded ? "plotpickle-cmd-slash-menu" : undefined}
              aria-activedescendant={embedded && slashOpen && slashSuggestions.length ? `plotpickle-cmd-slash-option-${activeSlashIndex}` : undefined}
              onChange={(event) => {
                const next = event.currentTarget.value;
                setDraft(next);
                setSlashOpen(embedded && next.trimStart().startsWith("/") && !next.includes("\n"));
                setSlashSelection(0);
                if (!next.trim()) setDraftHasVoice(false);
              }}
              onKeyDown={(event) => {
                if (!embedded || !slashOpen) return;
                if (event.key === "Escape") {
                  event.preventDefault();
                  setSlashOpen(false);
                } else if (event.key === "ArrowDown" && slashSuggestions.length) {
                  event.preventDefault();
                  setSlashSelection((index) => (index + 1) % slashSuggestions.length);
                } else if (event.key === "ArrowUp" && slashSuggestions.length) {
                  event.preventDefault();
                  setSlashSelection((index) => (index + slashSuggestions.length - 1) % slashSuggestions.length);
                } else if (event.key === "Enter" && !event.shiftKey && slashSuggestions.length) {
                  event.preventDefault();
                  chooseSlashCommand(slashSuggestions[activeSlashIndex].command);
                }
              }}
              placeholder={embedded ? "Type / to browse commands · or describe a problem" : "Example: When I open this, I expect the current draft to stay exactly where I left it, but it sends me back to the dashboard."}
              rows={4}
              value={draft}
            />
            {embedded && slashOpen ? (
              <div id="plotpickle-cmd-slash-menu" className={styles.slashMenu} role="listbox" aria-label="Available PlotPickle commands" data-cmd-slash-menu="true">
                <div className={styles.slashMenuHeading}>Available commands · ↑ ↓ to browse · Enter to insert · Esc to close</div>
                {slashSuggestions.length ? slashSuggestions.map((item, index) => (
                  <button
                    key={item.command}
                    id={`plotpickle-cmd-slash-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeSlashIndex}
                    className={styles.slashMenuOption}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseSlashCommand(item.command)}
                  >
                    <span className={styles.slashMenuCategory}>{item.category}</span>
                    <strong>/{item.command}</strong>
                    <small>{item.description}</small>
                  </button>
                )) : <p className={styles.slashMenuEmpty}>No matching command. Edit the search after / to see registered operations.</p>}
                <small className={styles.slashMenuSafety}>Selecting inserts a command only. Review or complete placeholders before submitting.</small>
              </div>
            ) : null}
            <div className={styles.composerFooter}>
              <span>1 Interpret your intent. 2 Pi prepares the technical developer draft. 3 Publish the approved brief.</span>
              <VoiceInputControl
                value={draft}
                onValueChange={setDraft}
                inputRef={narrationRef}
                onDictationInserted={() => setDraftHasVoice(true)}
                disabled={busy}
                inputType="textarea"
                purpose="natural-language developer uat narration"
                className={styles.voiceControl}
                statusPlacement="inline"
              />
              <div className={styles.process} role="group" aria-label="DSDD three-step development handoff">
                <button
                  type="submit"
                  className={styles.processStep}
                  data-step-state={interpretStep}
                  aria-current={interpretStep === "active" ? "step" : undefined}
                  disabled={busy || !draft.trim()}
                >
                  <small>01</small>
                  <strong>{working ? "INTERPRETING…" : "INTERPRET"}</strong>
                  <span>{interpretStep === "complete" ? "COMPLETE" : "UNDERSTAND INTENT"}</span>
                </button>
                <span className={styles.processArrow} aria-hidden="true">→</span>
                <button
                  type="button"
                  className={styles.processStep}
                  data-step-state={piDraftStep}
                  aria-current={piDraftStep === "active" ? "step" : undefined}
                  disabled={busy || noActionRequired || piDraftReady || !hasInterpretation}
                  onClick={() => { void createPiDraft(); }}
                >
                  <small>02</small>
                  <strong>{piDrafting ? "PI DRAFTING…" : "PI DRAFT"}</strong>
                  <span>{noActionRequired ? "NOT REQUIRED" : piDraftStep === "complete" ? "COMPLETE" : "TECHNICAL BRIEF"}</span>
                </button>
                <span className={styles.processArrow} aria-hidden="true">→</span>
                <button
                  type="button"
                  className={styles.processStep}
                  data-step-state={publishStep}
                  aria-current={publishStep === "active" ? "step" : undefined}
                  disabled={busy || noActionRequired || !piDraftReady || briefPublished}
                  onClick={() => { void publishBrief(); }}
                >
                  <small>03</small>
                  <strong>{publishing ? "PUBLISHING…" : "PUBLISH BRIEF"}</strong>
                  <span>{noActionRequired ? "NOT REQUIRED" : publishStep === "complete" ? "COMPLETE" : "DELIVERY HANDOFF"}</span>
                </button>
              </div>
              {noActionRequired ? <span className={styles.noAction}>No development action required. Steps 02 and 03 are not needed for this UAT observation.</span> : null}
            </div>
          </form>
        </aside>
      ) : null}
    </>
  );
}
