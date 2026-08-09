"use client";

/* eslint-disable @next/next/no-img-element -- Project JSON accepts arbitrary user-supplied reference URLs. */

import MarketingSplash from "./marketing-splash";
import ApplicationShellHeader from "./application-shell-header";
import DashboardCommandCentre from "./dashboard-command-centre";
import AfterglowExampleBoundary from "./afterglow-example-boundary";
import BuildWorkspace from "./build-workspace";
import FeedbackWorkspace from "./feedback-workspace";
import ReportsWorkspace from "./reports-workspace";
import CollabWorkspace from "./collab-workspace";
import BuzzCommunityWorkspace from "./buzz-community-workspace";
import FeedbackContextBadge from "./feedback-context-badge";
import AiPitchDeckWorkspace from "./ai-pitch-deck-workspace";
import WorkspaceCapabilityShelf, { type CapabilityOwner } from "./workspace-capability-shelf";
import { ChangeEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createAfterglowProject } from "@/data/afterglow";
import EngineHub from "./engine-hub";
import ProjectOverview from "./project-overview";
import StructureMapSummary from "./structure-map-summary";
import SettingsPanel from "./settings-panel";
import ScriptWorkspace, { type WriterViewMode } from "./script-workspace";
import LearningStudio from "./learning-studio";
import ScriptViewer from "./script-viewer";
import writerStyles from "./script-workspace.module.css";
import CharacterImageGenerator from "./character-image-generator";
import VisualStoryboard from "./visual-storyboard";
import CoreModelStudio from "./core-model-studio";
import ReadmeTabs from "./readme-tabs";
import SimpleStart from "./simple-start";
import { TerminologyIndex } from "./settings-project-tools";
import { projectSectionProgress, sectionHasAlert } from "@/lib/project-progress";
import { assembleVisualStoryContext } from "@/lib/visual-context";
import { createProjectFromScreenplay, markScreenplayAnalysisReviewed } from "@/lib/screenplay-import";
import { screenplayFormatForFile } from "@/lib/screenplay";
import {
  addBlankCharacter,
  addBlankLocation,
  cloneProject,
  completionFor,
  createBlankProductionDraftState,
  createBlankProject,
  normalizePlotPickleProject,
  type Character,
  type Location,
  type PlotPickleProject,
  type ScreenplayDocument,
  type StoryBlock,
  type VisualReference,
} from "@/lib/project";
import { synchronizeScreenplaySceneReferences } from "@/lib/scene-management";
import { PRODUCT_COMPONENTS, type ProductNavigationId } from "@/lib/product-direction";
import { createStoredFeedbackModel } from "@/lib/unified-feedback-store";
import type { ConsolidatedReportSection, ReportTarget } from "@/lib/consolidated-reports";
import type { ProductionReportSection } from "@/lib/production-reports";
import type { FeedbackTargetReference } from "@/lib/unified-feedback";
import { reportsRuntimeConnections } from "@/lib/connection-status";
import {
  AFTERGLOW_EXAMPLE_ACTIVE_KEY,
  afterglowCopyFileName,
  createAfterglowEditableCopy,
  isAfterglowExampleProject,
} from "@/lib/afterglow-example";
import { useConnectionStatus } from "./use-connection-status";

const STORAGE_KEY = "plotpickle.project.v1";
const WINDOWS_DOWNLOAD_URL = "https://github.com/BryanHarrisScripts/PlotPickle/releases/latest";

type MainTab = ProductNavigationId;
type StorySection = "simpleStart" | "overview" | "storySetup" | "concept" | "references" | "pitch" | "world" | "characters" | "ghost" | "catalyst" | "foundations" | "pickle" | "dialogue" | "coreModel" | "structureMap" | "blocks" | "storyboard" | "notes";
type StorySectionGroup = "Project" | "Foundation" | "Structure" | "Production";
type LearnSection = "introduction" | "library" | "terminology" | "screenplay";

const WORKSPACE_QUERY_TABS: Record<string, MainTab> = {
  dashboard: "dashboard",
  learn: "learn",
  plan: "planner",
  storyboard: "visuals",
  write: "script",
  pitch: "pitch",
  build: "build",
  feedback: "feedback",
  refine: "engines",
  reports: "reports",
  collab: "collab",
  community: "community",
  settings: "settings",
};

const CAPABILITY_OWNER_BY_TAB: Partial<Record<MainTab, CapabilityOwner>> = {
  learn: "learn",
  planner: "plan",
  visuals: "storyboard",
  script: "write",
  pitch: "pitch",
  build: "build",
  feedback: "feedback",
  reports: "reports",
};


const storySections: { id: StorySection; code: string; label: string; group: StorySectionGroup }[] = [
  { id: "simpleStart", code: "SS", label: "Simple Start", group: "Project" },
  { id: "overview", code: "OV", label: "Project Overview", group: "Project" },
  { id: "storySetup", code: "01", label: "Story Setup", group: "Foundation" },
  { id: "concept", code: "CC", label: "Concept Canvas", group: "Foundation" },
  { id: "references", code: "VR", label: "Visual References", group: "Foundation" },
  { id: "pitch", code: "PV", label: "Pitch & Vision", group: "Foundation" },
  { id: "world", code: "WD", label: "World", group: "Foundation" },
  { id: "characters", code: "CH", label: "Characters", group: "Foundation" },
  { id: "ghost", code: "GH", label: "Ghost", group: "Foundation" },
  { id: "catalyst", code: "CA", label: "Catalyst", group: "Foundation" },
  { id: "foundations", code: "FN", label: "Foundations", group: "Foundation" },
  { id: "pickle", code: "PK", label: "The Pickle", group: "Foundation" },
  { id: "dialogue", code: "DL", label: "Dialogue", group: "Foundation" },
  { id: "coreModel", code: "CM", label: "Core Model", group: "Foundation" },
  { id: "structureMap", code: "ST", label: "Structure Map", group: "Structure" },
  { id: "blocks", code: "24", label: "24 Blocks", group: "Structure" },
  { id: "storyboard", code: "SB", label: "Storyboard", group: "Production" },
  { id: "notes", code: "NT", label: "Notes", group: "Production" },
];

const sectionGuides: Record<StorySection, { title: string; description: string; questions: string[]; deliverable: string; connection: string }> = {
  simpleStart: {
    title: "Choose a clear way into the story.",
    description: "Simple Start is an optional beginner pathway inside Story Planner, not a required splash screen.",
    questions: ["Are you continuing, importing, learning, or beginning fresh?", "What is the smallest useful next step?", "Would the Afterglow example help?"],
    deliverable: "A deliberate entry point without blocking the main workspace.",
    connection: "Simple Start opens the same local project used by every PlotPickle workspace.",
  },
  overview: {
    title: "Re-enter the project through one clear dashboard.",
    description: "See overall progress, the next useful task, structural coverage, open questions, and ownership information before choosing where to work.",
    questions: ["What is the project asking for next?", "Which section is underdeveloped?", "What question or continuity issue should remain visible?"],
    deliverable: "A current project snapshot and a deliberate next step.",
    connection: "Every story column, engine, block, scene, and visual contributes to the same overview.",
  },
  storySetup: {
    title: "Set the creative container before filling it.",
    description: "Define the format, audience, scope, and working conditions that every later choice must serve.",
    questions: ["What are you making and how long is it?", "Who is the story for?", "What practical limits or collaborators shape the work?"],
    deliverable: "A clear project identity and production-sized creative container.",
    connection: "Pitch, world, block pacing, and visual scale all inherit these decisions.",
  },
  concept: {
    title: "Catch the creative seed before it becomes a prompt.",
    description: "Record the incomplete idea, emotional purpose, audience experience, visual impact, constraints, and open space without choosing a provider.",
    questions: ["What is the raw idea or fragment?", "What must remain true?", "What are you still free to explore visually or narratively?"],
    deliverable: "A saved concept attached to a project target and ready for later exploration.",
    connection: "The concept can attach to the whole project, a character, location, Block, mini-block, or scene while keeping provider details in Settings.",
  },
  references: {
    title: "Collect visual references with permission context.",
    description: "Import or link photographs, sketches, palettes and prior assets as story-targeted reference material with rights and provenance attached.",
    questions: ["What is the reference for?", "Who owns it or what permission applies?", "Which story target should later visual work inherit it from?"],
    deliverable: "A reference library that distinguishes inspiration, identity, continuity and composition guidance.",
    connection: "Later context assembly can use the purpose and rights state without exposing private local paths, credentials or provider fields.",
  },
  pitch: {
    title: "Make the promise visible in a few sentences.",
    description: "The pitch names the protagonist, pressure, difference, emotional experience, and visual identity without explaining the whole plot.",
    questions: ["What makes this story immediately distinct?", "What emotional journey are you promising?", "What image or tension makes someone want the next sentence?"],
    deliverable: "A one-sentence hook, short pitch, audience promise, and visual vision.",
    connection: "The logline and vision become reference material in every planning and storyboard decision.",
  },
  world: {
    title: "Build a world that applies pressure.",
    description: "Setting is a system of rules, cultures, histories, technologies, and locations that changes what characters can choose.",
    questions: ["What is normal before the story begins?", "Which rules cannot be broken without consequence?", "How does the new world challenge the protagonist's old strategy?"],
    deliverable: "A reusable world bible and location library.",
    connection: "Locations and visual language attach directly to blocks and storyboard frames.",
  },
  characters: {
    title: "Give every character a strategy and a contradiction.",
    description: "Track role, want, need, strengths, flaw, arc, relationships, and voice so choices remain character-specific.",
    questions: ["What does each character pursue consciously?", "What truth are they avoiding?", "How does each relationship change the available choice?"],
    deliverable: "A connected cast with distinct arcs, relationships, and voices.",
    connection: "Characters can be attached to blocks and carried into visual continuity.",
  },
  ghost: {
    title: "Name the past that keeps acting in the present.",
    description: "The ghost is the wound, loss, trauma, or inherited belief that created the protagonist's protective lie.",
    questions: ["What happened before page one?", "What false belief made survival possible then?", "How does the story repeatedly trigger that old strategy?"],
    deliverable: "A cause-and-effect line from wound to lie to behaviour to truth.",
    connection: "The ghost supplies emotional meaning to choices, dialogue, and the final transformation.",
  },
  catalyst: {
    title: "Break the ordinary world with a consequential event.",
    description: "The catalyst does more than happen: it creates an immediate problem, exposes resistance, and forces a choice toward a new arena.",
    questions: ["Why must this happen now?", "What changes before the protagonist is ready?", "Which choice makes return to normal impossible?"],
    deliverable: "A precise event, impact, forced choice, resistance, and doorway.",
    connection: "The catalyst anchors Block 1 and launches the central dramatic question.",
  },
  foundations: {
    title: "Lock the engine beneath the plot.",
    description: "Protagonist, objective, opposition, urgency, stakes, theme, dramatic question, and transformation form the story's diagnostic core.",
    questions: ["Who drives the story through action?", "What force can genuinely stop them?", "How will the ending prove internal change through a visible choice?"],
    deliverable: "A compact story engine that can test every block.",
    connection: "The foundations keep all 24 blocks causal instead of episodic.",
  },
  pickle: {
    title: "Give the audience something irresistible to solve.",
    description: "The Pickle is the living tension between what viewers think they know and what they still need answered. Establish a recognizable story promise, then keep refreshing how it might resolve.",
    questions: ["What question will the audience keep answering as they watch?", "What outcome can they anticipate while the route remains surprising?", "Which two explanations, hopes, or fears can remain plausible at the same time?"],
    deliverable: "An audience contract with a central tension, competing live answers, escalation pattern, final answer, and signature execution.",
    connection: "Each of the 24 blocks records the audience's current expectation and the turn that complicates, confirms, or reframes it; Visual Board carries the same tension into images.",
  },
  dialogue: {
    title: "Design voices that reveal pressure, not information.",
    description: "Dialogue should express strategy, status, subtext, genre, and relationship while making every speaker recognizably different.",
    questions: ["How does each character avoid saying what they mean?", "What rhythm and vocabulary belong only to them?", "Which exposition can become conflict or action?"],
    deliverable: "Voice contrasts, subtext rules, exposition limits, and recurring language.",
    connection: "Character voices and dialogue rules travel into every block's story text.",
  },
  coreModel: {
    title: "Track the story beneath every draft.",
    description: "Connect subplots, character-change evidence, ownership, sources, AI-assisted work and named revisions to the same canonical project.",
    questions: ["Which story thread is still unresolved?", "Where is each character's change visible?", "Can every source, collaborator and retained AI contribution be accounted for?"],
    deliverable: "A portable schema 1.7 project with complete threads, arcs, rights, provenance and revision history.",
    connection: "The Writer, Structure Engine, Reports and Settings read these same records.",
  },
  structureMap: {
    title: "See the complete hierarchy without leaving the story columns.",
    description: "Review the four acts, twelve sequences, twenty-four blocks, the live scene plan, ninety-six mini-blocks, and Story Clock before entering the full Structure Engine.",
    questions: ["Does every sequence turn the story?", "Where does the runtime concentrate?", "Which block, scene, or mini-block still lacks a clear function?"],
    deliverable: "A readable map from act to mini-block with direct block access.",
    connection: "The summary reads the same structure edited by the Structure Engine and used by every screenplay and visual workspace.",
  },
  blocks: {
    title: "Turn the story into twenty-four causal movements.",
    description: "Each five-minute block is a mini-story built from goal, conflict, choice, action, consequence, and emotional turn.",
    questions: ["What changes because of this block?", "Which choice makes the next block necessary?", "Does the external action test the internal foundation?"],
    deliverable: "Four acts of six developed blocks with linked setups and payoffs.",
    connection: "The same blocks drive the planner map and the visual board.",
  },
  storyboard: {
    title: "Translate story change into visible turns.",
    description: "Plan the images, actions, shots, and continuity details that let a viewer understand the block without explanation.",
    questions: ["What is the clearest opening image?", "Where does power or emotion visibly turn?", "Which frame carries the consequence into the next block?"],
    deliverable: "A storyboard direction and up to four key visual turns per block.",
    connection: "Directions written here appear beside the corresponding frames in Visual Board.",
  },
  notes: {
    title: "Keep uncertainty visible and actionable.",
    description: "Separate research, open questions, continuity, revisions, and sources so unresolved work does not disappear inside prose.",
    questions: ["What still needs a decision?", "Which continuity facts must survive every rewrite?", "What source or version supports the current choice?"],
    deliverable: "A living revision and source-of-truth ledger.",
    connection: "Notes remain project-wide while block-specific notes stay attached to their block.",
  },
};

const actNames = ["Setup", "Confrontation", "Complication", "Resolution"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "plotpickle-project";
}

function fieldCompletion(block: StoryBlock) {
  const values = [block.summary, block.goal, block.conflict, block.choice, block.action, block.consequence, block.audienceExpectation, block.pickleTurn];
  return Math.round((values.filter(Boolean).length / values.length) * 100);
}

function handleButtonKeyboard(event: KeyboardEvent<HTMLButtonElement>, action: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  help,
  feedback = "Ready.",
  multiline = true,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: string;
  feedback?: string;
  multiline?: boolean;
  type?: string;
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const helpId = help ? `${id}-help` : undefined;
  const statusId = `${id}-status`;
  const describedBy = [helpId, statusId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="form-field">
      <label className="field-label" htmlFor={id}>{label}</label>
      {help ? <span className="field-help" id={helpId}>{help}</span> : null}
      {multiline ? (
        <textarea
          id={id}
          aria-describedby={describedBy}
          value={value}
          placeholder={placeholder}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          aria-describedby={describedBy}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <span className="field-feedback" id={statusId} role="status">{feedback}</span>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <header className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="section-action">{action}</div> : null}
    </header>
  );
}

function Portrait({ character, size = "regular" }: { character: Character; size?: "small" | "regular" | "large" }) {
  return (
    <div className={`portrait portrait-${size}`}>
      {character.image ? <img src={character.image} alt={`${character.name} reference`} /> : <span>{initials(character.name)}</span>}
    </div>
  );
}

function LandingPage({ onEnter }: { onEnter: () => void }) {
  return <MarketingSplash onEnter={onEnter} downloadUrl={WINDOWS_DOWNLOAD_URL} components={PRODUCT_COMPONENTS} />;
}

export default function Home() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [activeTab, setActiveTab] = useState<MainTab>("dashboard");
  const [activeSection, setActiveSection] = useState<StorySection>("overview");
  const [learnSection, setLearnSection] = useState<LearnSection>("library");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(1);
  const [selectedMiniBlockNumber, setSelectedMiniBlockNumber] = useState(1);
  const [selectedVisualReferenceId, setSelectedVisualReferenceId] = useState("");
  const [feedbackTargetId, setFeedbackTargetId] = useState("");
  const [reportSection, setReportSection] = useState<ConsolidatedReportSection>("project");
  const [productionReportSection, setProductionReportSection] = useState<ProductionReportSection>("overview");
  const [reportReturnSection, setReportReturnSection] = useState<ConsolidatedReportSection | "">("");
  const [reportBuildTargetId, setReportBuildTargetId] = useState("");
  const [reportSceneId, setReportSceneId] = useState("");
  const [writerMode, setWriterMode] = useState<WriterViewMode>("treatment");
  const [visualAct, setVisualAct] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState("Saved on this device");
  const [toast, setToast] = useState("");
  const [showLanding, setShowLanding] = useState(true);
  const [afterglowCopyWorking, setAfterglowCopyWorking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const connectionState = useConnectionStatus(project, saveState);
  const afterglowExample = isAfterglowExampleProject(project);
  const reportConnections = useMemo(
    () => reportsRuntimeConnections(connectionState.snapshot),
    [connectionState.snapshot],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const requestedWorkspace = new URLSearchParams(window.location.search).get("workspace");
      const requestedTab = requestedWorkspace ? WORKSPACE_QUERY_TABS[requestedWorkspace] : undefined;
      if (requestedTab) {
        setActiveTab(requestedTab);
        setShowLanding(false);
      }
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          const normalized = normalizePlotPickleProject(parsed);
          if (normalized) {
            const exampleWasDeliberatelyOpen = window.localStorage.getItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY) === "true";
            const restored = isAfterglowExampleProject(normalized) && !exampleWasDeliberatelyOpen
              ? createAfterglowEditableCopy(normalized, { title: `${normalized.metadata.title} — Recovered Copy` })
              : isAfterglowExampleProject(normalized)
                ? createAfterglowProject()
                : normalized;
            setProject(synchronizeScreenplaySceneReferences(restored, restored.blocks));
            if (isAfterglowExampleProject(normalized) && !exampleWasDeliberatelyOpen) {
              window.localStorage.removeItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY);
              setToast("A previously editable Afterglow project was preserved as a new local copy. The bundled example is now read-only.");
            }
          }
        }
      } catch {
        setToast("The saved project could not be opened. A new project is ready instead.");
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      if (isAfterglowExampleProject(project)) {
        window.localStorage.setItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY, "true");
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(createAfterglowProject()));
        setSaveState("Read-only PlotPickle example");
        return;
      }
      window.localStorage.removeItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      setSaveState("Saved on this device");
    }, 300);
    return () => window.clearTimeout(timer);
  }, [project, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const completion = useMemo(() => completionFor(project), [project]);
  const selectedCharacter = project.characters.find((character) => character.id === selectedCharacterId) ?? project.characters[0];
  const selectedBlock = project.blocks.find((block) => block.number === selectedBlockNumber) ?? project.blocks[0];
  const feedbackModel = useMemo(() => createStoredFeedbackModel(project), [project]);
  const selectedBlockFeedbackCount = feedbackModel.badges.get(`block:${selectedBlock.id}`) ?? 0;
  const capabilityOwner = CAPABILITY_OWNER_BY_TAB[activeTab];

  if (showLanding) {
    return <LandingPage onEnter={() => setShowLanding(false)} />;
  }

  function commit(next: PlotPickleProject) {
    if (isAfterglowExampleProject(project) && isAfterglowExampleProject(next)) {
      setSaveState("Read-only PlotPickle example");
      setToast("Afterglow is a read-only example. Choose Make My Own Copy before changing canon, images, dialogue or project settings.");
      return;
    }
    if (!isAfterglowExampleProject(next)) window.localStorage.removeItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY);
    setSaveState("Saving…");
    const synchronized = synchronizeScreenplaySceneReferences(next, project.blocks);
    setProject({
      ...synchronized,
      metadata: { ...synchronized.metadata, updatedAt: new Date().toISOString() },
    });
  }

  function updateMetadata(key: keyof PlotPickleProject["metadata"], value: string) {
    commit({
      ...project,
      metadata: {
        ...project.metadata,
        [key]: key === "targetMinutes" ? Number(value) || 0 : value,
      },
    });
  }

  function updateStory(key: keyof PlotPickleProject["story"], value: string) {
    commit({ ...project, story: { ...project.story, [key]: value } });
  }

  function updateDevelopment(section: keyof PlotPickleProject["development"], key: string, value: string) {
    const currentSection = project.development[section];
    commit({
      ...project,
      development: {
        ...project.development,
        [section]: {
          ...currentSection,
          [key]: value,
          ...(section === "conceptCanvas" ? { updatedAt: new Date().toISOString() } : {}),
        },
      },
    });
  }

  function updateConceptCanvasTarget(kind: PlotPickleProject["development"]["conceptCanvas"]["targetKind"], id: string, label: string) {
    commit({
      ...project,
      development: {
        ...project.development,
        conceptCanvas: {
          ...project.development.conceptCanvas,
          targetKind: kind,
          targetId: id,
          targetLabel: label,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }

  function addVisualReference() {
    const now = new Date().toISOString();
    const reference: VisualReference = {
      id: `visual-reference-${now.replace(/[^0-9]/g, "")}`,
      title: "Untitled reference",
      sourceUrl: "",
      importFileName: "",
      sourceType: "note",
      purpose: "inspiration",
      rightsStatus: "unknown",
      ownershipNotes: "",
      permittedUse: "",
      attribution: "",
      targetKind: "project",
      targetId: "project",
      targetLabel: "Whole project",
      notes: "",
      createdAt: now,
      updatedAt: now,
    };
    setSelectedVisualReferenceId(reference.id);
    commit({
      ...project,
      development: {
        ...project.development,
        visualReferences: [...project.development.visualReferences, reference],
      },
    });
  }

  function updateVisualReference(id: string, key: keyof VisualReference, value: string) {
    commit({
      ...project,
      development: {
        ...project.development,
        visualReferences: project.development.visualReferences.map((reference) =>
          reference.id === id ? { ...reference, [key]: value, updatedAt: new Date().toISOString() } : reference,
        ),
      },
    });
  }

  function updateVisualReferenceTarget(id: string, kind: VisualReference["targetKind"], targetId: string, targetLabel: string) {
    commit({
      ...project,
      development: {
        ...project.development,
        visualReferences: project.development.visualReferences.map((reference) =>
          reference.id === id ? { ...reference, targetKind: kind, targetId, targetLabel, updatedAt: new Date().toISOString() } : reference,
        ),
      },
    });
  }

  function updateWorld(key: Exclude<keyof PlotPickleProject["world"], "locations">, value: string) {
    commit({ ...project, world: { ...project.world, [key]: value } });
  }

  function updateCharacter(id: string, key: keyof Character, value: string) {
    commit({
      ...project,
      characters: project.characters.map((character) => (character.id === id ? { ...character, [key]: value } : character)),
    });
  }

  function updateLocation(id: string, key: keyof Location, value: string) {
    commit({
      ...project,
      world: {
        ...project.world,
        locations: project.world.locations.map((location) => (location.id === id ? { ...location, [key]: value } : location)),
      },
    });
  }

  function updateBlock(number: number, key: keyof StoryBlock, value: string | string[]) {
    commit({
      ...project,
      blocks: project.blocks.map((block) => (block.number === number ? { ...block, [key]: value } : block)),
    });
  }

  function toggleBlockReference(kind: "characterIds" | "locationIds", id: string) {
    const current = selectedBlock[kind];
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    updateBlock(selectedBlock.number, kind, next);
  }

  function createNewProject() {
    if (completion > 0 && !window.confirm("Start a new project? Export your current project first if you want a separate backup.")) return;
    const blank = createBlankProject();
    window.localStorage.removeItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY);
    setSaveState("Saving…");
    setProject(blank);
    setSelectedCharacterId("");
    setSelectedBlockNumber(1);
    setSelectedMiniBlockNumber(1);
    setSelectedVisualReferenceId("");
    setActiveTab("planner");
    setActiveSection("storySetup");
    setToast("A blank feature screenplay is ready. Begin with Story Setup, then build the 24 Blocks and 96 mini-blocks.");
  }

  async function loadAfterglow() {
    if (completion > 0 && !isAfterglowExampleProject(project) && !window.confirm("Replace the current project with the read-only Afterglow example? Export first if you want a backup.")) return;
    const candidate = createAfterglowProject();
    const afterglow = synchronizeScreenplaySceneReferences(candidate, candidate.blocks);
    window.localStorage.setItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY, "true");
    setProject(afterglow);
    setSelectedCharacterId("ren");
    setSelectedBlockNumber(1);
    setSelectedMiniBlockNumber(1);
    setActiveTab("planner");
    setActiveSection("overview");
    setSaveState("Read-only PlotPickle example");
    setToast("Afterglow — PlotPickle Example Story is open read-only across the Story Planner, all 96 Treatment positions, and Visual Storyboard context. Unreconciled material is clearly marked. Choose Make My Own Copy before editing.");
  }

  async function saveProjectToLocalLibrary(next: PlotPickleProject) {
    const response = await fetch("/api/local-projects/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: next, fileName: afterglowCopyFileName(next) }),
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() as { message?: string } : {};
    if (!response.ok) throw new Error(payload.message || "The Afterglow copy could not be saved to the local project library.");
  }

  async function makeAfterglowCopy() {
    if (!isAfterglowExampleProject(project) || afterglowCopyWorking) return;
    setAfterglowCopyWorking(true);
    setSaveState("Creating editable local copy…");
    try {
      const copy = synchronizeScreenplaySceneReferences(createAfterglowEditableCopy(project), project.blocks);
      await saveProjectToLocalLibrary(copy);
      window.localStorage.removeItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY);
      setProject(copy);
      setSelectedCharacterId(copy.characters[0]?.id ?? "");
      setSelectedBlockNumber(1);
      setSelectedMiniBlockNumber(1);
      setActiveTab("planner");
      setActiveSection("overview");
      setSaveState("Saved in local project library");
      setToast("Your editable Afterglow copy has a new project ID, local PPF and rolling-backup path. No GitHub repository is connected until you choose one.");
      await connectionState.refresh();
    } catch (error) {
      setSaveState("Read-only PlotPickle example");
      setToast(error instanceof Error ? error.message : "The editable Afterglow copy could not be created.");
    } finally {
      setAfterglowCopyWorking(false);
    }
  }

  function resetAfterglow() {
    if (!isAfterglowExampleProject(project)) return;
    if (!window.confirm("Reset the bundled Afterglow example to its original PlotPickle state? Your separate copies are not affected.")) return;
    const candidate = createAfterglowProject();
    const reset = synchronizeScreenplaySceneReferences(candidate, candidate.blocks);
    window.localStorage.setItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY, "true");
    setProject(reset);
    setSelectedCharacterId("ren");
    setSelectedBlockNumber(1);
    setSelectedMiniBlockNumber(1);
    setActiveTab("planner");
    setActiveSection("overview");
    setSaveState("Read-only PlotPickle example");
    setToast("The bundled Afterglow example was reset. Your local copies and repositories were not changed.");
  }

  function openAfterglowGraphicNovel() {
    setActiveTab("pitch");
    setToast("Opened Afterglow’s sample Graphic Novel workspace. The example remains read-only until you make a copy.");
  }

  function exportProject() {
    const contents = JSON.stringify(project, null, 2);
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(project.metadata.title)}.plotpickle.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setToast("Project exported as canonical PlotPickle JSON.");
  }

  function replaceWithImportedScreenplay(screenplay: ScreenplayDocument) {
    const hasCurrentWork = completion > 0 || Boolean(project.screenplay.sourceText);
    if (hasCurrentWork && !window.confirm(`Replace “${project.metadata.title}” with ${screenplay.fileName}? Export first if you want a separate backup.`)) return false;
    const imported = createProjectFromScreenplay(screenplay);
    window.localStorage.removeItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY);
    setSaveState("Saving…");
    const synchronized = synchronizeScreenplaySceneReferences(imported, imported.blocks);
    setProject(synchronized);
    setSelectedCharacterId(synchronized.characters[0]?.id ?? "");
    setSelectedBlockNumber(1);
    setSelectedMiniBlockNumber(1);
    setVisualAct(0);
    setActiveTab("script");
    setActiveSection("overview");
    setToast(`${screenplay.fileName} replaced the example project. ${imported.characters.length} characters, ${imported.world.locations.length} locations, and 24 suggested Blocks are ready to review.`);
    return true;
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const sourceText = await file.text();
      if (/\.json$/i.test(file.name)) {
        const parsed: unknown = JSON.parse(sourceText);
        const normalized = normalizePlotPickleProject(parsed);
        if (!normalized) throw new Error("invalid-project");
        commit(cloneProject(normalized));
        setSelectedCharacterId(normalized.characters[0]?.id ?? "");
        setSelectedBlockNumber(1);
        setSelectedVisualReferenceId(normalized.development.visualReferences[0]?.id ?? "");
        setToast("Project imported and connected to all PlotPickle workspaces.");
        return;
      }
      if (!/\.(?:txt|fountain|spmd|fdx)$/i.test(file.name)) throw new Error("unsupported-script");
      replaceWithImportedScreenplay({
        fileName: file.name,
        format: screenplayFormatForFile(file.name),
        sourceText,
        importedAt: new Date().toISOString(),
        analysisStatus: "none",
        analyzedAt: "",
        suggestedFields: [],
        draftElements: [],
        productionDraft: createBlankProductionDraftState(),
      });
    } catch {
      setToast("Choose a PlotPickle JSON project or a TXT, Fountain, SPMD, or Final Draft FDX screenplay.");
    }
  }

  function confirmImportedSuggestions() {
    commit(markScreenplayAnalysisReviewed(project));
    setToast("The imported structure is marked reviewed. You can continue revising any answer.");
  }

  function addCharacter() {
    const next = addBlankCharacter(project);
    const created = next.characters[next.characters.length - 1];
    commit(next);
    setSelectedCharacterId(created.id);
  }

  function addLocation() {
    const next = addBlankLocation(project);
    commit(next);
  }

  function openBlock(number: number, destination: MainTab = "planner") {
    setSelectedBlockNumber(number);
    setSelectedMiniBlockNumber(1);
    setActiveTab(destination);
    setActiveSection(destination === "planner" ? "blocks" : "storyboard");
  }

  function openFeedback(targetId: string) {
    setFeedbackTargetId(targetId);
    setActiveTab("feedback");
  }

  function openFeedbackTarget(target: FeedbackTargetReference) {
    setFeedbackTargetId(target.targetId);
    const block = project.blocks.find((candidate) => candidate.id === target.blockId)
      ?? project.blocks.find((candidate) => candidate.scenes.some((scene) => scene.id === target.sceneId || scene.miniBlocks.some((mini) => mini.id === target.miniBlockId)));
    if (block) setSelectedBlockNumber(block.number);
    if (target.miniBlockId && block) {
      const mini = block.scenes.flatMap((scene) => scene.miniBlocks).find((candidate) => candidate.id === target.miniBlockId);
      if (mini) setSelectedMiniBlockNumber(mini.number);
    }
    if (target.characterId) setSelectedCharacterId(target.characterId);
    if (target.workspace === "build") setActiveTab("build");
    else if (target.workspace === "write") setActiveTab("script");
    else if (target.workspace === "storyboard") setActiveTab("visuals");
    else if (target.workspace === "refine") setActiveTab("engines");
    else if (target.workspace === "reports") setActiveTab("reports");
    else if (target.workspace === "dashboard") setActiveTab("dashboard");
    else if (target.workspace === "plan") {
      setActiveTab("planner");
      setActiveSection(target.characterId ? "characters" : target.kind === "world" ? "world" : block ? "blocks" : "overview");
    } else setActiveTab("feedback");
  }

  function openReportTarget(target: ReportTarget) {
    if (target.workspace === "reports") {
      setReportSection(target.targetId as ConsolidatedReportSection);
      setReportReturnSection("");
      setActiveTab("reports");
      return;
    }

    const block = project.blocks.find((candidate) => candidate.id === target.blockId || candidate.id === target.targetId)
      ?? project.blocks.find((candidate) => candidate.scenes.some((scene) => (
        scene.id === target.sceneId
        || scene.id === target.targetId
        || scene.miniBlocks.some((mini) => mini.id === target.miniBlockId || mini.id === target.targetId)
      )));
    if (block) setSelectedBlockNumber(block.number);
    if (target.miniBlockId && block) {
      const mini = block.scenes.flatMap((scene) => scene.miniBlocks).find((candidate) => candidate.id === target.miniBlockId);
      if (mini) setSelectedMiniBlockNumber(mini.number);
    }
    if (target.characterId) setSelectedCharacterId(target.characterId);

    setReportReturnSection(reportSection);
    if (target.workspace === "dashboard") setActiveTab("dashboard");
    else if (target.workspace === "build") {
      setReportBuildTargetId(target.blockId || target.miniBlockId || target.targetId);
      setActiveTab("build");
    } else if (target.workspace === "write") {
      setWriterMode("screenplay");
      setReportSceneId(target.sceneId);
      setActiveTab("script");
    } else if (target.workspace === "storyboard") {
      if (block) setVisualAct(block.act);
      setActiveTab("visuals");
    } else if (target.workspace === "refine") setActiveTab("engines");
    else if (target.workspace === "feedback") {
      setFeedbackTargetId(target.targetId);
      setActiveTab("feedback");
    } else if (target.workspace === "settings") setActiveTab("settings");
    else if (target.workspace === "plan") {
      setActiveTab("planner");
      if (target.characterId) setActiveSection("characters");
      else if (target.targetId === "world") setActiveSection("world");
      else if (target.targetId === "storySetup") setActiveSection("storySetup");
      else if (block) setActiveSection("blocks");
      else setActiveSection("overview");
    }
  }

  return (
    <div className="app-shell">
      <ApplicationShellHeader
        activeTab={activeTab}
        onNavigate={(tab) => {
          setReportBuildTargetId("");
          setReportSceneId("");
          if (tab === "reports") setReportReturnSection("");
          setActiveTab(tab);
        }}
        onOpenLanding={() => setShowLanding(true)}
        onProjectAction={(action) => {
          if (action === "new-project") createNewProject();
          else if (action === "import") fileInputRef.current?.click();
          else if (action === "export") exportProject();
          else loadAfterglow();
        }}
      />

      <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json,.json,.txt,.fountain,.spmd,.fdx,text/plain,text/xml,application/xml" onChange={importFile} />

      <div className="project-strip">
        <div className="project-title">
          <span className="status-dot" />
          <div>
            <strong>{project.metadata.title}</strong>
            <span>{project.metadata.status}</span>
          </div>
        </div>
        <div className="save-state">{saveState}</div>
        {project.screenplay.analysisStatus === "suggested" ? <div className="save-state">Script-derived suggestions <button type="button" className="text-button" onClick={confirmImportedSuggestions}>Mark reviewed</button></div> : null}
        <div className="progress-block" aria-label={`${completion}% story planning complete`}>
          <output>{completion}% complete</output>
          <progress className="progress-track" value={completion} max="100">{completion}%</progress>
        </div>
      </div>

      {afterglowExample ? (
        <AfterglowExampleBoundary
          working={afterglowCopyWorking}
          onMakeCopy={() => { void makeAfterglowCopy(); }}
          onReset={resetAfterglow}
          onOpenGraphicNovel={openAfterglowGraphicNovel}
        />
      ) : null}

      {reportReturnSection && activeTab !== "reports" ? (
        <div className="project-strip" role="status">
          <div className="project-title">
            <span className="status-dot" />
            <div>
              <strong>Viewing an exact report target</strong>
              <span>Your selected Reports view is preserved.</span>
            </div>
          </div>
          <button type="button" className="secondary-button compact" onClick={() => {
            setReportReturnSection("");
            setReportBuildTargetId("");
            setReportSceneId("");
            setActiveTab("reports");
          }}>
            Return to {reportReturnSection.charAt(0).toUpperCase() + reportReturnSection.slice(1)} report
          </button>
          <div className="save-state">No report state was duplicated or changed.</div>
        </div>
      ) : null}

      <main className="workspace">
        {capabilityOwner ? <WorkspaceCapabilityShelf workspace={capabilityOwner} /> : null}

        {activeTab === "dashboard" ? (
          <DashboardCommandCentre
            project={project}
            saveState={saveState}
            settings={connectionState.settings}
            connectionStatus={connectionState.snapshot}
            afterglowCopyWorking={afterglowCopyWorking}
            onNavigate={(workspace, section) => {
              setActiveTab(workspace);
              if (workspace === "planner" && section) setActiveSection(section as StorySection);
            }}
            onOpenBlock={(number) => openBlock(number, "planner")}
            onLoadAfterglow={() => { void loadAfterglow(); }}
            onMakeAfterglowCopy={() => { void makeAfterglowCopy(); }}
            onResetAfterglow={resetAfterglow}
            onOpenAfterglowGraphicNovel={openAfterglowGraphicNovel}
          />
        ) : null}

        {activeTab === "instructions" ? (
          <Introduction
            project={project}
            activeSection={activeSection}
            selectSection={setActiveSection}
            onStart={() => setActiveTab("planner")}
            onLoadAfterglow={loadAfterglow}
          />
        ) : null}

        {activeTab === "build" ? (
          <BuildWorkspace
            project={project}
            initialTargetId={reportBuildTargetId}
            onProjectChange={commit}
            onOpenBlock={(number) => openBlock(number, "planner")}
            onOpenFeedback={openFeedback}
          />
        ) : null}

        {activeTab === "planner" ? (
          <div className="studio-layout">
            <StoryRail project={project} workspace="Story Planner" activeSection={activeSection} selectSection={setActiveSection} />

            <section className="planner-content">
              {activeSection === "simpleStart" ? (
                <SimpleStart
                  project={project}
                  onContinue={() => setActiveSection("overview")}
                  onNew={createNewProject}
                  onLearn={() => setActiveTab("learn")}
                  onImport={() => fileInputRef.current?.click()}
                  onAfterglow={loadAfterglow}
                />
              ) : null}
              {activeSection === "overview" ? (
                <ProjectOverview
                  project={project}
                  onOpenSection={(section) => setActiveSection(section as StorySection)}
                  onOpenEngines={() => setActiveTab("engines")}
                  onOpenBlock={(number) => openBlock(number, "planner")}
                />
              ) : null}
              {activeSection === "structureMap" ? (
                <StructureMapSummary project={project} onOpenBlock={(number) => openBlock(number, "planner")} />
              ) : null}
              {activeSection === "storySetup" ? (
                <StorySetupEditor project={project} updateMetadata={updateMetadata} updateDevelopment={updateDevelopment} />
              ) : null}
              {activeSection === "concept" ? (
                <ConceptCanvasEditor
                  project={project}
                  updateDevelopment={updateDevelopment}
                  updateTarget={updateConceptCanvasTarget}
                  startExploration={() => setActiveTab("visuals")}
                />
              ) : null}
              {activeSection === "references" ? (
                <VisualReferenceEditor
                  project={project}
                  selectedId={selectedVisualReferenceId}
                  select={setSelectedVisualReferenceId}
                  add={addVisualReference}
                  update={updateVisualReference}
                  updateTarget={updateVisualReferenceTarget}
                />
              ) : null}
              {activeSection === "pitch" ? (
                <PitchVisionEditor project={project} updateMetadata={updateMetadata} updateStory={updateStory} updateDevelopment={updateDevelopment} />
              ) : null}
              {activeSection === "world" ? (
                <WorldEditor project={project} updateWorld={updateWorld} updateLocation={updateLocation} addLocation={addLocation} />
              ) : null}
              {activeSection === "characters" ? (
                <CharacterEditor
                  project={project}
                  selected={selectedCharacter}
                  select={setSelectedCharacterId}
                  update={updateCharacter}
                  add={addCharacter}
                />
              ) : null}
              {activeSection === "ghost" ? (
                <GhostEditor project={project} selected={selectedCharacter} select={setSelectedCharacterId} updateCharacter={updateCharacter} updateDevelopment={updateDevelopment} />
              ) : null}
              {activeSection === "catalyst" ? (
                <CatalystEditor project={project} updateStory={updateStory} updateDevelopment={updateDevelopment} />
              ) : null}
              {activeSection === "foundations" ? (
                <FoundationsEditor project={project} updateStory={updateStory} updateDevelopment={updateDevelopment} />
              ) : null}
              {activeSection === "pickle" ? (
                <PickleEditor project={project} updateDevelopment={updateDevelopment} />
              ) : null}
              {activeSection === "dialogue" ? (
                <DialogueEditor project={project} selected={selectedCharacter} select={setSelectedCharacterId} updateCharacter={updateCharacter} updateDevelopment={updateDevelopment} />
              ) : null}
              {activeSection === "coreModel" ? (
                <div className="editor-page"><CoreModelStudio project={project} onChange={commit} /></div>
              ) : null}
              {activeSection === "blocks" ? (
                <BlocksEditor
                  project={project}
                  selectedBlock={selectedBlock}
                  openBlock={openBlock}
                  updateBlock={updateBlock}
                  toggleReference={toggleBlockReference}
                  openVisual={(number) => openBlock(number, "visuals")}
                />
              ) : null}
              {activeSection === "storyboard" ? (
                <StoryboardPlanner project={project} selectedBlock={selectedBlock} openBlock={(number) => setSelectedBlockNumber(number)} updateBlock={updateBlock} openVisual={(number) => openBlock(number, "visuals")} />
              ) : null}
              {activeSection === "notes" ? (
                <NotesEditor project={project} updateStory={updateStory} updateDevelopment={updateDevelopment} />
              ) : null}
            </section>
          </div>
        ) : null}

        {activeTab === "learn" ? (
          <div className={writerStyles.workspaceShell}>
            <nav className="learn-section-tabs" aria-label="Learn sections">
              <button type="button" aria-current={learnSection === "introduction" ? "page" : undefined} className={learnSection === "introduction" ? "active" : ""} onClick={() => setLearnSection("introduction")}>Introduction</button>
              <button type="button" aria-current={learnSection === "library" ? "page" : undefined} className={learnSection === "library" ? "active" : ""} onClick={() => setLearnSection("library")}>Complete Learning Library</button>
              <button type="button" aria-current={learnSection === "terminology" ? "page" : undefined} className={learnSection === "terminology" ? "active" : ""} onClick={() => setLearnSection("terminology")}>Terminology</button>
              <button type="button" aria-current={learnSection === "screenplay" ? "page" : undefined} className={learnSection === "screenplay" ? "active" : ""} onClick={() => setLearnSection("screenplay")}>Screenplay Study</button>
            </nav>
            {learnSection === "introduction" ? (
              <Introduction
                project={project}
                activeSection={activeSection}
                selectSection={setActiveSection}
                onStart={() => setActiveTab("planner")}
                onLoadAfterglow={loadAfterglow}
              />
            ) : null}
            {learnSection === "library" ? (
              <LearningStudio
                project={project}
                blockNumber={selectedBlockNumber}
                miniBlockNumber={selectedMiniBlockNumber}
                onBlockChange={setSelectedBlockNumber}
                onMiniBlockChange={setSelectedMiniBlockNumber}
                onOpenTreatment={() => {
                  setWriterMode("treatment");
                  setActiveTab("script");
                }}
                onOpenScreenplay={() => {
                  setWriterMode("screenplay");
                  setActiveTab("script");
                }}
                onOpenBlock={(number) => openBlock(number, "planner")}
              />
            ) : null}
            {learnSection === "terminology" ? (
              <details className={writerStyles.scriptStudy} open>
                <summary>Screenplay terminology</summary>
                <TerminologyIndex />
              </details>
            ) : null}
            {learnSection === "screenplay" ? (
              <details className={writerStyles.scriptStudy} open>
                <summary>{project.screenplay.sourceText ? "Study the loaded screenplay" : "Load a screenplay to study"}</summary>
                <ScriptViewer
                  project={project}
                  onImport={replaceWithImportedScreenplay}
                  onOpenBlock={(number) => openBlock(number, "planner")}
                />
              </details>
            ) : null}
          </div>
        ) : null}

        {activeTab === "script" ? (
          <>
            <FeedbackContextBadge count={selectedBlockFeedbackCount} label={`Block ${selectedBlock.number} · ${selectedBlock.title}`} onOpen={() => openFeedback(selectedBlock.id)} />
            <ScriptWorkspace
              project={project}
              mode={writerMode}
              initialBlockNumber={selectedBlockNumber}
              initialSceneId={reportSceneId}
              onModeChange={setWriterMode}
              onChange={(screenplay) => commit({ ...project, screenplay })}
              onProjectChange={commit}
              onOpenBlock={(number) => openBlock(number, "planner")}
            />
          </>
        ) : null}

        {activeTab === "visuals" ? (
          <div className="studio-layout visual-studio-layout">
            <StoryRail project={project} workspace="Visual Board" activeSection={activeSection} selectSection={setActiveSection} />
            <div>
              <FeedbackContextBadge count={selectedBlockFeedbackCount} label={`Block ${selectedBlock.number} · ${selectedBlock.title}`} onOpen={() => openFeedback(selectedBlock.id)} />
              <VisualStoryboard
                project={project}
                initialBlockNumber={selectedBlock.number}
                visualAct={visualAct}
                onVisualActChange={setVisualAct}
                onOpenPlannerBlock={(number) => openBlock(number, "planner")}
                onChange={commit}
              />
            </div>
          </div>
        ) : null}

        {activeTab === "pitch" ? (
          <AiPitchDeckWorkspace
            project={project}
            aiStatus={connectionState.snapshot.items.ai}
            imageModel={connectionState.settings.ai.imageModel}
            onProjectChange={commit}
            onOpenAiSettings={() => {
              window.sessionStorage.setItem("plotpickle.settings.section", "ai");
              window.dispatchEvent(new CustomEvent("plotpickle:settings-section", { detail: "ai" }));
              setActiveTab("settings");
            }}
            onOpenCharacters={() => {
              setActiveSection("characters");
              setActiveTab("planner");
            }}
          />
        ) : null}

        {activeTab === "engines" ? <EngineHub onOpenBuild={() => {
          setReportBuildTargetId("mini-blocks");
          setActiveTab("build");
        }} /> : null}

        {activeTab === "feedback" ? (
          <FeedbackWorkspace project={project} onProjectChange={commit} onOpenTarget={openFeedbackTarget} initialTargetId={feedbackTargetId} />
        ) : null}

        {activeTab === "reports" ? <ReportsWorkspace project={project} section={reportSection} onSectionChange={setReportSection} productionSection={productionReportSection} onProductionSectionChange={setProductionReportSection} onOpenTarget={openReportTarget} runtimeConnections={reportConnections} /> : null}

        {activeTab === "collab" ? (
          <CollabWorkspace
            project={project}
            onProjectChange={commit}
            connections={connectionState.snapshot}
            onConnectionChange={connectionState.refresh}
            onOpenSettings={(section) => {
              window.sessionStorage.setItem("plotpickle.settings.section", section);
              window.dispatchEvent(new CustomEvent("plotpickle:settings-section", { detail: section }));
              setActiveTab("settings");
            }}
          />
        ) : null}

        {activeTab === "community" ? (
          <BuzzCommunityWorkspace
            onOpenSettings={() => {
              window.sessionStorage.setItem("plotpickle.settings.section", "buzz");
              window.dispatchEvent(new CustomEvent("plotpickle:settings-section", { detail: "buzz" }));
              setActiveTab("settings");
            }}
          />
        ) : null}

        <div hidden={activeTab !== "settings"}>
          <SettingsPanel project={project} onProjectChange={commit} connections={connectionState.snapshot} onConnectionChange={connectionState.refresh} />
        </div>
      </main>

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}
type DevelopmentUpdater = (section: keyof PlotPickleProject["development"], key: string, value: string) => void;

function StoryRail({ project, workspace, activeSection, selectSection }: { project: PlotPickleProject; workspace: string; activeSection: StorySection; selectSection: (section: StorySection) => void }) {
  const progress = projectSectionProgress(project);
  const groups: StorySectionGroup[] = ["Project", "Foundation", "Structure", "Production"];
  return (
    <aside className="story-rail">
      <div className="story-rail-heading">
        <p className="eyebrow">{workspace}</p>
        <strong>Story columns</strong>
        <span>One story. Five connected workspaces.</span>
      </div>
      <nav aria-label="Story sections">
        {groups.map((group) => (
          <div className="story-rail-group" key={group}>
            <p className="story-rail-group-label">{group}</p>
            {storySections.filter((section) => section.group === group).map((section) => {
              const sectionProgress = progress[section.id];
              const alert = sectionHasAlert(project, section.id);
              const symbol = alert ? "!" : sectionProgress >= 70 ? "✓" : sectionProgress > 0 ? "◐" : "○";
              const status = alert ? "Open question or continuity item" : sectionProgress >= 70 ? "Substantially complete" : sectionProgress > 0 ? "In progress" : "Not started";
              return (
                <button type="button" aria-current={activeSection === section.id ? "page" : undefined} className={activeSection === section.id ? "active" : ""} key={section.id} onClick={() => selectSection(section.id)}>
                  <span>{section.code}</span>
                  <strong>{section.label}</strong>
                  <i className={alert ? "rail-progress alert" : "rail-progress"} aria-label={`${status}: ${sectionProgress}%`}>{symbol}</i>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="method-note">
        <span>Complete hierarchy</span>
        <strong>4 → 12 → 24 → flexible scenes → 96</strong>
        <p>Forty-eight scenes are the starting template; the live scene count changes with the story.</p>
      </div>
    </aside>
  );
}

function Introduction({ project, activeSection, selectSection, onStart, onLoadAfterglow }: { project: PlotPickleProject; activeSection: StorySection; selectSection: (section: StorySection) => void; onStart: () => void; onLoadAfterglow: () => void }) {
  const guide = sectionGuides[activeSection];
  const current = storySections.find((section) => section.id === activeSection) ?? storySections[0];
  return (
    <div className="studio-layout introduction-layout instructions-layout">
      <StoryRail project={project} workspace="Introduction" activeSection={activeSection} selectSection={selectSection} />
      <section className="guide-page">
        <div className="guide-hero">
          <div>
            <p className="eyebrow">{current.code} · {current.label}</p>
            <h1>{guide.title}</h1>
            <p>{guide.description}</p>
            <div className="hero-actions">
              <button type="button" className="primary-button" onClick={onStart}>Work on {current.label}</button>
              <button type="button" className="secondary-button" onClick={onLoadAfterglow}>See it in Afterglow</button>
            </div>
          </div>
          <div className="guide-number" aria-hidden="true"><span>{current.code}</span><small>{current.label}</small></div>
        </div>
        <div className="guide-grid">
          <article className="guide-card questions-card">
            <p className="eyebrow">Questions to consider</p>
            <ol>{guide.questions.map((question) => <li key={question}>{question}</li>)}</ol>
          </article>
          <article className="guide-card"><p className="eyebrow">Section deliverable</p><h2>{guide.deliverable}</h2></article>
          <article className="guide-card connection-card"><p className="eyebrow">Shared story data</p><h2>{guide.connection}</h2><div><span>Introduction</span><i>→</i><span>Plan</span><i>→</i><span>Write</span><i>→</i><span>Storyboard</span><i>→</i><span>Refine</span></div></article>
        </div>
        {activeSection === "blocks" ? (
          <div className="compact-act-guide">
            {actNames.map((name, index) => <article className={`act-${index + 1}`} key={name}><span>Act {index + 1}</span><strong>{name}</strong><small>Blocks {index * 6 + 1}–{index * 6 + 6}</small></article>)}
          </div>
        ) : null}
        {activeSection === "overview" ? <ReadmeTabs /> : null}
      </section>
    </div>
  );
}

function ConceptCanvasEditor({
  project,
  updateDevelopment,
  updateTarget,
  startExploration,
}: {
  project: PlotPickleProject;
  updateDevelopment: DevelopmentUpdater;
  updateTarget: (kind: PlotPickleProject["development"]["conceptCanvas"]["targetKind"], id: string, label: string) => void;
  startExploration: () => void;
}) {
  const canvas = project.development.conceptCanvas;
  const targetHelpId = "concept-canvas-target-help";
  const targetOptions = [
    { kind: "project" as const, id: "project", label: "Whole project" },
    ...project.characters.map((character) => ({ kind: "character" as const, id: character.id, label: `Character · ${character.name}` })),
    ...project.world.locations.map((location) => ({ kind: "location" as const, id: location.id, label: `Location · ${location.name}` })),
    ...project.blocks.map((block) => ({ kind: "block" as const, id: block.id, label: `Block ${block.number} · ${block.title}` })),
    ...project.blocks.flatMap((block) => block.visuals.map((frame) => ({
      kind: "mini-block" as const,
      id: `${block.id}:mini-${frame.miniBlockNumber}`,
      label: `Mini-block ${block.number}.${frame.miniBlockNumber} · ${block.title}`,
    }))),
    ...project.blocks.flatMap((block) => block.scenes.map((scene) => ({
      kind: "scene" as const,
      id: scene.id,
      label: `Scene · ${scene.heading || `Block ${block.number}`}`,
    }))),
  ];
  const selectedTarget = targetOptions.find((option) => option.kind === canvas.targetKind && option.id === canvas.targetId) ?? targetOptions[0];
  const targetLabelId = "concept-canvas-target-label";

  return (
    <div className="editor-page concept-canvas-page">
      <SectionHeading
        eyebrow="CC · Concept Canvas"
        title="Start with the creative seed."
        description="Capture loose intent, image fragments and constraints before turning them into structured prompts, screenplay text or canon."
        action={<button type="button" className="small-button" onClick={startExploration}>Start exploration</button>}
      />
      <div className="form-grid two-columns">
        <fieldset className="form-section signal-section">
          <legend className="subsection-title"><span>Attach the idea</span></legend>
          <div className="form-field">
            <span className="field-label" id={targetLabelId}>Story target</span>
            <span className="field-help" id={targetHelpId}>The canvas stays useful with AI disabled and can later seed exploration for this exact target.</span>
            <select
              aria-labelledby={targetLabelId}
              aria-describedby={targetHelpId}
              id="concept-canvas-target"
              value={`${selectedTarget.kind}:${selectedTarget.id}`}
              onChange={(event) => {
                const next = targetOptions.find((option) => `${option.kind}:${option.id}` === event.target.value) ?? targetOptions[0];
                updateTarget(next.kind, next.id, next.label);
              }}
            >
              {targetOptions.map((option) => <option key={`${option.kind}:${option.id}`} value={`${option.kind}:${option.id}`}>{option.label}</option>)}
            </select>
          </div>
          <p className="field-help">Provider, model, workflow and billing settings stay out of the canvas and remain in Settings.</p>
        </fieldset>

        <FormField label="Concept seed" value={canvas.conceptText} onChange={(value) => updateDevelopment("conceptCanvas", "conceptText", value)} help="A fragment, question, image, situation, contradiction, title, feeling or unfinished idea." />
        <FormField label="Emotional purpose" value={canvas.emotionalPurpose} onChange={(value) => updateDevelopment("conceptCanvas", "emotionalPurpose", value)} help="What should the audience feel, fear, hope, understand or carry away?" />
        <FormField label="Audience experience" value={canvas.audienceExperience} onChange={(value) => updateDevelopment("conceptCanvas", "audienceExperience", value)} help="Describe the ride: suspense, intimacy, wonder, dread, discovery, momentum or release." />
        <FormField label="Desired visual impact" value={canvas.desiredVisualImpact} onChange={(value) => updateDevelopment("conceptCanvas", "desiredVisualImpact", value)} help="Light, colour, texture, composition, motion, scale, point of view or recurring image." />
        <FormField label="Must-keep constraints" value={canvas.mustKeepConstraints} onChange={(value) => updateDevelopment("conceptCanvas", "mustKeepConstraints", value)} help="Facts, rights, tone, identity, continuity, production limits or story promises that must remain true." />
        <FormField label="Open exploration" value={canvas.openExploration} onChange={(value) => updateDevelopment("conceptCanvas", "openExploration", value)} help="What PlotPickle may vary later: mood, staging, palette, approach, structure, visual metaphor or story angle." />
      </div>
    </div>
  );
}

function VisualReferenceEditor({
  project,
  selectedId,
  select,
  add,
  update,
  updateTarget,
}: {
  project: PlotPickleProject;
  selectedId: string;
  select: (id: string) => void;
  add: () => void;
  update: (id: string, key: keyof VisualReference, value: string) => void;
  updateTarget: (id: string, kind: VisualReference["targetKind"], targetId: string, targetLabel: string) => void;
}) {
  const references = project.development.visualReferences;
  const selected = references.find((reference) => reference.id === selectedId) ?? references[0];
  const context = assembleVisualStoryContext(project, selected ? { kind: selected.targetKind, id: selected.targetId, label: selected.targetLabel } : undefined);
  const targetOptions = [
    { kind: "project" as const, id: "project", label: "Whole project" },
    ...project.characters.map((character) => ({ kind: "character" as const, id: character.id, label: `Character · ${character.name}` })),
    ...project.world.locations.map((location) => ({ kind: "location" as const, id: location.id, label: `Location · ${location.name}` })),
    ...project.blocks.map((block) => ({ kind: "block" as const, id: block.id, label: `Block ${block.number} · ${block.title}` })),
    ...project.blocks.flatMap((block) => block.visuals.map((frame) => ({
      kind: "mini-block" as const,
      id: `${block.id}:mini-${frame.miniBlockNumber}`,
      label: `Mini-block ${block.number}.${frame.miniBlockNumber} · ${block.title}`,
    }))),
    ...project.blocks.flatMap((block) => block.scenes.map((scene) => ({
      kind: "scene" as const,
      id: scene.id,
      label: `Scene · ${scene.heading || `Block ${block.number}`}`,
    }))),
  ];
  const selectedTarget = selected
    ? targetOptions.find((option) => option.kind === selected.targetKind && option.id === selected.targetId) ?? targetOptions[0]
    : targetOptions[0];

  return (
    <div className="editor-page visual-references-page">
      <SectionHeading
        eyebrow="VR · Visual References"
        title="Collect references with rights attached."
        description="Import or link images as inspiration, identity, continuity or composition guidance while keeping private paths and provider details out of project data."
        action={<button type="button" className="small-button" onClick={add}>Add reference</button>}
      />
      <div className="reference-workspace">
        <aside className="reference-roster" aria-label="Visual references">
          {references.length ? references.map((reference) => (
            <button type="button" aria-pressed={selected?.id === reference.id} className={selected?.id === reference.id ? "active" : ""} key={reference.id} onClick={() => select(reference.id)}>
              <strong>{reference.title || "Untitled reference"}</strong>
              <span>{reference.purpose} · {reference.rightsStatus}</span>
              <small>{reference.targetLabel}</small>
            </button>
          )) : <p>No visual references yet.</p>}
        </aside>
        {selected ? (
          <section className="reference-detail" aria-label="Selected visual reference">
            <div className="form-grid two-columns">
              <FormField label="Reference title" value={selected.title} onChange={(value) => update(selected.id, "title", value)} multiline={false} />
              <FormField label="Source URL" value={selected.sourceUrl} onChange={(value) => update(selected.id, "sourceUrl", value)} multiline={false} help="Use a shareable link, not a private local path or credential-bearing URL." />
              <FormField label="Imported filename" value={selected.importFileName} onChange={(value) => update(selected.id, "importFileName", value)} multiline={false} help="Store the filename only. PlotPickle never exports private local folders." />
              <div className="form-field">
                <label className="field-label" htmlFor="visual-reference-source-type">Source type</label>
                <select id="visual-reference-source-type" value={selected.sourceType} onChange={(event) => update(selected.id, "sourceType", event.target.value)}>
                  <option value="link">Linked reference</option>
                  <option value="manual-import">Manual import</option>
                  <option value="note">Reference note</option>
                </select>
              </div>
              <div className="form-field">
                <label className="field-label" htmlFor="visual-reference-purpose">Reference purpose</label>
                <select id="visual-reference-purpose" value={selected.purpose} onChange={(event) => update(selected.id, "purpose", event.target.value)}>
                  <option value="inspiration">Inspiration</option>
                  <option value="identity">Identity</option>
                  <option value="continuity">Continuity</option>
                  <option value="composition">Composition</option>
                </select>
              </div>
              <div className="form-field">
                <label className="field-label" htmlFor="visual-reference-rights">Rights status</label>
                <select id="visual-reference-rights" value={selected.rightsStatus} onChange={(event) => update(selected.id, "rightsStatus", event.target.value)}>
                  <option value="unknown">Unknown</option>
                  <option value="owned">Owned by project</option>
                  <option value="licensed">Licensed</option>
                  <option value="public-domain">Public domain</option>
                  <option value="permission-needed">Permission needed</option>
                </select>
              </div>
              <div className="form-field">
                <label className="field-label" htmlFor="visual-reference-target">Story target</label>
                <select
                  id="visual-reference-target"
                  value={`${selectedTarget.kind}:${selectedTarget.id}`}
                  onChange={(event) => {
                    const next = targetOptions.find((option) => `${option.kind}:${option.id}` === event.target.value) ?? targetOptions[0];
                    updateTarget(selected.id, next.kind, next.id, next.label);
                  }}
                >
                  {targetOptions.map((option) => <option key={`${option.kind}:${option.id}`} value={`${option.kind}:${option.id}`}>{option.label}</option>)}
                </select>
              </div>
              <FormField label="Permitted use" value={selected.permittedUse} onChange={(value) => update(selected.id, "permittedUse", value)} help="Example: inspiration only, internal continuity, licensed pitch use, or project-owned identity reference." />
              <FormField label="Attribution" value={selected.attribution} onChange={(value) => update(selected.id, "attribution", value)} help="Credit, creator, licence or permission reference that should travel with the PPF." />
              <FormField label="Ownership notes" value={selected.ownershipNotes} onChange={(value) => update(selected.id, "ownershipNotes", value)} />
              <FormField label="Reference notes" value={selected.notes} onChange={(value) => update(selected.id, "notes", value)} help="Describe what later visual work may inherit from this reference." />
            </div>
            <p className="field-help">References remain candidate guidance until a later human approval flow promotes them into visual canon.</p>
            <aside className="context-preview" aria-label="Automatic story context preview">
              <div>
                <span>Context package</span>
                <strong>{context.target.label}</strong>
              </div>
              <dl>
                <div><dt>Sources</dt><dd>{context.sources.length}</dd></div>
                <div><dt>References</dt><dd>{context.references.length}</dd></div>
                <div><dt>Characters</dt><dd>{context.characters.length}</dd></div>
                <div><dt>Locations</dt><dd>{context.locations.length}</dd></div>
              </dl>
              <p>Provider-neutral context includes story, world, target, references, continuity and source labels. Credentials, provider configuration and private local paths are excluded.</p>
            </aside>
          </section>
        ) : (
          <section className="empty-state"><p>Add a visual reference to record source, purpose, rights and story target.</p></section>
        )}
      </div>
    </div>
  );
}

function StorySetupEditor({ project, updateMetadata, updateDevelopment }: { project: PlotPickleProject; updateMetadata: (key: keyof PlotPickleProject["metadata"], value: string) => void; updateDevelopment: DevelopmentUpdater }) {
  const setup = project.development.storySetup;
  const titleFeedback = project.metadata.title ? "Title ready." : "Add a title before sharing or exporting.";
  return <div className="editor-page">
    <SectionHeading eyebrow="01 · Story Setup" title="Define the creative container." description="Set the practical and audience-facing decisions that every later column will inherit." />
    <div className="form-section"><h3>Project identity</h3><div className="form-grid three-columns">
      <FormField label="Title" value={project.metadata.title} onChange={(value) => updateMetadata("title", value)} multiline={false} feedback={titleFeedback} />
      <FormField label="Subtitle" value={project.metadata.subtitle} onChange={(value) => updateMetadata("subtitle", value)} multiline={false} />
      <FormField label="Status" value={project.metadata.status} onChange={(value) => updateMetadata("status", value)} multiline={false} />
      <FormField label="Format" value={project.metadata.format} onChange={(value) => updateMetadata("format", value)} multiline={false} />
      <FormField label="Target minutes" value={project.metadata.targetMinutes} onChange={(value) => updateMetadata("targetMinutes", value)} multiline={false} type="number" />
      <FormField label="Language" value={setup.language} onChange={(value) => updateDevelopment("storySetup", "language", value)} multiline={false} />
    </div></div>
    <div className="form-section"><h3>Audience & scope</h3><div className="form-grid two-columns">
      <FormField label="Primary audience" value={setup.audience} onChange={(value) => updateDevelopment("storySetup", "audience", value)} />
      <FormField label="Content rating & boundaries" value={setup.contentRating} onChange={(value) => updateDevelopment("storySetup", "contentRating", value)} />
      <FormField label="Story scope" value={setup.scope} onChange={(value) => updateDevelopment("storySetup", "scope", value)} help="Production scale, geography, timeline, and any formal constraints." />
      <FormField label="Collaborators & ownership" value={setup.collaborators} onChange={(value) => updateDevelopment("storySetup", "collaborators", value)} />
    </div></div>
  </div>;
}

function PitchVisionEditor({ project, updateMetadata, updateStory, updateDevelopment }: { project: PlotPickleProject; updateMetadata: (key: keyof PlotPickleProject["metadata"], value: string) => void; updateStory: (key: keyof PlotPickleProject["story"], value: string) => void; updateDevelopment: DevelopmentUpdater }) {
  const pitch = project.development.pitch;
  return <div className="editor-page">
    <SectionHeading eyebrow="PV · Pitch & Vision" title="Make the story promise immediate." description="Combine a concise verbal pitch with the emotional and visual experience you intend to deliver." />
    <div className="form-section signal-section"><div className="form-grid two-columns">
      <FormField label="One-sentence pitch" value={pitch.oneSentence} onChange={(value) => updateDevelopment("pitch", "oneSentence", value)} />
      <FormField label="Logline" value={project.story.logline} onChange={(value) => updateStory("logline", value)} help="Protagonist + goal + opposition + stakes." />
      <FormField label="Short pitch" value={pitch.shortPitch} onChange={(value) => updateDevelopment("pitch", "shortPitch", value)} />
      <FormField label="Premise" value={project.story.premise} onChange={(value) => updateStory("premise", value)} />
    </div></div>
    <div className="form-section"><h3>Audience promise</h3><div className="form-grid two-columns">
      <FormField label="Genre" value={project.metadata.genre} onChange={(value) => updateMetadata("genre", value)} multiline={false} />
      <FormField label="Tone" value={project.metadata.tone} onChange={(value) => updateMetadata("tone", value)} multiline={false} />
      <FormField label="Audience promise" value={pitch.audiencePromise} onChange={(value) => updateDevelopment("pitch", "audiencePromise", value)} />
      <FormField label="Emotional experience" value={pitch.emotionalExperience} onChange={(value) => updateDevelopment("pitch", "emotionalExperience", value)} />
      <FormField label="Comparable titles" value={pitch.comparableTitles} onChange={(value) => updateDevelopment("pitch", "comparableTitles", value)} />
      <FormField label="Visual vision" value={pitch.visualVision} onChange={(value) => updateDevelopment("pitch", "visualVision", value)} />
    </div></div>
    <div className="form-section"><div className="form-grid two-columns">
      <FormField label="Opening hook" value={project.story.hook} onChange={(value) => updateStory("hook", value)} />
      <FormField label="Theme" value={project.story.theme} onChange={(value) => updateStory("theme", value)} />
    </div></div>
  </div>;
}

function GhostEditor({ project, selected, select, updateCharacter, updateDevelopment }: { project: PlotPickleProject; selected?: Character; select: (id: string) => void; updateCharacter: (id: string, key: keyof Character, value: string) => void; updateDevelopment: DevelopmentUpdater }) {
  const ghost = project.development.ghost;
  return <div className="editor-page">
    <SectionHeading eyebrow="GH · Ghost" title="Trace the wound into present behaviour." description="Separate what happened, the lie it created, the strategy it triggers, and the truth the story will prove." />
    <div className="form-section signal-section"><div className="form-grid two-columns">
      <FormField label="Central wound" value={ghost.centralWound} onChange={(value) => updateDevelopment("ghost", "centralWound", value)} />
      <FormField label="Origin event" value={ghost.origin} onChange={(value) => updateDevelopment("ghost", "origin", value)} />
      <FormField label="Protective lie" value={ghost.lie} onChange={(value) => updateDevelopment("ghost", "lie", value)} />
      <FormField label="Story trigger" value={ghost.trigger} onChange={(value) => updateDevelopment("ghost", "trigger", value)} />
      <FormField label="Present pattern" value={ghost.presentPattern} onChange={(value) => updateDevelopment("ghost", "presentPattern", value)} />
      <FormField label="Truth required" value={ghost.truth} onChange={(value) => updateDevelopment("ghost", "truth", value)} />
    </div></div>
    {selected ? <div className="form-section"><div className="subsection-title"><div><h3>Character ghost pass</h3><p>Connect the project-level wound to each individual character.</p></div><select value={selected.id} onChange={(event) => select(event.target.value)}>{project.characters.map((character) => <option value={character.id} key={character.id}>{character.name}</option>)}</select></div><div className="form-grid three-columns">
      <FormField label={`${selected.name} · Ghost`} value={selected.ghost} onChange={(value) => updateCharacter(selected.id, "ghost", value)} />
      <FormField label={`${selected.name} · Need`} value={selected.need} onChange={(value) => updateCharacter(selected.id, "need", value)} />
      <FormField label={`${selected.name} · Fatal flaw`} value={selected.fatalFlaw} onChange={(value) => updateCharacter(selected.id, "fatalFlaw", value)} />
    </div></div> : null}
  </div>;
}

function CatalystEditor({ project, updateStory, updateDevelopment }: { project: PlotPickleProject; updateStory: (key: keyof PlotPickleProject["story"], value: string) => void; updateDevelopment: DevelopmentUpdater }) {
  const catalyst = project.development.catalyst;
  return <div className="editor-page">
    <SectionHeading eyebrow="CA · Catalyst" title="Make normal life impossible to continue." description="Design the event and the chain of impact, resistance, choice, and commitment it creates." />
    <div className="form-section signal-section"><FormField label="Canonical catalyst" value={project.story.catalyst} onChange={(value) => updateStory("catalyst", value)} help="The concise version used throughout the project." /></div>
    <div className="form-section"><div className="form-grid two-columns">
      <FormField label="Event in visible action" value={catalyst.event} onChange={(value) => updateDevelopment("catalyst", "event", value)} />
      <FormField label="Why now / timing" value={catalyst.timing} onChange={(value) => updateDevelopment("catalyst", "timing", value)} />
      <FormField label="Immediate impact" value={catalyst.immediateImpact} onChange={(value) => updateDevelopment("catalyst", "immediateImpact", value)} />
      <FormField label="Choice forced" value={catalyst.choiceForced} onChange={(value) => updateDevelopment("catalyst", "choiceForced", value)} />
      <FormField label="Resistance" value={catalyst.resistance} onChange={(value) => updateDevelopment("catalyst", "resistance", value)} />
      <FormField label="Doorway to the new world" value={catalyst.doorway} onChange={(value) => updateDevelopment("catalyst", "doorway", value)} />
    </div></div>
  </div>;
}

function FoundationsEditor({ project, updateStory, updateDevelopment }: { project: PlotPickleProject; updateStory: (key: keyof PlotPickleProject["story"], value: string) => void; updateDevelopment: DevelopmentUpdater }) {
  const foundation = project.development.foundations;
  return <div className="editor-page">
    <SectionHeading eyebrow="FN · Foundations" title="Lock the engine beneath all 24 blocks." description="Use these fields as a diagnostic: every major movement should pressure the objective, belief, and transformation." />
    <div className="form-section"><h3>Story argument</h3><div className="form-grid two-columns">
      <FormField label="Theme" value={project.story.theme} onChange={(value) => updateStory("theme", value)} />
      <FormField label="Anti-theme" value={project.story.antiTheme} onChange={(value) => updateStory("antiTheme", value)} />
      <FormField label="Dramatic question" value={project.story.dramaticQuestion} onChange={(value) => updateStory("dramaticQuestion", value)} />
      <FormField label="Stakes" value={project.story.stakes} onChange={(value) => updateStory("stakes", value)} />
    </div></div>
    <div className="form-section signal-section"><h3>Story engine</h3><div className="form-grid two-columns">
      <FormField label="Protagonist" value={foundation.protagonist} onChange={(value) => updateDevelopment("foundations", "protagonist", value)} />
      <FormField label="Objective" value={foundation.objective} onChange={(value) => updateDevelopment("foundations", "objective", value)} />
      <FormField label="Opposition" value={foundation.opposition} onChange={(value) => updateDevelopment("foundations", "opposition", value)} />
      <FormField label="Urgency" value={foundation.urgency} onChange={(value) => updateDevelopment("foundations", "urgency", value)} />
      <FormField label="Repeatable story engine" value={foundation.storyEngine} onChange={(value) => updateDevelopment("foundations", "storyEngine", value)} />
      <FormField label="Transformation" value={foundation.transformation} onChange={(value) => updateDevelopment("foundations", "transformation", value)} />
      <FormField label="Ending proof" value={foundation.endingProof} onChange={(value) => updateDevelopment("foundations", "endingProof", value)} />
      <FormField label="Ending & closing image" value={project.story.ending} onChange={(value) => updateStory("ending", value)} />
    </div></div>
  </div>;
}

function PickleEditor({ project, updateDevelopment }: { project: PlotPickleProject; updateDevelopment: DevelopmentUpdater }) {
  const pickle = project.development.pickle;
  return <div className="editor-page">
    <SectionHeading eyebrow="PK · The Pickle" title="Shape what the audience keeps trying to solve." description="Define the pattern viewers understand, the uncertainty that keeps it alive, and the signature way this story changes their expectations." />
    <div className="form-section"><h3>Audience contract</h3><div className="form-grid two-columns">
      <FormField label="Central tension" value={pickle.centralTension} onChange={(value) => updateDevelopment("pickle", "centralTension", value)} help="The unstable situation that can sustain the whole story." />
      <FormField label="Audience question" value={pickle.audienceQuestion} onChange={(value) => updateDevelopment("pickle", "audienceQuestion", value)} help="What viewers actively test, predict, hope, or fear." />
      <FormField label="Story promise" value={pickle.storyPromise} onChange={(value) => updateDevelopment("pickle", "storyPromise", value)} help="The repeatable pattern or rule the audience learns to recognize." />
    </div></div>
    <div className="form-section signal-section"><h3>Expectation gap</h3><div className="form-grid two-columns">
      <FormField label="Expected destination" value={pickle.expectedDestination} onChange={(value) => updateDevelopment("pickle", "expectedDestination", value)} help="The broad result viewers may reasonably anticipate." />
      <FormField label="Unpredictable route" value={pickle.unpredictableRoute} onChange={(value) => updateDevelopment("pickle", "unpredictableRoute", value)} help="What must remain difficult to predict even when the destination feels likely." />
      <FormField label="Live answer A" value={pickle.liveAnswerA} onChange={(value) => updateDevelopment("pickle", "liveAnswerA", value)} help="One plausible explanation, outcome, hope, or fear." />
      <FormField label="Live answer B" value={pickle.liveAnswerB} onChange={(value) => updateDevelopment("pickle", "liveAnswerB", value)} help="A competing answer the story can also support." />
    </div></div>
    <div className="form-section"><h3>Escalation & payoff</h3><div className="form-grid two-columns">
      <FormField label="Escalation pattern" value={pickle.escalationPattern} onChange={(value) => updateDevelopment("pickle", "escalationPattern", value)} help="How clues, reversals, complications, and near-answers refresh the tension." />
      <FormField label="Final answer" value={pickle.finalAnswer} onChange={(value) => updateDevelopment("pickle", "finalAnswer", value)} help="How the ending answers or deliberately reframes the audience question." />
      <FormField label="Signature move" value={pickle.signatureMove} onChange={(value) => updateDevelopment("pickle", "signatureMove", value)} help="The execution choice that makes this familiar pattern belong only to this story." />
    </div></div>
  </div>;
}

function DialogueEditor({ project, selected, select, updateCharacter, updateDevelopment }: { project: PlotPickleProject; selected?: Character; select: (id: string) => void; updateCharacter: (id: string, key: keyof Character, value: string) => void; updateDevelopment: DevelopmentUpdater }) {
  const dialogue = project.development.dialogue;
  return <div className="editor-page">
    <SectionHeading eyebrow="DL · Dialogue" title="Build a system of distinct voices and useful subtext." description="Set project-wide dialogue rules, then tune each character's vocabulary, rhythm, avoidance, and emotional access." />
    <div className="form-section"><div className="form-grid two-columns">
      <FormField label="Dialogue principles" value={dialogue.principles} onChange={(value) => updateDevelopment("dialogue", "principles", value)} />
      <FormField label="Voice contrast" value={dialogue.voiceContrast} onChange={(value) => updateDevelopment("dialogue", "voiceContrast", value)} />
      <FormField label="Subtext strategy" value={dialogue.subtext} onChange={(value) => updateDevelopment("dialogue", "subtext", value)} />
      <FormField label="Exposition rules" value={dialogue.expositionRules} onChange={(value) => updateDevelopment("dialogue", "expositionRules", value)} />
      <FormField label="Recurring language & motifs" value={dialogue.recurringLanguage} onChange={(value) => updateDevelopment("dialogue", "recurringLanguage", value)} />
      <FormField label="Dialogue notes" value={dialogue.notes} onChange={(value) => updateDevelopment("dialogue", "notes", value)} />
    </div></div>
    {selected ? <div className="form-section signal-section"><div className="subsection-title"><div><h3>Character voice pass</h3><p>Write one compact voice rule you can apply scene by scene.</p></div><select value={selected.id} onChange={(event) => select(event.target.value)}>{project.characters.map((character) => <option value={character.id} key={character.id}>{character.name}</option>)}</select></div><FormField label={`${selected.name} · Voice`} value={selected.voice} onChange={(value) => updateCharacter(selected.id, "voice", value)} /></div> : null}
  </div>;
}

function NotesEditor({ project, updateStory, updateDevelopment }: { project: PlotPickleProject; updateStory: (key: keyof PlotPickleProject["story"], value: string) => void; updateDevelopment: DevelopmentUpdater }) {
  const notes = project.development.notes;
  return <div className="editor-page">
    <SectionHeading eyebrow="NT · Notes" title="Keep the unfinished work organized." description="Separate decisions, research, continuity, revisions, and sources so the current story state stays trustworthy." />
    <div className="form-section signal-section"><FormField label="Current story notes" value={project.story.notes} onChange={(value) => updateStory("notes", value)} /></div>
    <div className="form-section"><div className="form-grid two-columns">
      <FormField label="General notes" value={notes.general} onChange={(value) => updateDevelopment("notes", "general", value)} />
      <FormField label="Research" value={notes.research} onChange={(value) => updateDevelopment("notes", "research", value)} />
      <FormField label="Open questions" value={notes.openQuestions} onChange={(value) => updateDevelopment("notes", "openQuestions", value)} />
      <FormField label="Continuity ledger" value={notes.continuity} onChange={(value) => updateDevelopment("notes", "continuity", value)} />
      <FormField label="Revision plan" value={notes.revisions} onChange={(value) => updateDevelopment("notes", "revisions", value)} />
      <FormField label="Sources & versions" value={notes.sources} onChange={(value) => updateDevelopment("notes", "sources", value)} />
    </div></div>
  </div>;
}

function WorldEditor({
  project,
  updateWorld,
  updateLocation,
  addLocation,
}: {
  project: PlotPickleProject;
  updateWorld: (key: Exclude<keyof PlotPickleProject["world"], "locations">, value: string) => void;
  updateLocation: (id: string, key: keyof Location, value: string) => void;
  addLocation: () => void;
}) {
  return (
    <div className="editor-page">
      <SectionHeading eyebrow="02 · World" title="Build the pressure around the characters." description="The world is not wallpaper. Its rules create choices, limits, and consequences." />
      <div className="form-section">
        <div className="form-grid two-columns">
          <FormField label="Ordinary world" value={project.world.ordinaryWorld} onChange={(value) => updateWorld("ordinaryWorld", value)} help="Life before the catalyst—and why it cannot last." />
          <FormField label="New world" value={project.world.newWorld} onChange={(value) => updateWorld("newWorld", value)} help="The unfamiliar situation entered after commitment." />
          <FormField label="Period" value={project.world.period} onChange={(value) => updateWorld("period", value)} multiline={false} />
          <FormField label="History" value={project.world.history} onChange={(value) => updateWorld("history", value)} />
          <FormField label="Cultures & societies" value={project.world.cultures} onChange={(value) => updateWorld("cultures", value)} />
          <FormField label="Rules & limitations" value={project.world.rules} onChange={(value) => updateWorld("rules", value)} help="Once established, these rules must remain consistent." />
          <FormField label="Technology or magic" value={project.world.technology} onChange={(value) => updateWorld("technology", value)} />
          <FormField label="Visual language" value={project.world.visualLanguage} onChange={(value) => updateWorld("visualLanguage", value)} help="Palette, texture, light, weather, lenses, and recurring motifs." />
        </div>
      </div>
      <div className="form-section">
        <div className="subsection-title"><div><h3>Locations</h3><p>Reusable locations can be attached to any story block.</p></div><button type="button" className="secondary-button compact" onClick={addLocation}>Add location</button></div>
        {project.world.locations.length ? (
          <div className="location-grid">
            {project.world.locations.map((location) => (
              <article className="location-card" key={location.id}>
                <div className="location-image">
                  {location.image ? <img src={location.image} alt={`${location.name} reference`} /> : <span>Image reference</span>}
                </div>
                <FormField label="Location name" value={location.name} onChange={(value) => updateLocation(location.id, "name", value)} multiline={false} />
                <FormField label="Description" value={location.description} onChange={(value) => updateLocation(location.id, "description", value)} />
                <FormField label="Image URL" value={location.image} onChange={(value) => updateLocation(location.id, "image", value)} multiline={false} placeholder="https://…" />
              </article>
            ))}
          </div>
        ) : <div className="empty-state"><p>No locations yet.</p><button type="button" className="primary-button" onClick={addLocation}>Create the first location</button></div>}
      </div>
    </div>
  );
}

function CharacterEditor({
  project,
  selected,
  select,
  update,
  add,
}: {
  project: PlotPickleProject;
  selected?: Character;
  select: (id: string) => void;
  update: (id: string, key: keyof Character, value: string) => void;
  add: () => void;
}) {
  return (
    <div className="editor-page">
      <SectionHeading eyebrow="03 · Characters" title="Every character brings a past into the room." description="Track the want they pursue, the need they resist, and the ghost that keeps choosing for them." action={<button type="button" className="primary-button compact" onClick={add}>Add character</button>} />
      {project.characters.length && selected ? (
        <div className="character-workspace">
          <div className="character-roster" aria-label="Character roster">
            {project.characters.map((character) => (
              <button type="button" aria-pressed={selected.id === character.id} className={selected.id === character.id ? "active" : ""} key={character.id} onClick={() => select(character.id)} onKeyDown={(event) => handleButtonKeyboard(event, () => select(character.id))}>
                <Portrait character={character} size="small" />
                <span><strong>{character.name}</strong><small>{character.role}</small></span>
              </button>
            ))}
          </div>
          <div className="character-detail">
            <div className="character-profile-head">
              <Portrait character={selected} size="large" />
              <div className="form-grid two-columns compact-grid">
                <FormField label="Name" value={selected.name} onChange={(value) => update(selected.id, "name", value)} multiline={false} />
                <FormField label="Story role" value={selected.role} onChange={(value) => update(selected.id, "role", value)} multiline={false} />
                <FormField label="Pronouns" value={selected.pronouns} onChange={(value) => update(selected.id, "pronouns", value)} multiline={false} />
                <FormField label="Thumbnail URL" value={selected.image} onChange={(value) => update(selected.id, "image", value)} multiline={false} placeholder="Future character image URL" />
              </div>
            </div>
            <FormField label="Character description" value={selected.description} onChange={(value) => update(selected.id, "description", value)} />
            <CharacterImageGenerator key={selected.id} project={project} character={selected} onImage={(value) => update(selected.id, "image", value)} />
            <div className="character-core-grid">
              <FormField label="Conscious want" value={selected.want} onChange={(value) => update(selected.id, "want", value)} help="What they believe will solve the problem." />
              <FormField label="Unconscious need" value={selected.need} onChange={(value) => update(selected.id, "need", value)} help="The internal truth they resist." />
              <FormField label="Ghost" value={selected.ghost} onChange={(value) => update(selected.id, "ghost", value)} help="The past wound, loss, trauma, or belief still directing present choices." />
            </div>
            <div className="form-grid two-columns">
              <FormField label="Fatal flaw" value={selected.fatalFlaw} onChange={(value) => update(selected.id, "fatalFlaw", value)} />
              <FormField label="Strengths" value={selected.strengths} onChange={(value) => update(selected.id, "strengths", value)} />
              <FormField label="Character arc" value={selected.arc} onChange={(value) => update(selected.id, "arc", value)} />
              <FormField label="Voice" value={selected.voice} onChange={(value) => update(selected.id, "voice", value)} />
            </div>
            {selected.relationships.length ? (
              <div className="relationship-list"><h3>Relationships</h3>{selected.relationships.map((relationship, index) => {
                const related = project.characters.find((character) => character.id === relationship.characterId);
                return <article key={`${relationship.characterId}-${index}`}><strong>{related?.name ?? relationship.characterId}</strong><span>{relationship.label}</span><p>{relationship.description}</p></article>;
              })}</div>
            ) : null}
          </div>
        </div>
      ) : <div className="empty-state"><p>Your cast is empty.</p><button type="button" className="primary-button" onClick={add}>Create the protagonist</button></div>}
    </div>
  );
}

function BlocksEditor({
  project,
  selectedBlock,
  openBlock,
  updateBlock,
  toggleReference,
  openVisual,
}: {
  project: PlotPickleProject;
  selectedBlock: StoryBlock;
  openBlock: (number: number) => void;
  updateBlock: (number: number, key: keyof StoryBlock, value: string | string[]) => void;
  toggleReference: (kind: "characterIds" | "locationIds", id: string) => void;
  openVisual: (number: number) => void;
}) {
  return (
    <div className="editor-page blocks-page">
      <SectionHeading eyebrow="04 · 24 Blocks" title="Make every block cause the next one." description="Each block is a five-minute mini-story: goal, conflict, choice, action, and consequence." />
      <div className="blocks-workspace">
        <div className="blocks-map">
        {[1, 2, 3, 4].map((act) => (
          <section className={`act-row act-${act}`} key={act}>
            <header><span>Act {act}</span><strong>{actNames[act - 1]}</strong><small>Blocks {(act - 1) * 6 + 1}–{act * 6}</small></header>
            <div>
              {project.blocks.filter((block) => block.act === act).map((block) => (
                <button type="button" aria-pressed={selectedBlock.number === block.number} className={selectedBlock.number === block.number ? "block-card active" : "block-card"} key={block.id} onClick={() => openBlock(block.number)}>
                  <span className="block-number">{String(block.number).padStart(2, "0")}</span>
                  <strong>{block.title}</strong>
                  <p>{block.summary || block.purpose}</p>
                  <i><b style={{ width: `${fieldCompletion(block)}%` }} /></i>
                  <small>{fieldCompletion(block)}% developed</small>
                </button>
              ))}
            </div>
          </section>
        ))}
        </div>

        <div className="block-inspector">
        <div className="inspector-head">
          <div className={`block-index act-${selectedBlock.act}`}>{String(selectedBlock.number).padStart(2, "0")}</div>
          <div><p className="eyebrow">Act {selectedBlock.act} · {actNames[selectedBlock.act - 1]}</p><h2>{selectedBlock.title}</h2><p>{selectedBlock.purpose}</p></div>
          <button type="button" className="secondary-button compact" onClick={() => openVisual(selectedBlock.number)}>Open visual board</button>
        </div>
        <div className="form-grid two-columns">
          <FormField label="Block title" value={selectedBlock.title} onChange={(value) => updateBlock(selectedBlock.number, "title", value)} multiline={false} />
          <FormField label="Purpose" value={selectedBlock.purpose} onChange={(value) => updateBlock(selectedBlock.number, "purpose", value)} />
        </div>
        <FormField label="Story section" value={selectedBlock.summary} onChange={(value) => updateBlock(selectedBlock.number, "summary", value)} help="Name the visible movement or sequence carried by this block." />
        <div className="story-motion-grid">
          <FormField label="Goal" value={selectedBlock.goal} onChange={(value) => updateBlock(selectedBlock.number, "goal", value)} />
          <FormField label="Conflict" value={selectedBlock.conflict} onChange={(value) => updateBlock(selectedBlock.number, "conflict", value)} />
          <FormField label="Choice" value={selectedBlock.choice} onChange={(value) => updateBlock(selectedBlock.number, "choice", value)} />
          <FormField label="Action" value={selectedBlock.action} onChange={(value) => updateBlock(selectedBlock.number, "action", value)} />
          <FormField label="Consequence" value={selectedBlock.consequence} onChange={(value) => updateBlock(selectedBlock.number, "consequence", value)} help="This should create pressure for the following block." />
          <FormField label="Emotional turn" value={selectedBlock.emotionalTurn} onChange={(value) => updateBlock(selectedBlock.number, "emotionalTurn", value)} />
          <FormField label="Audience expectation" value={selectedBlock.audienceExpectation} onChange={(value) => updateBlock(selectedBlock.number, "audienceExpectation", value)} help="What viewers are likely to believe, expect, hope, or fear after this block." />
          <FormField label="The Pickle turn" value={selectedBlock.pickleTurn} onChange={(value) => updateBlock(selectedBlock.number, "pickleTurn", value)} help="The clue, reversal, complication, near-answer, or reframe that refreshes the central tension." />
        </div>
        <div className="reference-grid">
          <div><span className="field-label">Characters in this block</span><div className="chip-list">{project.characters.map((character) => <button type="button" aria-pressed={selectedBlock.characterIds.includes(character.id)} className={selectedBlock.characterIds.includes(character.id) ? "active" : ""} key={character.id} onClick={() => toggleReference("characterIds", character.id)}>{character.name}</button>)}</div></div>
          <div><span className="field-label">Locations in this block</span><div className="chip-list">{project.world.locations.map((location) => <button type="button" aria-pressed={selectedBlock.locationIds.includes(location.id)} className={selectedBlock.locationIds.includes(location.id) ? "active" : ""} key={location.id} onClick={() => toggleReference("locationIds", location.id)}>{location.name}</button>)}</div></div>
        </div>
        <div className="form-grid two-columns block-writing-grid">
          <FormField label="Setup" value={selectedBlock.setup} onChange={(value) => updateBlock(selectedBlock.number, "setup", value)} />
          <FormField label="Payoff" value={selectedBlock.payoff} onChange={(value) => updateBlock(selectedBlock.number, "payoff", value)} />
          <FormField label="Story text" value={selectedBlock.scriptExcerpt} onChange={(value) => updateBlock(selectedBlock.number, "scriptExcerpt", value)} help="Outline, scene text, or screenplay excerpt for this block." />
          <FormField label="Story notes" value={selectedBlock.notes} onChange={(value) => updateBlock(selectedBlock.number, "notes", value)} />
          <FormField label="Storyboard direction" value={selectedBlock.storyboardDirection} onChange={(value) => updateBlock(selectedBlock.number, "storyboardDirection", value)} help="The visible action, image progression, and key continuity needed by Visual Board." />
        </div>
        </div>
      </div>
    </div>
  );
}

function StoryboardPlanner({ project, selectedBlock, openBlock, updateBlock, openVisual }: { project: PlotPickleProject; selectedBlock: StoryBlock; openBlock: (number: number) => void; updateBlock: (number: number, key: keyof StoryBlock, value: string | string[]) => void; openVisual: (number: number) => void }) {
  return (
    <div className="editor-page storyboard-planner-page">
      <SectionHeading eyebrow="SB · Storyboard" title="Plan the visual turn before making frames." description="Give every block a clear visual direction, story text, notes, and up to four key frames that stay synchronized with Visual Board." action={<button type="button" className="primary-button compact" onClick={() => openVisual(selectedBlock.number)}>Open Block {selectedBlock.number} in Visual Board</button>} />
      <div className="storyboard-planner-workspace">
        <div className="storyboard-block-list">
          {project.blocks.map((block) => (
            <button type="button" aria-pressed={selectedBlock.number === block.number} className={selectedBlock.number === block.number ? `active act-${block.act}` : `act-${block.act}`} key={block.id} onClick={() => openBlock(block.number)}>
              <span>{String(block.number).padStart(2, "0")}</span>
              <strong>{block.title}</strong>
              <small>{block.visuals.length}/4 visuals</small>
            </button>
          ))}
        </div>
        <div className="storyboard-direction-panel">
          <div className="visual-inspector-head"><div className={`block-index act-${selectedBlock.act}`}>{String(selectedBlock.number).padStart(2, "0")}</div><div><span>Selected block</span><h2>{selectedBlock.title}</h2></div></div>
          <p className="block-purpose-copy">{selectedBlock.purpose}</p>
          <FormField label="Story section" value={selectedBlock.summary} onChange={(value) => updateBlock(selectedBlock.number, "summary", value)} />
          <FormField label="Story text" value={selectedBlock.scriptExcerpt} onChange={(value) => updateBlock(selectedBlock.number, "scriptExcerpt", value)} />
          <FormField label="Story notes" value={selectedBlock.notes} onChange={(value) => updateBlock(selectedBlock.number, "notes", value)} />
          <FormField label="Storyboard direction" value={selectedBlock.storyboardDirection} onChange={(value) => updateBlock(selectedBlock.number, "storyboardDirection", value)} help="Describe the four visible turns: setup, pressure, choice, and consequence." />
          <button type="button" className="secondary-button full-width" onClick={() => openVisual(selectedBlock.number)}>Open this block in Visual Board <span>{selectedBlock.visuals.length}/4 visuals</span></button>
        </div>
      </div>
    </div>
  );
}
