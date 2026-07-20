"use client";

/* eslint-disable @next/next/no-img-element -- Project JSON accepts arbitrary user-supplied reference URLs. */

import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createAfterglowProject } from "@/data/afterglow";
import {
  addBlankCharacter,
  addBlankFrame,
  addBlankLocation,
  cloneProject,
  completionFor,
  createBlankProject,
  normalizePlotPickleProject,
  type Character,
  type Location,
  type PlotPickleProject,
  type StoryBlock,
  type VisualFrame,
} from "@/lib/project";

const STORAGE_KEY = "plotpickle.project.v1";

type MainTab = "instructions" | "planner" | "visuals";
type StorySection = "storySetup" | "pitch" | "world" | "characters" | "ghost" | "catalyst" | "foundations" | "dialogue" | "blocks" | "storyboard" | "notes";

const mainTabs: { id: MainTab; label: string; description: string }[] = [
  { id: "instructions", label: "Instructions", description: "Learn the method" },
  { id: "planner", label: "Story Planner", description: "Build the story" },
  { id: "visuals", label: "Visual Board", description: "See the film" },
];

const storySections: { id: StorySection; code: string; label: string }[] = [
  { id: "storySetup", code: "01", label: "Story Setup" },
  { id: "pitch", code: "PV", label: "Pitch & Vision" },
  { id: "world", code: "WD", label: "World" },
  { id: "characters", code: "CH", label: "Characters" },
  { id: "ghost", code: "GH", label: "Ghost" },
  { id: "catalyst", code: "CA", label: "Catalyst" },
  { id: "foundations", code: "FN", label: "Foundations" },
  { id: "dialogue", code: "DL", label: "Dialogue" },
  { id: "blocks", code: "24", label: "24 Blocks" },
  { id: "storyboard", code: "SB", label: "Storyboard" },
  { id: "notes", code: "NT", label: "Notes" },
];

const sectionGuides: Record<StorySection, { title: string; description: string; questions: string[]; deliverable: string; connection: string }> = {
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
  dialogue: {
    title: "Design voices that reveal pressure, not information.",
    description: "Dialogue should express strategy, status, subtext, genre, and relationship while making every speaker recognizably different.",
    questions: ["How does each character avoid saying what they mean?", "What rhythm and vocabulary belong only to them?", "Which exposition can become conflict or action?"],
    deliverable: "Voice contrasts, subtext rules, exposition limits, and recurring language.",
    connection: "Character voices and dialogue rules travel into every block's story text.",
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
  const values = [block.summary, block.goal, block.conflict, block.choice, block.action, block.consequence];
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

export default function Home() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [activeTab, setActiveTab] = useState<MainTab>("instructions");
  const [activeSection, setActiveSection] = useState<StorySection>("storySetup");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(1);
  const [selectedFrameId, setSelectedFrameId] = useState("");
  const [visualAct, setVisualAct] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState("Saved on this device");
  const [toast, setToast] = useState("");
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
  const selectedFrame = selectedBlock.visuals.find((frame) => frame.id === selectedFrameId) ?? selectedBlock.visuals[0];

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

  function replaceBlock(updatedBlock: StoryBlock) {
    commit({ ...project, blocks: project.blocks.map((block) => (block.number === updatedBlock.number ? updatedBlock : block)) });
  }

  function updateFrame(blockNumber: number, frameId: string, key: keyof VisualFrame, value: string) {
    commit({
      ...project,
      blocks: project.blocks.map((block) =>
        block.number === blockNumber
          ? { ...block, visuals: block.visuals.map((frame) => (frame.id === frameId ? { ...frame, [key]: value } : frame)) }
          : block,
      ),
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
    setActiveTab("planner");
    setActiveSection("storySetup");
    setToast("A new 24 Blocks project is ready.");
  }

  function loadAfterglow() {
    if (completion > 0 && project.id !== "afterglow-echoes-of-sentience" && !window.confirm("Replace the current project with the Afterglow example? Export first if you want a backup.")) return;
    const afterglow = createAfterglowProject();
    setSaveState("Saving…");
    setProject(afterglow);
    setSelectedCharacterId("ren");
    setSelectedBlockNumber(1);
    setActiveTab("planner");
    setActiveSection("storySetup");
    setToast("Afterglow loaded with its world, cast, and 24-block spine.");
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

  async function importProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const normalized = normalizePlotPickleProject(parsed);
      if (!normalized) throw new Error("invalid");
      commit(cloneProject(normalized));
      setSelectedCharacterId(normalized.characters[0]?.id ?? "");
      setSelectedBlockNumber(1);
      setToast("Project imported and connected to all three workspaces.");
    } catch {
      setToast("That file is not a valid PlotPickle 1.0 project with exactly 24 blocks.");
    }
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

  function addFrame(block: StoryBlock) {
    const updated = addBlankFrame(block);
    const frame = updated.visuals[updated.visuals.length - 1];
    replaceBlock(updated);
    setSelectedBlockNumber(block.number);
    setSelectedFrameId(frame.id);
  }

  function openBlock(number: number, destination: MainTab = "planner") {
    setSelectedBlockNumber(number);
    setActiveTab(destination);
    setActiveSection(destination === "planner" ? "blocks" : "storyboard");
    const block = project.blocks[number - 1];
    setSelectedFrameId(block.visuals[0]?.id ?? "");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">P</span>
          <div>
            <strong>PlotPickle</strong>
            <span>Open Story Studio</span>
          </div>
        </div>

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
          <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importProject} />
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
        <div className="progress-block" aria-label={`${completion}% story planning complete`}>
          <span>{completion}% complete</span>
          <div className="progress-track"><i style={{ width: `${completion}%` }} /></div>
        </div>
      </div>

      <main className="workspace">
        {activeTab === "instructions" ? (
          <Instructions
            activeSection={activeSection}
            selectSection={setActiveSection}
            onStart={() => setActiveTab("planner")}
            onLoadAfterglow={loadAfterglow}
          />
        ) : null}

        {activeTab === "planner" ? (
          <div className="studio-layout">
            <StoryRail workspace="Story Planner" activeSection={activeSection} selectSection={setActiveSection} />

            <section className="planner-content">
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

        {activeTab === "visuals" ? (
          <div className="studio-layout visual-studio-layout">
            <StoryRail workspace="Visual Board" activeSection={activeSection} selectSection={setActiveSection} />
            <VisualBoard
              project={project}
              activeSection={activeSection}
              selectedBlock={selectedBlock}
              selectedFrame={selectedFrame}
              visualAct={visualAct}
              setVisualAct={setVisualAct}
              openBlock={(number) => openBlock(number, "visuals")}
              selectFrame={setSelectedFrameId}
              addFrame={addFrame}
              updateFrame={updateFrame}
              updateBlock={updateBlock}
            />
          </div>
        ) : null}
      </main>

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}

type DevelopmentUpdater = (section: keyof PlotPickleProject["development"], key: string, value: string) => void;

function StoryRail({ workspace, activeSection, selectSection }: { workspace: string; activeSection: StorySection; selectSection: (section: StorySection) => void }) {
  return (
    <aside className="story-rail">
      <div className="story-rail-heading">
        <p className="eyebrow">{workspace}</p>
        <strong>Story columns</strong>
        <span>One structure. Three connected views.</span>
      </div>
      <nav aria-label={`${workspace} story sections`}>
        {storySections.map((section) => (
          <button type="button" className={activeSection === section.id ? "active" : ""} key={section.id} onClick={() => selectSection(section.id)}>
            <span>{section.code}</span>
            <strong>{section.label}</strong>
          </button>
        ))}
      </nav>
      <div className="method-note">
        <span>24 Blocks</span>
        <strong>4 acts × 6 blocks</strong>
        <p>Each block carries story text, notes, storyboard direction, and visual frames.</p>
      </div>
    </aside>
  );
}

function Instructions({ activeSection, selectSection, onStart, onLoadAfterglow }: { activeSection: StorySection; selectSection: (section: StorySection) => void; onStart: () => void; onLoadAfterglow: () => void }) {
  const guide = sectionGuides[activeSection];
  const current = storySections.find((section) => section.id === activeSection) ?? storySections[0];
  return (
    <div className="studio-layout instructions-layout">
      <StoryRail workspace="Instructions" activeSection={activeSection} selectSection={selectSection} />
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
          <article className="guide-card connection-card"><p className="eyebrow">Shared story data</p><h2>{guide.connection}</h2><div><span>Instructions</span><i>→</i><span>Story Planner</span><i>→</i><span>Visual Board</span></div></article>
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

function VisualBoard({
  project,
  activeSection,
  selectedBlock,
  selectedFrame,
  visualAct,
  setVisualAct,
  openBlock,
  selectFrame,
  addFrame,
  updateFrame,
  updateBlock,
}: {
  project: PlotPickleProject;
  activeSection: StorySection;
  selectedBlock: StoryBlock;
  selectedFrame?: VisualFrame;
  visualAct: number;
  setVisualAct: (act: number) => void;
  openBlock: (number: number) => void;
  selectFrame: (id: string) => void;
  addFrame: (block: StoryBlock) => void;
  updateFrame: (blockNumber: number, frameId: string, key: keyof VisualFrame, value: string) => void;
  updateBlock: (number: number, key: keyof StoryBlock, value: string | string[]) => void;
}) {
  const visibleBlocks = visualAct ? project.blocks.filter((block) => block.act === visualAct) : project.blocks;
  return (
    <div className="visual-page">
      <VisualContext project={project} section={activeSection} selectedBlock={selectedBlock} />
      <div className="visual-header">
        <SectionHeading eyebrow="Visual Board" title="See the whole story at once." description="Frames, prompts, shot notes, and continuity live inside the same 24 blocks as the story plan." action={<button type="button" className="primary-button compact" onClick={() => addFrame(selectedBlock)}>Add frame to Block {selectedBlock.number}</button>} />
        <div className="act-filter" aria-label="Filter visual board by act">
          {[0, 1, 2, 3, 4].map((act) => <button type="button" className={visualAct === act ? "active" : ""} key={act} onClick={() => setVisualAct(act)}>{act === 0 ? "All acts" : `Act ${act}`}</button>)}
        </div>
      </div>

      <div className="visual-workspace">
        <div className="storyboard-grid">
          {visibleBlocks.map((block) => {
            const frame = block.visuals[0];
            return (
              <button type="button" className={selectedBlock.number === block.number ? `storyboard-card active act-${block.act}` : `storyboard-card act-${block.act}`} key={block.id} onClick={() => openBlock(block.number)}>
                <div className="frame-preview">
                  {frame?.src ? <img src={frame.src} alt={frame.alt || `Block ${block.number} frame`} /> : <span><b>{String(block.number).padStart(2, "0")}</b><small>Image placeholder</small></span>}
                  {block.visuals.length > 1 ? <i>{block.visuals.length} frames</i> : null}
                </div>
                <div className="frame-caption"><span>Block {block.number}</span><strong>{block.title}</strong><p>{frame?.caption || block.summary || block.purpose}</p></div>
              </button>
            );
          })}
        </div>

        <aside className="visual-inspector">
          <div className="visual-inspector-head"><div className={`block-index act-${selectedBlock.act}`}>{String(selectedBlock.number).padStart(2, "0")}</div><div><span>Selected block</span><h2>{selectedBlock.title}</h2></div></div>
          <FormField label="Block visual summary" value={selectedBlock.summary} onChange={(value) => updateBlock(selectedBlock.number, "summary", value)} help="The action the frame sequence must communicate." />
          <FormField label="Storyboard direction" value={selectedBlock.storyboardDirection} onChange={(value) => updateBlock(selectedBlock.number, "storyboardDirection", value)} help="The planned image progression shared with Story Planner." />
          <div className="frame-strip">
            {selectedBlock.visuals.map((frame, index) => (
              <button type="button" className={selectedFrame?.id === frame.id ? "active" : ""} key={frame.id} onClick={() => selectFrame(frame.id)}>
                {frame.src ? <img src={frame.src} alt={frame.alt || `Frame ${index + 1}`} /> : <span>{index + 1}</span>}
              </button>
            ))}
            <button type="button" className="add-frame-tile" onClick={() => addFrame(selectedBlock)}>+</button>
          </div>
          {selectedFrame ? (
            <div className="frame-editor">
              <FormField label="Image URL" value={selectedFrame.src} onChange={(value) => updateFrame(selectedBlock.number, selectedFrame.id, "src", value)} multiline={false} placeholder="https://…" />
              <FormField label="Caption" value={selectedFrame.caption} onChange={(value) => updateFrame(selectedBlock.number, selectedFrame.id, "caption", value)} />
              <FormField label="Image prompt" value={selectedFrame.prompt} onChange={(value) => updateFrame(selectedBlock.number, selectedFrame.id, "prompt", value)} help="Describe character, action, location, light, mood, and visual style." />
              <FormField label="Shot & lens" value={selectedFrame.shot} onChange={(value) => updateFrame(selectedBlock.number, selectedFrame.id, "shot", value)} />
              <FormField label="Continuity lock" value={selectedFrame.continuity} onChange={(value) => updateFrame(selectedBlock.number, selectedFrame.id, "continuity", value)} help="Wardrobe, props, time of day, injuries, screen direction, and recurring design details." />
              <FormField label="Accessible description" value={selectedFrame.alt} onChange={(value) => updateFrame(selectedBlock.number, selectedFrame.id, "alt", value)} />
            </div>
          ) : <div className="empty-frame"><p>This block has no storyboard frames yet.</p><button type="button" className="primary-button" onClick={() => addFrame(selectedBlock)}>Add the first frame</button></div>}
        </aside>
      </div>
    </div>
  );
}

function VisualContext({ project, section, selectedBlock }: { project: PlotPickleProject; section: StorySection; selectedBlock: StoryBlock }) {
  const contexts: Record<StorySection, { title: string; values: string[] }> = {
    storySetup: { title: "Production container", values: [project.metadata.format, `${project.metadata.targetMinutes} minutes`, project.development.storySetup.audience] },
    pitch: { title: "Pitch & visual promise", values: [project.development.pitch.oneSentence || project.story.logline, project.development.pitch.visualVision, project.development.pitch.emotionalExperience] },
    world: { title: "World continuity", values: [project.world.period, project.world.visualLanguage, project.world.rules] },
    characters: { title: "Cast in visual continuity", values: project.characters.slice(0, 5).map((character) => `${character.name}: ${character.description}`) },
    ghost: { title: "Ghost beneath the image", values: [project.development.ghost.centralWound, project.development.ghost.presentPattern, project.development.ghost.truth] },
    catalyst: { title: "Catalyst in visible action", values: [project.story.catalyst, project.development.catalyst.immediateImpact, project.development.catalyst.doorway] },
    foundations: { title: "Foundation check", values: [project.development.foundations.objective, project.development.foundations.opposition, project.development.foundations.transformation] },
    dialogue: { title: "Voice & subtext reference", values: [project.development.dialogue.voiceContrast, project.development.dialogue.subtext, project.development.dialogue.recurringLanguage] },
    blocks: { title: `Block ${selectedBlock.number} story motion`, values: [selectedBlock.goal, selectedBlock.choice, selectedBlock.consequence] },
    storyboard: { title: `Block ${selectedBlock.number} storyboard direction`, values: [selectedBlock.storyboardDirection, selectedBlock.summary, `${selectedBlock.visuals.length}/4 visuals planned`] },
    notes: { title: "Continuity & revision notes", values: [project.development.notes.continuity, project.development.notes.openQuestions, project.development.notes.revisions] },
  };
  const context = contexts[section];
  const values = context.values.filter(Boolean);
  return <section className="visual-context"><div><p className="eyebrow">{storySections.find((item) => item.id === section)?.label} reference</p><h2>{context.title}</h2></div><div>{values.length ? values.slice(0, 3).map((value, index) => <p key={`${section}-${index}`}>{value}</p>) : <p className="context-empty">Add this detail in Story Planner and it will appear here.</p>}</div></section>;
}
