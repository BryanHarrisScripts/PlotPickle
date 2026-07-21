"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createBlankProject,
  normalizePlotPickleProject,
  type PlotPickleProject,
} from "@/lib/project";
import styles from "./draftlens.module.css";

const STORAGE_KEY = "plotpickle.project.v1";

type NoteKey =
  | "general"
  | "research"
  | "openQuestions"
  | "continuity"
  | "revisions"
  | "sources";

function filled(values: string[]) {
  return values.filter((value) => value.trim()).length;
}

function calculateReviewSignal(project: PlotPickleProject) {
  const spine = filled([
    project.story.dramaticQuestion,
    project.story.catalyst,
    project.story.stakes,
    project.story.ending,
  ]);
  const characters = project.characters.filter(
    (character) => character.want.trim() && character.need.trim() && character.arc.trim(),
  ).length;
  const blocks = project.blocks.filter(
    (block) =>
      block.goal.trim() &&
      block.conflict.trim() &&
      (block.action.trim() || block.choice.trim()) &&
      block.consequence.trim(),
  ).length;
  const notes = filled([
    project.development.notes.general,
    project.development.notes.revisions,
    project.development.notes.openQuestions,
    project.development.notes.continuity,
  ]);
  const pages = project.blocks.filter((block) => block.scriptExcerpt.trim()).length;

  const signal = Math.round(
    (spine / 4) * 25 +
      (Math.min(characters, 4) / 4) * 15 +
      (blocks / 24) * 25 +
      (notes / 4) * 20 +
      (pages / 24) * 15,
  );

  return { spine, characters, blocks, notes, pages, signal };
}

function Field({
  label,
  help,
  value,
  onChange,
  rows = 7,
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

function LensCard({
  number,
  title,
  question,
  evidence,
}: {
  number: string;
  title: string;
  question: string;
  evidence: string;
}) {
  return (
    <article className={styles.lensCard}>
      <span className={styles.lensNumber}>{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{question}</p>
        <small>{evidence}</small>
      </div>
    </article>
  );
}

export default function DraftLensPage() {
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
  const reviewSignal = useMemo(() => calculateReviewSignal(project), [project]);

  function commit(next: PlotPickleProject, message = "Saved to this device.") {
    const updated: PlotPickleProject = {
      ...next,
      metadata: { ...next.metadata, updatedAt: new Date().toISOString() },
    };
    setProject(updated);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setStatus(message);
  }

  function updateNote(key: NoteKey, value: string) {
    commit({
      ...project,
      development: {
        ...project.development,
        notes: { ...project.development.notes, [key]: value },
      },
    });
  }

  function updateBlockNote(value: string) {
    commit({
      ...project,
      blocks: project.blocks.map((block) =>
        block.number === selectedBlock.number ? { ...block, notes: value } : block,
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
    setStatus("Project exported with the current DraftLens review work.");
  }

  const characterEvidence = selectedCharacter
    ? [
        selectedCharacter.want && `Want: ${selectedCharacter.want}`,
        selectedCharacter.need && `Need: ${selectedCharacter.need}`,
        selectedCharacter.ghost && `Ghost: ${selectedCharacter.ghost}`,
        selectedCharacter.fatalFlaw && `Flaw: ${selectedCharacter.fatalFlaw}`,
        selectedCharacter.arc && `Arc: ${selectedCharacter.arc}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Add a character in Story Planner to inspect the character engine.";

  const blockEvidence = [
    selectedBlock.goal,
    selectedBlock.conflict,
    selectedBlock.choice || selectedBlock.action,
    selectedBlock.consequence,
  ]
    .filter(Boolean)
    .join(" → ");

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>PlotPickle Playhouse · Whole-draft review workspace</p>
            <h1>DraftLens Engine</h1>
            <p>
              Read the screenplay as a flexible blueprint, locate what the reader actually experiences, and turn feedback into
              story-serving questions. Diagnose the root problem before choosing a solution.
            </p>
          </div>
          <div className={styles.actions}>
            <Link className={styles.secondaryButton} href="/">Back to PlotPickle</Link>
            <Link className={styles.secondaryButton} href="/resonance">Open Resonance</Link>
            <Link className={styles.secondaryButton} href="/pageflow">Open PageFlow</Link>
            <button className={styles.button} type="button" onClick={exportProject}>Export project</button>
          </div>
        </header>

        <section className={styles.projectBar}>
          <div className={styles.projectTitle}>
            <strong>{project.metadata.title}</strong>
            <span>Project schema {project.schemaVersion} · {project.metadata.status}</span>
          </div>
          <label>
            <span>Review block</span>
            <select value={selectedBlock.number} onChange={(event) => setSelectedBlockNumber(Number(event.target.value))}>
              {project.blocks.map((block) => <option value={block.number} key={block.id}>Block {block.number}: {block.title}</option>)}
            </select>
          </label>
          <label>
            <span>Character lens</span>
            <select value={selectedCharacter?.id ?? ""} onChange={(event) => setSelectedCharacterId(event.target.value)} disabled={!project.characters.length}>
              {project.characters.map((character) => <option value={character.id} key={character.id}>{character.name} · {character.role}</option>)}
            </select>
          </label>
        </section>

        <section className={styles.signalPanel} aria-label="DraftLens review coverage signal">
          <div>
            <p className={styles.kicker}>Review coverage</p>
            <div className={styles.signalNumber}>{reviewSignal.signal}<span>/100</span></div>
            <p>This measures preparation and recorded evidence, not whether the screenplay is good or finished.</p>
          </div>
          <div className={styles.signalDetails}>
            <div className={styles.meter}><span style={{ width: `${reviewSignal.signal}%` }} /></div>
            <div className={styles.metricGrid}>
              <div><strong>{reviewSignal.spine}/4</strong><span>story spine</span></div>
              <div><strong>{Math.min(reviewSignal.characters, 4)}/4</strong><span>character arcs</span></div>
              <div><strong>{reviewSignal.blocks}/24</strong><span>causal blocks</span></div>
              <div><strong>{reviewSignal.pages}/24</strong><span>drafted blocks</span></div>
              <div><strong>{reviewSignal.notes}/4</strong><span>review records</span></div>
            </div>
          </div>
        </section>

        <section className={styles.firstReadPanel}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>First-read contract</p>
            <h2>Record the experience before trying to repair it.</h2>
            <p>
              Approach the draft without assuming what it should become. Capture where attention rose, stalled, became confused,
              or changed direction before proposing revisions.
            </p>
          </div>
          <Field
            label="First-read observations"
            help="Record the reader experience, strongest impressions, confusion points, emotional turns, and what remains after the read. This uses the shared General Notes field."
            value={project.development.notes.general}
            onChange={(value) => updateNote("general", value)}
            rows={10}
          />
        </section>

        <section className={styles.lensesPanel}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Six diagnostic lenses</p>
            <h2>Inspect the draft from different angles.</h2>
            <p>A note becomes useful when it identifies the reader experience, the evidence, and the deeper story function involved.</p>
          </div>
          <div className={styles.lensGrid}>
            <LensCard
              number="01"
              title="Story question"
              question="Is the central dramatic question established early enough, kept alive, and answered through consequence?"
              evidence={project.story.dramaticQuestion || "The dramatic question is not yet defined."}
            />
            <LensCard
              number="02"
              title="Character engine"
              question="Does the journey confront the character's controlling belief, avoidance pattern, or false solution?"
              evidence={characterEvidence}
            />
            <LensCard
              number="03"
              title="Structure and pattern"
              question="Do cause, choice, escalation, repetition and surprise create forward movement rather than mechanical plot points?"
              evidence={blockEvidence || "Add goal, conflict, choice or action, and consequence to this block."}
            />
            <LensCard
              number="04"
              title="Page experience"
              question="Is the action clear and compelling? Does each page create a reason to continue rather than merely transmit information?"
              evidence={selectedBlock.scriptExcerpt || "No page draft has been recorded for this block."}
            />
            <LensCard
              number="05"
              title="Dialogue and exposition"
              question="Do characters speak from distinct viewpoints while information enters through desire, pressure, status, humour, or action?"
              evidence={selectedCharacter?.voice || project.development.dialogue.principles || "No dialogue rule has been recorded yet."}
            />
            <LensCard
              number="06"
              title="Surprise and specificity"
              question="Does the story travel an earned but unexpected route, or is it repeating familiar territory without a distinctive turn?"
              evidence={selectedBlock.pickleTurn || selectedBlock.audienceExpectation || project.development.pickle.unpredictableRoute || "No audience reframe has been recorded."}
            />
          </div>
        </section>

        <div className={styles.workspace}>
          <section className={styles.blockPanel}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>Block {selectedBlock.number} · {selectedBlock.title}</p>
              <h2>Separate the visible symptom from the root cause.</h2>
              <p>{blockEvidence || "Complete the block cause-and-effect spine before diagnosing the scene."}</p>
            </div>
            <Field
              label="Block review note"
              help="Describe the reader experience and cite the story evidence. Ask what may be causing it before prescribing a rewrite. This edits the block's shared notes."
              value={selectedBlock.notes}
              onChange={updateBlockNote}
              rows={13}
            />
            <div className={styles.evidenceCards}>
              <article><span>PageFlow draft</span><p>{selectedBlock.scriptExcerpt || "No page text recorded."}</p></article>
              <article><span>Visible sequence</span><p>{selectedBlock.storyboardDirection || "No visual sequence recorded."}</p></article>
              <article><span>Audience turn</span><p>{selectedBlock.pickleTurn || selectedBlock.audienceExpectation || "No audience turn recorded."}</p></article>
            </div>
          </section>

          <aside className={styles.characterPanel}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>Selected character</p>
              <h2>{selectedCharacter?.name ?? "No character selected"}</h2>
              <p>The plot should challenge the character's current strategy, not merely move them between events.</p>
            </div>
            {selectedCharacter ? (
              <div className={styles.characterGrid}>
                <article><span>Want</span><p>{selectedCharacter.want || "Not defined"}</p></article>
                <article><span>Need</span><p>{selectedCharacter.need || "Not defined"}</p></article>
                <article><span>Ghost</span><p>{selectedCharacter.ghost || "Not defined"}</p></article>
                <article><span>Fatal flaw</span><p>{selectedCharacter.fatalFlaw || "Not defined"}</p></article>
                <article><span>Arc</span><p>{selectedCharacter.arc || "Not defined"}</p></article>
              </div>
            ) : <p className={styles.empty}>Add characters in Story Planner to inspect the character journey.</p>}
          </aside>
        </div>

        <section className={styles.rootNotePanel}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>The note beneath the note</p>
            <h2>Diagnose broadly; revise specifically.</h2>
            <p>
              A weak moment may be a symptom of an earlier setup, unclear objective, missing consequence, inconsistent worldview,
              or delayed story question. Preserve multiple possible solutions until the root problem is understood.
            </p>
          </div>
          <div className={styles.twoColumns}>
            <Field
              label="Root diagnosis and revision priorities"
              help="Name what appears to be structurally wrong, why it matters, and what must improve. Avoid locking the writer into one proposed fix."
              value={project.development.notes.revisions}
              onChange={(value) => updateNote("revisions", value)}
              rows={11}
            />
            <Field
              label="Questions for the next draft"
              help="Use precise questions that expose uncertainty: What does the character want here? What changes? Why now? What evidence earns the turn?"
              value={project.development.notes.openQuestions}
              onChange={(value) => updateNote("openQuestions", value)}
              rows={11}
            />
            <Field
              label="Continuity and evidence log"
              help="Record page, block, character, object, location, setup, payoff, or behaviour evidence supporting the diagnosis."
              value={project.development.notes.continuity}
              onChange={(value) => updateNote("continuity", value)}
              rows={9}
            />
            <Field
              label="Comparisons and research"
              help="Record useful craft references or comparable patterns without turning them into instructions to imitate another story."
              value={project.development.notes.research}
              onChange={(value) => updateNote("research", value)}
              rows={9}
            />
            <Field
              label="Feedback sources"
              help="Identify readers, dates, drafts, table reads, observations, or testing conditions so repeated notes can be compared in context."
              value={project.development.notes.sources}
              onChange={(value) => updateNote("sources", value)}
              rows={8}
            />
          </div>
        </section>

        <section className={styles.protocolPanel}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Notes protocol</p>
            <h2>Serve the story without taking ownership away from the writer.</h2>
          </div>
          <ol>
            <li><strong>Observe first.</strong><span>Describe the experience before interpreting it.</span></li>
            <li><strong>Be script-specific.</strong><span>Generic advice is weaker than evidence tied to these characters and this story.</span></li>
            <li><strong>Trace the root.</strong><span>A confusing moment may begin several blocks earlier.</span></li>
            <li><strong>Diagnose before prescribing.</strong><span>State what is not working and why; preserve more than one solution.</span></li>
            <li><strong>Ask useful questions.</strong><span>A precise question can unlock a stronger answer than a replacement scene.</span></li>
            <li><strong>Cool down.</strong><span>When receiving difficult feedback, separate the emotional reaction from the possible truth inside the note.</span></li>
          </ol>
        </section>

        <p className={styles.status} aria-live="polite">{hydrated ? status : "Loading the active PlotPickle project…"}</p>
      </div>
    </main>
  );
}
