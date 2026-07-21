"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createBlankProject,
  normalizePlotPickleProject,
  type PlotPickleProject,
} from "@/lib/project";
import styles from "./resonance.module.css";

const STORAGE_KEY = "plotpickle.project.v1";

type StoryKey = "dramaticQuestion" | "theme" | "antiTheme" | "hook" | "ending";
type PitchKey = "audiencePromise" | "emotionalExperience";
type DialogueKey = "subtext" | "recurringLanguage";
type BlockKey = "emotionalTurn" | "setup" | "payoff" | "pickleTurn";

function filled(values: string[]) {
  return values.filter((value) => value.trim()).length;
}

function calculateSignal(project: PlotPickleProject) {
  const core = filled([project.story.dramaticQuestion, project.story.theme, project.story.antiTheme]);
  const purpose = filled([
    project.development.pitch.audiencePromise,
    project.development.pitch.emotionalExperience,
  ]);
  const frame = filled([project.story.hook, project.story.ending]);
  const channels = filled([
    project.world.visualLanguage,
    project.development.dialogue.subtext,
    project.development.dialogue.recurringLanguage,
  ]);
  const resonantBlocks = project.blocks.filter(
    (block) =>
      block.emotionalTurn.trim() &&
      block.pickleTurn.trim() &&
      (block.setup.trim() || block.payoff.trim()),
  ).length;
  const signal = Math.round(
    (core / 3) * 30 +
      (purpose / 2) * 15 +
      (frame / 2) * 15 +
      (channels / 3) * 15 +
      (resonantBlocks / 24) * 25,
  );
  return { core, frame, channels, resonantBlocks, signal };
}

function Field({
  label,
  help,
  value,
  onChange,
  rows = 5,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
      <small>{help}</small>
    </label>
  );
}

export default function ResonancePage() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(1);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState("Loading the active PlotPickle project…");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setStatus("No saved project was found. Open PlotPickle or begin with the blank project shown here.");
          return;
        }
        const normalized = normalizePlotPickleProject(JSON.parse(stored));
        if (!normalized) {
          setStatus("The saved project could not be upgraded. A blank project is shown instead.");
          return;
        }
        setProject(normalized);
        setSelectedCharacterId(normalized.characters[0]?.id ?? "");
        setStatus("Connected to the active PlotPickle project.");
      } catch {
        setStatus("The saved project could not be opened. A blank project is shown instead.");
      } finally {
        setHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const selectedBlock = project.blocks.find((block) => block.number === selectedBlockNumber) ?? project.blocks[0];
  const selectedCharacter = project.characters.find((character) => character.id === selectedCharacterId) ?? project.characters[0];
  const signal = useMemo(() => calculateSignal(project), [project]);

  function commit(next: PlotPickleProject, message = "Saved to this device.") {
    const updated = {
      ...next,
      metadata: { ...next.metadata, updatedAt: new Date().toISOString() },
    } satisfies PlotPickleProject;
    setProject(updated);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setStatus(message);
  }

  function updateStory(key: StoryKey, value: string) {
    commit({ ...project, story: { ...project.story, [key]: value } });
  }

  function updatePitch(key: PitchKey, value: string) {
    commit({
      ...project,
      development: {
        ...project.development,
        pitch: { ...project.development.pitch, [key]: value },
      },
    });
  }

  function updateDialogue(key: DialogueKey, value: string) {
    commit({
      ...project,
      development: {
        ...project.development,
        dialogue: { ...project.development.dialogue, [key]: value },
      },
    });
  }

  function updateBlock(key: BlockKey, value: string) {
    commit({
      ...project,
      blocks: project.blocks.map((block) =>
        block.number === selectedBlock.number ? { ...block, [key]: value } : block,
      ),
    });
  }

  function exportProject() {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.metadata.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plotpickle-project"}.plotpickle.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("Project exported with its current Resonance Engine work.");
  }

  const blockCause = [selectedBlock.goal, selectedBlock.conflict, selectedBlock.choice, selectedBlock.consequence]
    .filter(Boolean)
    .join(" → ");

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>PlotPickle Playhouse · Story alignment workspace</p>
            <h1>Resonance Engine</h1>
            <p>
              Turn the story&apos;s central question into a pattern of character choices, block turns, images, locations,
              objects, and dialogue. Build cohesion without reducing the screenplay to a slogan.
            </p>
          </div>
          <div className={styles.actions}>
            <Link className={styles.secondaryButton} href="/">Back to PlotPickle</Link>
            <Link className={styles.secondaryButton} href="/pageflow">Open PageFlow</Link>
            <Link className={styles.secondaryButton} href="/voiceprint">Open Voiceprint</Link>
            <button className={styles.button} type="button" onClick={exportProject}>Export project</button>
          </div>
        </header>

        <section className={styles.projectBar}>
          <div className={styles.projectTitle}>
            <strong>{project.metadata.title}</strong>
            <span>Project schema {project.schemaVersion} · {project.metadata.status}</span>
          </div>
          <label>
            <span>Resonance block</span>
            <select value={selectedBlock.number} onChange={(event) => setSelectedBlockNumber(Number(event.target.value))}>
              {project.blocks.map((block) => <option value={block.number} key={block.id}>Block {block.number}: {block.title}</option>)}
            </select>
          </label>
          <label>
            <span>Character argument</span>
            <select value={selectedCharacter?.id ?? ""} onChange={(event) => setSelectedCharacterId(event.target.value)} disabled={!project.characters.length}>
              {project.characters.map((character) => <option value={character.id} key={character.id}>{character.name} · {character.role}</option>)}
            </select>
          </label>
        </section>

        <section className={styles.signalPanel} aria-label="Resonance alignment signal">
          <div className={styles.signalCopy}>
            <p className={styles.kicker}>Alignment signal</p>
            <div className={styles.signalNumber}>{signal.signal}<span>/100</span></div>
            <p>This is a coverage prompt, not a quality grade. Contradiction and ambiguity are welcome when intentional.</p>
          </div>
          <div className={styles.signalDetails}>
            <div className={styles.meter}><span style={{ width: `${signal.signal}%` }} /></div>
            <div className={styles.metricGrid}>
              <div><strong>{signal.core}/3</strong><span>core compass</span></div>
              <div><strong>{signal.frame}/2</strong><span>image bracket</span></div>
              <div><strong>{signal.channels}/3</strong><span>evidence channels</span></div>
              <div><strong>{signal.resonantBlocks}/24</strong><span>aligned blocks</span></div>
            </div>
          </div>
        </section>

        <section className={styles.compassPanel}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>The contested idea</p>
            <h2>Ask a question the story must earn.</h2>
            <p>Place competing answers under pressure and let choices and consequences create meaning.</p>
          </div>
          <div className={styles.threeColumns}>
            <Field label="Central question" help="Use a difficult, arguable question—not an automatic moral answer." value={project.story.dramaticQuestion} onChange={(value) => updateStory("dramaticQuestion", value)} />
            <Field label="Working answer" help="The answer the completed story may support through action and consequence." value={project.story.theme} onChange={(value) => updateStory("theme", value)} />
            <Field label="Credible counter-answer" help="The opposing belief must be strong enough that intelligent characters could live by it." value={project.story.antiTheme} onChange={(value) => updateStory("antiTheme", value)} />
          </div>
          <div className={styles.twoColumns}>
            <Field label="Reason to tell this story" help="What should make this story matter to its audience now?" value={project.development.pitch.audiencePromise} onChange={(value) => updatePitch("audiencePromise", value)} />
            <Field label="Audience aftertaste" help="Name the feeling or unresolved thought that should remain after the ending." value={project.development.pitch.emotionalExperience} onChange={(value) => updatePitch("emotionalExperience", value)} />
          </div>
        </section>

        <section className={styles.imageBracket}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Opening and closing proof</p>
            <h2>Let the first and last images argue with each other.</h2>
            <p>Their difference should reveal what changed, failed to change, reversed, or remains unresolved.</p>
          </div>
          <div className={styles.twoColumns}>
            <Field label="Opening image or first impression" help="The starting condition, belief, imbalance, or visual promise." value={project.story.hook} onChange={(value) => updateStory("hook", value)} rows={6} />
            <Field label="Closing image or final proof" help="A visible outcome that answers or deliberately complicates the opening." value={project.story.ending} onChange={(value) => updateStory("ending", value)} rows={6} />
          </div>
        </section>

        <div className={styles.workspace}>
          <section className={styles.blockPanel}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>Block {selectedBlock.number} · {selectedBlock.title}</p>
              <h2>Make this block carry part of the argument.</h2>
              <p>{blockCause || "Add the goal, conflict, choice, and consequence in Story Planner so the idea has dramatic pressure."}</p>
            </div>
            <div className={styles.twoColumns}>
              <Field label="Belief under pressure" help="What position changes, hardens, fractures, or becomes visible here?" value={selectedBlock.emotionalTurn} onChange={(value) => updateBlock("emotionalTurn", value)} />
              <Field label="Audience reframe" help="How does this block change what the audience expects or believes?" value={selectedBlock.pickleTurn} onChange={(value) => updateBlock("pickleTurn", value)} />
              <Field label="Question seed" help="An image, choice, object, relationship, or line that plants meaning for later." value={selectedBlock.setup} onChange={(value) => updateBlock("setup", value)} />
              <Field label="Answer evidence" help="A consequence or callback that gives the seed new meaning without explaining it." value={selectedBlock.payoff} onChange={(value) => updateBlock("payoff", value)} />
            </div>
            <div className={styles.readOnlyCard}>
              <strong>Visible sequence from PageFlow</strong>
              <p>{selectedBlock.storyboardDirection || "No visual sequence has been recorded for this block yet."}</p>
            </div>
          </section>

          <aside className={styles.characterPanel}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>Character as argument</p>
              <h2>{selectedCharacter?.name ?? "No character selected"}</h2>
              <p>Characters test the question by pursuing different wants, protecting different wounds, and paying different prices.</p>
            </div>
            {selectedCharacter ? (
              <div className={styles.characterGrid}>
                <article><span>Want</span><p>{selectedCharacter.want || "Not defined"}</p></article>
                <article><span>Need</span><p>{selectedCharacter.need || "Not defined"}</p></article>
                <article><span>Ghost</span><p>{selectedCharacter.ghost || "Not defined"}</p></article>
                <article><span>Arc / outcome</span><p>{selectedCharacter.arc || "Not defined"}</p></article>
              </div>
            ) : <p className={styles.empty}>Add characters in Story Planner to compare their answers to the story question.</p>}
          </aside>
        </div>

        <section className={styles.channelsPanel}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Evidence channels</p>
            <h2>Repeat meaning through variation, not repetition.</h2>
            <p>Images, settings, objects and language should approach the same question from different angles.</p>
          </div>
          <div className={styles.threeColumns}>
            <Field label="Visual and location language" help="Spaces, materials, colours, objects, movement patterns, and environmental contrasts." value={project.world.visualLanguage} onChange={(value) => commit({ ...project, world: { ...project.world, visualLanguage: value } })} rows={8} />
            <Field label="Behavioural subtext" help="How characters conceal, redirect, embody, or resist the central question." value={project.development.dialogue.subtext} onChange={(value) => updateDialogue("subtext", value)} rows={8} />
            <Field label="Recurring language and motifs" help="Words, images, objects, jokes, rituals, and callbacks whose meaning changes." value={project.development.dialogue.recurringLanguage} onChange={(value) => updateDialogue("recurringLanguage", value)} rows={8} />
          </div>
          <div className={styles.restraintNote}>
            <strong>Restraint rule</strong>
            <p>Prefer choices, rewards, losses, reversals and visual callbacks over speeches that explain what the story means. A motif earns its place when its meaning changes.</p>
          </div>
        </section>

        <p className={styles.status} aria-live="polite">{hydrated ? status : "Loading the active PlotPickle project…"}</p>
      </div>
    </main>
  );
}
