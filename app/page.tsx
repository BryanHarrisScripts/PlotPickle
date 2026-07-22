"use client";

/* eslint-disable @next/next/no-img-element -- Project JSON accepts arbitrary user-supplied reference URLs. */

import Link from "next/link";
import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createAfterglowProject } from "@/data/afterglow";
import EngineHub from "./engine-hub";
import ProjectOverview from "./project-overview";
import StructureMapSummary from "./structure-map-summary";
import SettingsPanel from "./settings-panel";
import ScriptWorkspace, { type WriterViewMode } from "./script-workspace";
import LearningStudio from "./learning-studio";
import CharacterImageGenerator from "./character-image-generator";
import VisualStoryboard from "./visual-storyboard";
import { projectSectionProgress, sectionHasAlert } from "@/lib/project-progress";
import { createProjectFromScreenplay, markScreenplayAnalysisReviewed } from "@/lib/screenplay-import";
import { screenplayFormatForFile } from "@/lib/screenplay";
import {
  addBlankCharacter,
  addBlankLocation,
  cloneProject,
  completionFor,
  createBlankProject,
  normalizePlotPickleProject,
  type Character,
  type Location,
  type PlotPickleProject,
  type ScreenplayDocument,
  type StoryBlock,
} from "@/lib/project";

const STORAGE_KEY = "plotpickle.project.v1";
const WINDOWS_DOWNLOAD_URL = "https://github.com/BryanHarrisScripts/PlotPickle/releases/latest";

type MainTab = "instructions" | "learn" | "planner" | "script" | "visuals" | "engines" | "settings";
type StorySection = "overview" | "storySetup" | "pitch" | "world" | "characters" | "ghost" | "catalyst" | "foundations" | "pickle" | "dialogue" | "structureMap" | "blocks" | "storyboard" | "notes";
type StorySectionGroup = "Project" | "Foundation" | "Structure" | "Production";

const mainTabs: { id: MainTab; label: string; description: string }[] = [
  { id: "instructions", label: "Instructions", description: "Learn the method" },
  { id: "learn", label: "Read & Learn", description: "Study the craft" },
  { id: "planner", label: "Story Planner", description: "Build the story" },
  { id: "script", label: "Screenplay", description: "Outline & write" },
  { id: "visuals", label: "Visual Board", description: "See the film" },
  { id: "engines", label: "Engines", description: "Refine the story" },
  { id: "settings", label: "Settings", description: "Connect services" },
];

const storySections: { id: StorySection; code: string; label: string; group: StorySectionGroup }[] = [
  { id: "overview", code: "OV", label: "Project Overview", group: "Project" },
  { id: "storySetup", code: "01", label: "Story Setup", group: "Foundation" },
  { id: "pitch", code: "PV", label: "Pitch & Vision", group: "Foundation" },
  { id: "world", code: "WD", label: "World", group: "Foundation" },
  { id: "characters", code: "CH", label: "Characters", group: "Foundation" },
  { id: "ghost", code: "GH", label: "Ghost", group: "Foundation" },
  { id: "catalyst", code: "CA", label: "Catalyst", group: "Foundation" },
  { id: "foundations", code: "FN", label: "Foundations", group: "Foundation" },
  { id: "pickle", code: "PK", label: "The Pickle", group: "Foundation" },
  { id: "dialogue", code: "DL", label: "Dialogue", group: "Foundation" },
  { id: "structureMap", code: "ST", label: "Structure Map", group: "Structure" },
  { id: "blocks", code: "24", label: "24 Blocks", group: "Structure" },
  { id: "storyboard", code: "SB", label: "Storyboard", group: "Production" },
  { id: "notes", code: "NT", label: "Notes", group: "Production" },
];

const sectionGuides: Record<StorySection, { title: string; description: string; questions: string[]; deliverable: string; connection: string }> = {
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
  structureMap: {
    title: "See the complete hierarchy without leaving the story columns.",
    description: "Review the four acts, twelve sequences, twenty-four blocks, forty-eight scenes, ninety-six mini-blocks, and Story Clock before entering the full Structure Engine.",
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

function FormField({
  label,
  value,
  onChange,
  placeholder,
  help,
  multiline = true,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: string;
  multiline?: boolean;
  type?: string;
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label className="form-field" htmlFor={id}>
      <span className="field-label">{label}</span>
      {help ? <span className="field-help">{help}</span> : null}
      {multiline ? (
        <textarea
          id={id}
          value={value}
          placeholder={placeholder}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action ? <div className="section-action">{action}</div> : null}
    </div>
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
  return (
    <div className="marketing-page">
      <header className="marketing-header">
        <a className="marketing-brand" href="#top" aria-label="PlotPickle Playhouse home">
          <img className="marketing-brand-logo" src="/brand/plotpickle-header-horizontal-600.png" alt="PlotPickle Playhouse" />
        </a>
        <nav aria-label="Product navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#download">Download</a>
        </nav>
        <button type="button" className="secondary-button marketing-online-button" onClick={onEnter}>
          Open local workspace
        </button>
      </header>

      <main id="top">
        <section className="marketing-hero">
          <div className="marketing-hero-copy">
            <p className="marketing-kicker">The 24 Blocks story development system</p>
            <h1>Build the story.<br />See the whole film.</h1>
            <p className="marketing-lede">
              PlotPickle Playhouse brings the method, the writing plan, and the visual board into one connected workspace—ready to run on your Windows computer.
            </p>
            <div className="marketing-hero-actions">
              <a className="download-button" href={WINDOWS_DOWNLOAD_URL} target="_blank" rel="noreferrer">
                <span className="download-icon" aria-hidden="true">↓</span>
                <span><strong>Download for Windows</strong><small>Get the latest PlotPickle package</small></span>
              </a>
              <button type="button" className="marketing-text-link" onClick={onEnter}>
                Open local workspace <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="marketing-trust-row" aria-label="Product highlights">
              <span>Local-first</span>
              <span>One story file</span>
              <span>No ChatGPT account required</span>
            </div>
          </div>

          <div className="product-window" aria-label="PlotPickle Playhouse interface preview">
            <div className="product-window-bar">
              <span className="product-window-brand"><i><img src="/brand/favicon/plotpickle-icon-32.png" alt="" /></i> PlotPickle Playhouse</span>
              <span>Saved on this device</span>
            </div>
            <div className="product-window-body">
              <aside>
                {storySections.map((section, index) => (
                  <div className={section.id === "blocks" ? "active" : ""} key={section.id}>
                    <span>{section.code}</span>
                    <strong>{section.label}</strong>
                    {index < 8 ? <i aria-hidden="true">✓</i> : null}
                  </div>
                ))}
              </aside>
              <div className="product-workspace">
                <div className="product-tabs"><span>Instructions</span><span className="active">Story Planner</span><span>Screenplay</span><span>Visual Board</span><span>Engines</span></div>
                <div className="product-workspace-heading">
                  <div><small>ACT II · CONFRONTATION</small><strong>Your complete story at a glance</strong></div>
                  <span>18% complete</span>
                </div>
                <div className="block-preview-grid">
                  {[7, 8, 9, 10, 11, 12].map((number) => (
                    <div className={number === 9 ? "active" : ""} key={number}>
                      <span>{number}</span>
                      <strong>{number === 9 ? "Choices & Adjusted Plan" : number === 12 ? "Plan, Stakes & Action" : "Story movement"}</strong>
                      <small>{number === 9 ? "Developing" : "Ready"}</small>
                    </div>
                  ))}
                </div>
                <div className="product-inspector">
                  <small>BLOCK 9</small>
                  <strong>Choices & Adjusted Plan</strong>
                  <p>The story text, notes, storyboard direction, and visual frames stay connected to the same block.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section feature-section" id="features">
          <div className="marketing-section-heading">
            <p className="marketing-kicker">One playhouse. Five connected workspaces.</p>
            <h2>Everything develops the same story.</h2>
            <p>Move from learning to planning, full-script reading, visualization, and focused specialist engines without copying information between separate tools.</p>
          </div>
          <div className="feature-grid">
            <article>
              <span className="feature-code">01</span>
              <p className="feature-label">Learn</p>
              <h3>Instructions</h3>
              <p>Follow Bryan Harris&apos;s complete 24 Blocks method with focused questions, clear deliverables, and story-building guidance.</p>
            </article>
            <article>
              <span className="feature-code">02</span>
              <p className="feature-label">Develop</p>
              <h3>Story Planner</h3>
              <p>Build the world, cast, ghost, catalyst, foundations, The Pickle audience engine, dialogue, and all twenty-four causal story movements.</p>
            </article>
            <article>
              <span className="feature-code">03</span>
              <p className="feature-label">Read</p>
              <h3>Script Viewer</h3>
              <p>Follow the complete screenplay with colour-coded formatting, scene navigation, structural position, and guided questions answered from the project.</p>
            </article>
            <article>
              <span className="feature-code">04</span>
              <p className="feature-label">Visualize</p>
              <h3>Visual Board</h3>
              <p>Carry every block into storyboard directions, frame prompts, shot notes, locations, characters, and visual continuity.</p>
            </article>
            <article>
              <span className="feature-code">05</span>
              <p className="feature-label">Refine</p>
              <h3>Engines</h3>
              <p>Choose a guided specialist pass for structure, meaning, voice, screenplay action, draft diagnosis, or deliberate practice.</p>
            </article>
          </div>
        </section>

        <section className="marketing-section story-system-section">
          <div className="story-system-copy">
            <p className="marketing-kicker">Your entire story in one structure</p>
            <h2>Twelve story columns. One source of truth.</h2>
            <p>
              Story Setup, Pitch &amp; Vision, World, Characters, Ghost, Catalyst, Foundations, The Pickle, Dialogue, 24 Blocks, Storyboard, and Notes stay aligned across every workspace.
            </p>
            <ul>
              <li><span>01</span> One readable <code>.plotpickle.json</code> project file</li>
              <li><span>02</span> Import, export, and move projects between editions</li>
              <li><span>03</span> Your story remains yours and stays on your device</li>
            </ul>
          </div>
          <div className="story-column-stack" aria-label="The twelve PlotPickle story columns">
            {storySections.map((section) => (
              <div className={section.id === "blocks" ? "active" : ""} key={section.id}>
                <span>{section.code}</span><strong>{section.label}</strong><i aria-hidden="true">→</i>
              </div>
            ))}
          </div>
        </section>

        <section className="marketing-section how-section" id="how-it-works">
          <div className="marketing-section-heading">
            <p className="marketing-kicker">From download to first block</p>
            <h2>Open the door and start writing.</h2>
          </div>
          <div className="step-grid">
            <article><span>1</span><h3>Download</h3><p>Get the PlotPickle Playhouse Windows package.</p></article>
            <article><span>2</span><h3>Unzip</h3><p>Extract the folder somewhere easy to find, such as your Desktop.</p></article>
            <article><span>3</span><h3>Start</h3><p>Run the included PlotPickle starter and your browser will open automatically.</p></article>
            <article><span>4</span><h3>Keep it running</h3><p>The command window is PlotPickle&apos;s private local server. Leave it open while you work; useful errors appear there.</p></article>
          </div>
        </section>

        <section className="download-section" id="download">
          <div>
            <p className="marketing-kicker">PlotPickle Playhouse for Windows</p>
            <h2>Your story room, on your computer.</h2>
            <p>Download the local-first edition and develop your project without depending on a ChatGPT account.</p>
            <div className="download-details">
              <span>Windows 10 or 11</span><span>Portable folder</span><span>Local project storage</span>
            </div>
          </div>
          <div className="download-card">
            <span className="download-card-mark" aria-hidden="true"><img src="/brand/favicon/plotpickle-icon-128.png" alt="" /></span>
            <div><strong>PlotPickle Playhouse</strong><small>Windows edition</small></div>
            <a className="download-button" href={WINDOWS_DOWNLOAD_URL} target="_blank" rel="noreferrer">
              <span className="download-icon" aria-hidden="true">↓</span>
              <span><strong>Download latest</strong><small>Available through GitHub Releases</small></span>
            </a>
            <button type="button" className="marketing-text-link" onClick={onEnter}>Open the installed workspace</button>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <div className="marketing-brand">
          <img className="marketing-brand-logo" src="/brand/plotpickle-header-horizontal-600.png" alt="PlotPickle Playhouse" />
        </div>
        <p>Story development built around Bryan Harris&apos;s 24 Blocks method.</p>
        <div className="marketing-footer-actions"><button type="button" onClick={onEnter}>Open local workspace →</button><Link href="/legal">Copyright & licensing</Link><a href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">Source</a></div>
      </footer>
    </div>
  );
}

export default function Home() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [activeTab, setActiveTab] = useState<MainTab>("instructions");
  const [activeSection, setActiveSection] = useState<StorySection>("overview");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(1);
  const [selectedMiniBlockNumber, setSelectedMiniBlockNumber] = useState(1);
  const [writerMode, setWriterMode] = useState<WriterViewMode>("treatment");
  const [visualAct, setVisualAct] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState("Saved on this device");
  const [toast, setToast] = useState("");
  const [showLanding, setShowLanding] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          const normalized = normalizePlotPickleProject(parsed);
          if (normalized) setProject(normalized);
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

  if (showLanding) {
    return <LandingPage onEnter={() => setShowLanding(false)} />;
  }

  function commit(next: PlotPickleProject) {
    setSaveState("Saving…");
    setProject({
      ...next,
      metadata: { ...next.metadata, updatedAt: new Date().toISOString() },
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
    commit({
      ...project,
      development: {
        ...project.development,
        [section]: { ...project.development[section], [key]: value },
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
    setSaveState("Saving…");
    setProject(blank);
    setSelectedCharacterId("");
    setSelectedBlockNumber(1);
    setSelectedMiniBlockNumber(1);
    setActiveTab("planner");
    setActiveSection("storySetup");
    setToast("A blank feature screenplay is ready. Begin with Story Setup, then build the 24 Blocks and 96 mini-blocks.");
  }

  function loadAfterglow() {
    if (completion > 0 && project.id !== "afterglow-echoes-of-sentience" && !window.confirm("Replace the current project with the Afterglow example? Export first if you want a backup.")) return;
    const afterglow = createAfterglowProject();
    setSaveState("Saving…");
    setProject(afterglow);
    setSelectedCharacterId("ren");
    setSelectedBlockNumber(1);
    setSelectedMiniBlockNumber(1);
    setActiveTab("planner");
    setActiveSection("overview");
    setToast("Afterglow loaded across the Story Planner, all 96 Treatment positions, and Visual Storyboard context. Unreconciled material is clearly marked.");
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
    setSaveState("Saving…");
    setProject(imported);
    setSelectedCharacterId(imported.characters[0]?.id ?? "");
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="brand-lockup home-trigger" onClick={() => setShowLanding(true)} aria-label="Return to the PlotPickle product page">
          <img className="brand-icon" src="/brand/favicon/plotpickle-icon-128.png" alt="" aria-hidden="true" />
          <div>
            <strong>PlotPickle</strong>
            <span>PlotPickle Playhouse</span>
          </div>
        </button>

        <nav className="main-tabs" aria-label="Primary workspaces" role="tablist">
          {mainTabs.map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? "active" : ""}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              <small>{tab.description}</small>
            </button>
          ))}
        </nav>

        <div className="project-actions">
          <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json,.json,.txt,.fountain,.spmd,.fdx,text/plain,text/xml,application/xml" onChange={importFile} />
          <button type="button" className="text-button" onClick={createNewProject}>New</button>
          <button type="button" className="text-button" onClick={() => fileInputRef.current?.click()}>Import</button>
          <button type="button" className="text-button" onClick={exportProject}>Export</button>
          <button type="button" className="primary-button compact" onClick={loadAfterglow}>Load Afterglow</button>
        </div>
      </header>

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
          <span>{completion}% complete</span>
          <div className="progress-track"><i style={{ width: `${completion}%` }} /></div>
        </div>
      </div>

      <main className="workspace">
        {activeTab === "instructions" ? (
          <Instructions
            project={project}
            activeSection={activeSection}
            selectSection={setActiveSection}
            onStart={() => setActiveTab("planner")}
            onLoadAfterglow={loadAfterglow}
          />
        ) : null}

        {activeTab === "planner" ? (
          <div className="studio-layout">
            <StoryRail project={project} workspace="Story Planner" activeSection={activeSection} selectSection={setActiveSection} />

            <section className="planner-content">
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

        {activeTab === "script" ? (
          <ScriptWorkspace
            project={project}
            mode={writerMode}
            onModeChange={setWriterMode}
            onChange={(screenplay) => commit({ ...project, screenplay })}
            onProjectChange={commit}
            onOpenBlock={(number) => openBlock(number, "planner")}
          />
        ) : null}

        {activeTab === "visuals" ? (
          <div className="studio-layout visual-studio-layout">
            <StoryRail project={project} workspace="Visual Board" activeSection={activeSection} selectSection={setActiveSection} />
            <VisualStoryboard
              project={project}
              initialBlockNumber={selectedBlock.number}
              visualAct={visualAct}
              onVisualActChange={setVisualAct}
              onOpenPlannerBlock={(number) => openBlock(number, "planner")}
              onChange={commit}
            />
          </div>
        ) : null}

        {activeTab === "engines" ? <EngineHub /> : null}

        <div hidden={activeTab !== "settings"}>
          <SettingsPanel project={project} />
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
      <nav aria-label={`${workspace} story sections`}>
        {groups.map((group) => (
          <div className="story-rail-group" key={group}>
            <p className="story-rail-group-label">{group}</p>
            {storySections.filter((section) => section.group === group).map((section) => {
              const sectionProgress = progress[section.id];
              const alert = sectionHasAlert(project, section.id);
              const symbol = alert ? "!" : sectionProgress >= 70 ? "✓" : sectionProgress > 0 ? "◐" : "○";
              const status = alert ? "Open question or continuity item" : sectionProgress >= 70 ? "Substantially complete" : sectionProgress > 0 ? "In progress" : "Not started";
              return (
                <button type="button" className={activeSection === section.id ? "active" : ""} key={section.id} onClick={() => selectSection(section.id)}>
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
        <strong>4 → 12 → 24 → 48 → 96</strong>
        <p>Acts, sequences, blocks, scenes, and mini-blocks share one project.</p>
      </div>
    </aside>
  );
}

function Instructions({ project, activeSection, selectSection, onStart, onLoadAfterglow }: { project: PlotPickleProject; activeSection: StorySection; selectSection: (section: StorySection) => void; onStart: () => void; onLoadAfterglow: () => void }) {
  const guide = sectionGuides[activeSection];
  const current = storySections.find((section) => section.id === activeSection) ?? storySections[0];
  return (
    <div className="studio-layout instructions-layout">
      <StoryRail project={project} workspace="Instructions" activeSection={activeSection} selectSection={selectSection} />
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
          <article className="guide-card connection-card"><p className="eyebrow">Shared story data</p><h2>{guide.connection}</h2><div><span>Instructions</span><i>→</i><span>Story Planner</span><i>→</i><span>Script Viewer</span><i>→</i><span>Visual Board</span><i>→</i><span>Engines</span></div></article>
        </div>
        {activeSection === "blocks" ? (
          <div className="compact-act-guide">
            {actNames.map((name, index) => <article className={`act-${index + 1}`} key={name}><span>Act {index + 1}</span><strong>{name}</strong><small>Blocks {index * 6 + 1}–{index * 6 + 6}</small></article>)}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function StorySetupEditor({ project, updateMetadata, updateDevelopment }: { project: PlotPickleProject; updateMetadata: (key: keyof PlotPickleProject["metadata"], value: string) => void; updateDevelopment: DevelopmentUpdater }) {
  const setup = project.development.storySetup;
  return <div className="editor-page">
    <SectionHeading eyebrow="01 · Story Setup" title="Define the creative container." description="Set the practical and audience-facing decisions that every later column will inherit." />
    <div className="form-section"><h3>Project identity</h3><div className="form-grid three-columns">
      <FormField label="Title" value={project.metadata.title} onChange={(value) => updateMetadata("title", value)} multiline={false} />
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
              <button type="button" className={selected.id === character.id ? "active" : ""} key={character.id} onClick={() => select(character.id)}>
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
                <button type="button" className={selectedBlock.number === block.number ? "block-card active" : "block-card"} key={block.id} onClick={() => openBlock(block.number)}>
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
          <div><span className="field-label">Characters in this block</span><div className="chip-list">{project.characters.map((character) => <button type="button" className={selectedBlock.characterIds.includes(character.id) ? "active" : ""} key={character.id} onClick={() => toggleReference("characterIds", character.id)}>{character.name}</button>)}</div></div>
          <div><span className="field-label">Locations in this block</span><div className="chip-list">{project.world.locations.map((location) => <button type="button" className={selectedBlock.locationIds.includes(location.id) ? "active" : ""} key={location.id} onClick={() => toggleReference("locationIds", location.id)}>{location.name}</button>)}</div></div>
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
            <button type="button" className={selectedBlock.number === block.number ? `active act-${block.act}` : `act-${block.act}`} key={block.id} onClick={() => openBlock(block.number)}>
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
