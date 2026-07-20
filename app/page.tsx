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
  isPlotPickleProject,
  type Character,
  type Location,
  type PlotPickleProject,
  type StoryBlock,
  type VisualFrame,
} from "@/lib/project";

const STORAGE_KEY = "plotpickle.project.v1";

type MainTab = "instructions" | "planner" | "visuals";
type PlannerSection = "foundation" | "world" | "characters" | "blocks";

const mainTabs: { id: MainTab; label: string; description: string }[] = [
  { id: "instructions", label: "Instructions", description: "Learn the method" },
  { id: "planner", label: "Story Planner", description: "Build the story" },
  { id: "visuals", label: "Visual Board", description: "See the film" },
];

const plannerSections: { id: PlannerSection; label: string }[] = [
  { id: "foundation", label: "Foundation" },
  { id: "world", label: "World" },
  { id: "characters", label: "Characters" },
  { id: "blocks", label: "24 Blocks" },
];

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
  const [plannerSection, setPlannerSection] = useState<PlannerSection>("foundation");
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
          if (isPlotPickleProject(parsed)) setProject(parsed);
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
    setPlannerSection("foundation");
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
    setPlannerSection("foundation");
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
      if (!isPlotPickleProject(parsed)) throw new Error("invalid");
      commit(cloneProject(parsed));
      setSelectedCharacterId(parsed.characters[0]?.id ?? "");
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
    if (destination === "planner") setPlannerSection("blocks");
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
          <Instructions onStart={() => { setActiveTab("planner"); setPlannerSection("foundation"); }} onLoadAfterglow={loadAfterglow} />
        ) : null}

        {activeTab === "planner" ? (
          <div className="planner-layout">
            <aside className="planner-nav">
              <p className="eyebrow">Story Planner</p>
              <h1>Build from the inside out.</h1>
              <p>Every answer becomes part of the same story file used by your blocks and visual board.</p>
              <nav aria-label="Story planner sections">
                {plannerSections.map((section, index) => (
                  <button
                    type="button"
                    className={plannerSection === section.id ? "active" : ""}
                    key={section.id}
                    onClick={() => setPlannerSection(section.id)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {section.label}
                  </button>
                ))}
              </nav>
              <div className="method-note">
                <span>24 Blocks</span>
                <strong>4 acts × 6 blocks</strong>
                <p>Approximately five minutes of screen time per block for a 120-minute feature.</p>
              </div>
            </aside>

            <section className="planner-content">
              {plannerSection === "foundation" ? (
                <Foundation project={project} updateMetadata={updateMetadata} updateStory={updateStory} />
              ) : null}
              {plannerSection === "world" ? (
                <WorldEditor project={project} updateWorld={updateWorld} updateLocation={updateLocation} addLocation={addLocation} />
              ) : null}
              {plannerSection === "characters" ? (
                <CharacterEditor
                  project={project}
                  selected={selectedCharacter}
                  select={setSelectedCharacterId}
                  update={updateCharacter}
                  add={addCharacter}
                />
              ) : null}
              {plannerSection === "blocks" ? (
                <BlocksEditor
                  project={project}
                  selectedBlock={selectedBlock}
                  openBlock={openBlock}
                  updateBlock={updateBlock}
                  toggleReference={toggleBlockReference}
                  openVisual={(number) => openBlock(number, "visuals")}
                />
              ) : null}
            </section>
          </div>
        ) : null}

        {activeTab === "visuals" ? (
          <VisualBoard
            project={project}
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
        ) : null}
      </main>

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}

function Instructions({ onStart, onLoadAfterglow }: { onStart: () => void; onLoadAfterglow: () => void }) {
  return (
    <div className="instructions-page">
      <section className="instructions-hero">
        <div>
          <p className="eyebrow">The 24 Blocks method</p>
          <h1>Turn one story into<br />twenty-four visible choices.</h1>
          <p className="hero-copy">PlotPickle divides a feature screenplay into four acts of six blocks. You develop the story once, then use the same characters, world, beats, and images everywhere.</p>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={onStart}>Start with the foundation</button>
            <button type="button" className="secondary-button" onClick={onLoadAfterglow}>Explore the Afterglow example</button>
          </div>
        </div>
        <div className="hero-board" aria-label="Four acts containing six blocks each">
          {[1, 2, 3, 4].map((act) => (
            <div className={`mini-act act-${act}`} key={act}>
              <span>Act {act}</span>
              <strong>{actNames[act - 1]}</strong>
              <div>{[1, 2, 3, 4, 5, 6].map((item) => <i key={item} />)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="workflow-section">
        <SectionHeading eyebrow="One source of truth" title="Three connected workspaces" description="You never have to re-enter the same story information in separate tools." />
        <div className="workflow-grid">
          <article><span>01</span><h3>Instructions</h3><p>Understand what each decision does and why it matters to the next block.</p></article>
          <article><span>02</span><h3>Story Planner</h3><p>Define the foundation, world, cast, and the cause-and-effect spine of all 24 blocks.</p></article>
          <article><span>03</span><h3>Visual Board</h3><p>Attach frames, prompts, shots, and continuity notes directly to the block they represent.</p></article>
        </div>
      </section>

      <section className="act-guide">
        <SectionHeading eyebrow="Four-act rhythm" title="Each act has a job" description="The method is a flexible diagnostic map, not a formula that replaces the writer." />
        <div className="act-guide-grid">
          {actNames.map((name, index) => (
            <article className={`act-card act-${index + 1}`} key={name}>
              <span>Act {index + 1} · Blocks {index * 6 + 1}–{index * 6 + 6}</span>
              <h3>{name}</h3>
              <p>{[
                "Establish the ordinary world, expose the ghost, trigger the catalyst, and force commitment.",
                "Explore the new world as plans create pressure, revelations, and a decisive midpoint turn.",
                "Make choices hurt. Collapse the old plan so internal change becomes necessary.",
                "Turn transformation into final action, resolve the dramatic question, and reveal the new normal.",
              ][index]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="data-promise">
        <div><p className="eyebrow">Your work stays yours</p><h2>Local-first by design.</h2></div>
        <p>PlotPickle autosaves on this device. Export the complete project as readable JSON whenever you want a backup, another computer, or a future integration.</p>
      </section>
    </div>
  );
}

function Foundation({
  project,
  updateMetadata,
  updateStory,
}: {
  project: PlotPickleProject;
  updateMetadata: (key: keyof PlotPickleProject["metadata"], value: string) => void;
  updateStory: (key: keyof PlotPickleProject["story"], value: string) => void;
}) {
  return (
    <div className="editor-page">
      <SectionHeading eyebrow="01 · Foundation" title="What story are you promising?" description="Define the central idea before distributing it across 24 blocks." />
      <div className="form-section">
        <h3>Project identity</h3>
        <div className="form-grid three-columns">
          <FormField label="Title" value={project.metadata.title} onChange={(value) => updateMetadata("title", value)} multiline={false} />
          <FormField label="Format" value={project.metadata.format} onChange={(value) => updateMetadata("format", value)} multiline={false} />
          <FormField label="Target minutes" value={project.metadata.targetMinutes} onChange={(value) => updateMetadata("targetMinutes", value)} multiline={false} type="number" />
          <FormField label="Subtitle" value={project.metadata.subtitle} onChange={(value) => updateMetadata("subtitle", value)} multiline={false} />
          <FormField label="Genre" value={project.metadata.genre} onChange={(value) => updateMetadata("genre", value)} multiline={false} />
          <FormField label="Tone" value={project.metadata.tone} onChange={(value) => updateMetadata("tone", value)} multiline={false} />
        </div>
      </div>
      <div className="form-section">
        <h3>The promise</h3>
        <div className="form-grid two-columns">
          <FormField label="Premise" value={project.story.premise} onChange={(value) => updateStory("premise", value)} help="The core situation and the possibility it creates." />
          <FormField label="Logline" value={project.story.logline} onChange={(value) => updateStory("logline", value)} help="Protagonist + goal + opposition + stakes." />
          <FormField label="Theme" value={project.story.theme} onChange={(value) => updateStory("theme", value)} help="The argument the story ultimately makes." />
          <FormField label="Anti-theme" value={project.story.antiTheme} onChange={(value) => updateStory("antiTheme", value)} help="The opposing belief that appears persuasive." />
          <FormField label="Dramatic question" value={project.story.dramaticQuestion} onChange={(value) => updateStory("dramaticQuestion", value)} help="The question the ending must answer." />
          <FormField label="Stakes" value={project.story.stakes} onChange={(value) => updateStory("stakes", value)} help="What can be lost externally, internally, and relationally?" />
        </div>
      </div>
      <div className="form-section signal-section">
        <div className="form-grid two-columns">
          <FormField label="Opening hook" value={project.story.hook} onChange={(value) => updateStory("hook", value)} help="The first compelling image, question, or disturbance." />
          <FormField label="Catalyst" value={project.story.catalyst} onChange={(value) => updateStory("catalyst", value)} help="The Block 1 event that makes the ordinary world impossible to continue." />
          <FormField label="Ending" value={project.story.ending} onChange={(value) => updateStory("ending", value)} help="The answer, outcome, and closing image you are writing toward." />
          <FormField label="Foundation notes" value={project.story.notes} onChange={(value) => updateStory("notes", value)} help="Questions, uncertainties, and source reconciliation notes." />
        </div>
      </div>
    </div>
  );
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
        <FormField label="What happens?" value={selectedBlock.summary} onChange={(value) => updateBlock(selectedBlock.number, "summary", value)} help="Write the block as a compact, visible sequence—not an abstract intention." />
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
        <div className="form-grid two-columns">
          <FormField label="Setup" value={selectedBlock.setup} onChange={(value) => updateBlock(selectedBlock.number, "setup", value)} />
          <FormField label="Payoff" value={selectedBlock.payoff} onChange={(value) => updateBlock(selectedBlock.number, "payoff", value)} />
          <FormField label="Script excerpt" value={selectedBlock.scriptExcerpt} onChange={(value) => updateBlock(selectedBlock.number, "scriptExcerpt", value)} />
          <FormField label="Block notes" value={selectedBlock.notes} onChange={(value) => updateBlock(selectedBlock.number, "notes", value)} />
        </div>
      </div>
    </div>
  );
}

function VisualBoard({
  project,
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
