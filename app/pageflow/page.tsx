"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createBlankProject, normalizePlotPickleProject, type PlotPickleProject, type StoryBlock } from "@/lib/project";
import { scanPageFlowDraft } from "@/lib/pageflow";
import styles from "./pageflow.module.css";

const STORAGE_KEY = "plotpickle.project.v1";

function DraftField({
  label,
  help,
  value,
  onChange,
  rows = 8,
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

function SignalList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <article className={styles.signalCard}>
      <strong>{title}</strong>
      {items.length ? (
        <div className={styles.chips}>{items.map((item) => <span key={item}>{item}</span>)}</div>
      ) : (
        <p>{empty}</p>
      )}
    </article>
  );
}

export default function PageFlowPage() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(1);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState("Loading the active PlotPickle project…");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const normalized = normalizePlotPickleProject(JSON.parse(stored));
          if (normalized) {
            setProject(normalized);
            setSelectedCharacterId(normalized.characters[0]?.id ?? "");
            setStatus("Connected to the active PlotPickle project.");
          } else {
            setStatus("The saved project could not be upgraded. A blank project is shown instead.");
          }
        } else {
          setStatus("No saved project was found. Open PlotPickle or begin with the blank project shown here.");
        }
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
  const draftScan = useMemo(() => scanPageFlowDraft(selectedBlock.scriptExcerpt), [selectedBlock.scriptExcerpt]);

  function commit(next: PlotPickleProject, message = "Saved to this device.") {
    const updated: PlotPickleProject = {
      ...next,
      metadata: { ...next.metadata, updatedAt: new Date().toISOString() },
    };
    setProject(updated);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setStatus(message);
  }

  function updateBlock(key: keyof StoryBlock, value: string) {
    commit({
      ...project,
      blocks: project.blocks.map((block) =>
        block.number === selectedBlock.number ? { ...block, [key]: value } : block,
      ),
    });
  }

  function updateCharacterDescription(value: string) {
    if (!selectedCharacter) return;
    commit({
      ...project,
      characters: project.characters.map((character) =>
        character.id === selectedCharacter.id ? { ...character, description: value } : character,
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
    setStatus("Project exported with the current PageFlow revisions.");
  }

  const blockContext = [selectedBlock.goal, selectedBlock.conflict, selectedBlock.action, selectedBlock.consequence]
    .filter(Boolean)
    .join(" → ");

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>PlotPickle Playhouse · Screen description workspace</p>
            <h1>PageFlow Engine</h1>
            <p>
              Turn a planned block into visible, active, actor-playable screenplay description. The Page Draft, visual sequence,
              character entrance, notes, and Visual Board remain attached to the same PlotPickle project.
            </p>
          </div>
          <div className={styles.actions}>
            <Link className={styles.secondaryButton} href="/">Back to PlotPickle</Link>
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
            <span>PageFlow block</span>
            <select value={selectedBlock.number} onChange={(event) => setSelectedBlockNumber(Number(event.target.value))}>
              {project.blocks.map((block) => <option value={block.number} key={block.id}>Block {block.number}: {block.title}</option>)}
            </select>
          </label>
          <label>
            <span>Character entrance</span>
            <select value={selectedCharacter?.id ?? ""} onChange={(event) => setSelectedCharacterId(event.target.value)} disabled={!project.characters.length}>
              {project.characters.map((character) => <option value={character.id} key={character.id}>{character.name} · {character.role}</option>)}
            </select>
          </label>
        </section>

        <section className={styles.contextGrid}>
          <article><strong>Story cause</strong><span>Why the block moves</span><p>{blockContext || "Add the goal, conflict, action, and consequence in Story Planner."}</p></article>
          <article><strong>Emotional turn</strong><span>Meaning that needs screen evidence</span><p>{selectedBlock.emotionalTurn || "Name the emotional change, then express it through behaviour, space, objects, dialogue, or reaction."}</p></article>
          <article><strong>Audience attention</strong><span>What the reader should track</span><p>{selectedBlock.audienceExpectation || selectedBlock.pickleTurn || "Clarify what the audience expects and what changes that expectation."}</p></article>
        </section>

        <section className={styles.scorePanel} aria-label="PageFlow draft signals">
          <div className={styles.scoreRing} style={{ "--score": `${draftScan.signal * 3.6}deg` } as React.CSSProperties}>
            <strong>{draftScan.signal}</strong><span>draft signal</span>
          </div>
          <div className={styles.metricGrid}>
            <div><strong>{draftScan.words}</strong><span>action words</span></div>
            <div><strong>{draftScan.paragraphs}</strong><span>visual beats</span></div>
            <div><strong>{draftScan.averageSentence}</strong><span>words per sentence</span></div>
            <div><strong>{draftScan.longParagraphs}</strong><span>dense paragraphs</span></div>
          </div>
          <p>This is an editorial signal, not a grade. Dialogue and character cues are excluded where screenplay formatting makes them identifiable.</p>
        </section>

        <div className={styles.workspace}>
          <section className={styles.draftPanel}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>Block {selectedBlock.number} · {selectedBlock.title}</p>
              <h2>Write the movie the reader can see.</h2>
              <p>Use exact nouns, active verbs, clear order, playable behaviour, and paragraph breaks that match visual turns.</p>
            </div>
            <DraftField label="Page Draft" help="Screenplay action, scene text, or a polished description pass. This edits the block's shared Story text field." value={selectedBlock.scriptExcerpt} onChange={(value) => updateBlock("scriptExcerpt", value)} rows={22} />
            <div className={styles.twoColumns}>
              <DraftField label="Visible sequence" help="Describe the image progression the Visual Board should preserve." value={selectedBlock.storyboardDirection} onChange={(value) => updateBlock("storyboardDirection", value)} rows={9} />
              <DraftField label="PageFlow revision notes" help="Record invisible information to externalize, beats to split, actions to sharpen, or justified exceptions." value={selectedBlock.notes} onChange={(value) => updateBlock("notes", value)} rows={9} />
            </div>
            <div className={styles.entrancePanel}>
              <div>
                <p className={styles.kicker}>Character entrance in motion</p>
                <h3>{selectedCharacter ? selectedCharacter.name : "No character selected"}</h3>
                <p>Give the reader a concise first impression through condition, action, contradiction, clothing, or relationship to the space.</p>
              </div>
              {selectedCharacter ? (
                <DraftField label={`${selectedCharacter.name} · Introduction`} help="This edits the character's shared description, so keep it useful beyond a single scene." value={selectedCharacter.description} onChange={updateCharacterDescription} rows={7} />
              ) : <p className={styles.empty}>Add characters in Story Planner to develop an entrance.</p>}
            </div>
          </section>

          <aside className={styles.diagnosticPanel}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>Revision signals</p><h2>Inspect, do not obey blindly.</h2><p>Each signal asks whether the action line has become visible, direct, playable, and readable.</p>
            </div>
            <SignalList title="Invisible or explanatory" items={draftScan.invisible} empty="No common invisible-state terms detected in action text." />
            <SignalList title="Possible directing language" items={draftScan.directing} empty="No common camera or editing terms detected in action text." />
            <SignalList title="Weak action phrases" items={draftScan.weak} empty="No common delayed-action phrases detected in action text." />
            <SignalList title="Emotion labels to physicalize" items={draftScan.emotions} empty="No common emotion labels detected in action text." />
            <div className={styles.checklist}>
              <h3>Five-pass rewrite</h3>
              <ol>
                <li><strong>Screen pass</strong><span>Can the audience see or hear every essential idea?</span></li>
                <li><strong>Verb pass</strong><span>Can one exact action replace a weak phrase or explanation?</span></li>
                <li><strong>Actor pass</strong><span>Does the character have behaviour to play rather than an emotion to imitate?</span></li>
                <li><strong>Rhythm pass</strong><span>Does each paragraph contain one primary visual beat?</span></li>
                <li><strong>Restraint pass</strong><span>Are you guiding attention without directing every shot?</span></li>
              </ol>
            </div>
            <div className={styles.wordBank}>
              <h3>Action families</h3><p>Use these as prompts for specificity, not as mandatory vocabulary.</p>
              <div><span>advance</span><span>withdraw</span><span>block</span><span>grip</span><span>scan</span><span>flinch</span><span>crumple</span><span>snap</span><span>hover</span><span>brace</span><span>corner</span><span>release</span></div>
            </div>
          </aside>
        </div>

        <p className={styles.status} aria-live="polite">{hydrated ? status : "Loading the active PlotPickle project…"}</p>
      </div>
    </main>
  );
}
