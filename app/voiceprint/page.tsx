"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addBlankCharacter,
  createBlankProject,
  normalizePlotPickleProject,
  type Character,
  type PlotPickleProject,
} from "@/lib/project";
import styles from "./voiceprint.module.css";

const STORAGE_KEY = "plotpickle.project.v1";

type VoiceFieldKey =
  | "originEnvironment"
  | "socialContext"
  | "educationExpertise"
  | "worldviewBoundaries"
  | "rhythmSentenceShape"
  | "vocabularyMetaphors"
  | "verbalFingerprints"
  | "emotionalAccess"
  | "statusShift"
  | "persuasionStrategy";

type DialogueFieldKey =
  | "principles"
  | "voiceContrast"
  | "worldVernacular"
  | "monologueRules"
  | "subtext"
  | "subtextSeeds"
  | "expositionRules"
  | "recurringLanguage"
  | "fieldworkNotes"
  | "notes";

const voiceFields: Array<{ key: VoiceFieldKey; label: string; help: string }> = [
  { key: "originEnvironment", label: "Origin & environment", help: "Geography, community, family, work, culture, and formative surroundings." },
  { key: "socialContext", label: "Social context & status", help: "Class, money, institutions, belonging, exclusion, and perceived rank." },
  { key: "educationExpertise", label: "Education & expertise", help: "Formal learning, practical knowledge, professional language, and blind spots." },
  { key: "worldviewBoundaries", label: "Worldview & boundaries", help: "Beliefs, loyalties, assumptions, taboos, and subjects they avoid." },
  { key: "rhythmSentenceShape", label: "Rhythm & sentence shape", help: "Speed, sentence length, directness, interruption, and structural habits." },
  { key: "vocabularyMetaphors", label: "Vocabulary & metaphors", help: "Preferred words, references, comparisons, slang, and areas of fluency." },
  { key: "verbalFingerprints", label: "Verbal fingerprints", help: "Repeated connectors, fillers, corrections, jokes, deflections, and signature phrasing." },
  { key: "emotionalAccess", label: "Emotional access", help: "What can be said plainly, what is disguised, and what cannot be admitted." },
  { key: "statusShift", label: "Status & relationship shift", help: "How speech changes with authority, intimacy, fear, attraction, rivalry, or dependence." },
  { key: "persuasionStrategy", label: "Persuasion strategy", help: "How they ask, pressure, charm, bargain, threaten, prove, or avoid." },
];

const dialogueFields: Array<{ key: DialogueFieldKey; label: string; help: string }> = [
  { key: "principles", label: "Dialogue principles", help: "The project-wide rules that keep dialogue active, specific, and character-led." },
  { key: "voiceContrast", label: "Voice contrast", help: "The clearest differences in rhythm, vocabulary, status, and emotional access across the cast." },
  { key: "worldVernacular", label: "World vernacular", help: "Shared slang, technical language, rituals, forms of address, and genre-specific speech rules." },
  { key: "monologueRules", label: "Monologue rules", help: "When a long speech is earned and what it must persuade, defend, reveal, or change." },
  { key: "subtext", label: "Subtext strategy", help: "What characters conceal, avoid, redirect, or communicate indirectly." },
  { key: "subtextSeeds", label: "Subtext seeds", help: "Objects, actions, repeated words, and callbacks that accumulate emotional meaning." },
  { key: "expositionRules", label: "Exposition rules", help: "How necessary information enters through conflict, desire, humour, urgency, or action." },
  { key: "recurringLanguage", label: "Recurring language & motifs", help: "Words and images that can return with changing meaning." },
  { key: "fieldworkNotes", label: "Observation library", help: "Original notes on rhythm, hesitation, repetition, topic changes, and status shifts." },
  { key: "notes", label: "Dialogue notes", help: "Open questions, revision reminders, and scene-specific discoveries." },
];

function Field({ label, help, value, onChange }: { label: string; help: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
      <small className={styles.help}>{help}</small>
    </label>
  );
}

export default function VoiceprintPage() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState("Loading the active PlotPickle project…");

  useEffect(() => {
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
        setStatus("No saved project was found. Add a character here or open PlotPickle first.");
      }
    } catch {
      setStatus("The saved project could not be opened. A blank project is shown instead.");
    } finally {
      setHydrated(true);
    }
  }, []);

  const selectedCharacter = useMemo(
    () => project.characters.find((character) => character.id === selectedCharacterId) ?? project.characters[0],
    [project.characters, selectedCharacterId],
  );
  const selectedBlock = project.blocks.find((block) => block.number === selectedBlockNumber) ?? project.blocks[0];
  const relationshipSummary = selectedCharacter?.relationships
    .map((relationship) => {
      const other = project.characters.find((character) => character.id === relationship.characterId);
      return `${other?.name ?? relationship.characterId}: ${relationship.label}${relationship.description ? ` — ${relationship.description}` : ""}`;
    })
    .join("\n");

  function commit(next: PlotPickleProject, message = "Saved to this device.") {
    const updated: PlotPickleProject = {
      ...next,
      metadata: { ...next.metadata, updatedAt: new Date().toISOString() },
    };
    setProject(updated);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setStatus(message);
  }

  function updateCharacter(key: VoiceFieldKey | "voice", value: string) {
    if (!selectedCharacter) return;
    commit({
      ...project,
      characters: project.characters.map((character) =>
        character.id === selectedCharacter.id ? { ...character, [key]: value } : character,
      ),
    });
  }

  function updateDialogue(key: DialogueFieldKey, value: string) {
    commit({
      ...project,
      development: {
        ...project.development,
        dialogue: { ...project.development.dialogue, [key]: value },
      },
    });
  }

  function addCharacter() {
    const next = addBlankCharacter(project);
    const created = next.characters[next.characters.length - 1];
    commit(next, "New character added to the active project.");
    setSelectedCharacterId(created.id);
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
    setStatus("Project exported with its Voiceprint Engine data.");
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>PlotPickle Playhouse · Dialogue workspace</p>
            <h1>Voiceprint Engine</h1>
            <p>
              Build dialogue from who formed the speaker, who they are addressing, what they want, and how pressure changes their language.
              The same project file remains connected to Characters, Relationships, 24 Blocks, and the Visual Board.
            </p>
          </div>
          <div className={styles.actions}>
            <a className={styles.secondaryButton} href="/">Back to PlotPickle</a>
            <button className={styles.secondaryButton} type="button" onClick={addCharacter}>Add character</button>
            <button className={styles.button} type="button" onClick={exportProject}>Export project</button>
          </div>
        </header>

        <section className={styles.projectBar}>
          <div className={styles.projectTitle}>
            <strong>{project.metadata.title}</strong>
            <span>Project schema {project.schemaVersion} · {project.metadata.status}</span>
          </div>
          <label className={styles.selectLabel}>
            <span>Character voiceprint</span>
            <select value={selectedCharacter?.id ?? ""} onChange={(event) => setSelectedCharacterId(event.target.value)} disabled={!project.characters.length}>
              {project.characters.map((character) => <option value={character.id} key={character.id}>{character.name} · {character.role}</option>)}
            </select>
          </label>
          <label className={styles.selectLabel}>
            <span>Scene pressure reference</span>
            <select value={selectedBlock.number} onChange={(event) => setSelectedBlockNumber(Number(event.target.value))}>
              {project.blocks.map((block) => <option value={block.number} key={block.id}>Block {block.number}: {block.title}</option>)}
            </select>
          </label>
        </section>

        <section className={styles.sceneTest} aria-label="Voiceprint scene test">
          <article className={styles.contextCard}>
            <strong>Who is speaking?</strong>
            <span>Identity and internal strategy</span>
            <p>{selectedCharacter ? `${selectedCharacter.name} wants ${selectedCharacter.want || "an unresolved objective"}. ${selectedCharacter.voice || "Add a compact voice rule below."}` : "Add a character to begin."}</p>
          </article>
          <article className={styles.contextCard}>
            <strong>What is the pressure?</strong>
            <span>Block {selectedBlock.number} · goal versus resistance</span>
            <p>{[selectedBlock.goal, selectedBlock.conflict, selectedBlock.emotionalTurn].filter(Boolean).join(" · ") || "Add the block goal, conflict, and emotional turn in Story Planner."}</p>
          </article>
          <article className={styles.contextCard}>
            <strong>Who changes the voice?</strong>
            <span>Relationship and status shift</span>
            <p>{relationshipSummary || "Add relationships in the character profile, then describe how authority, intimacy, fear, or dependence changes the voice."}</p>
          </article>
        </section>

        <div className={styles.workspace}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <p className={styles.kicker}>Shared story language</p>
              <h2>Project dialogue system</h2>
              <p>Define what every scene inherits without making every character sound alike.</p>
            </div>
            <div className={styles.fieldGrid}>
              {dialogueFields.map((field) => (
                <Field
                  key={field.key}
                  label={field.label}
                  help={field.help}
                  value={project.development.dialogue[field.key] ?? ""}
                  onChange={(value) => updateDialogue(field.key, value)}
                />
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <p className={styles.kicker}>Character-specific language</p>
              <h2>{selectedCharacter ? `${selectedCharacter.name}'s voiceprint` : "Character voiceprint"}</h2>
              <p>Build a repeatable pattern, then let relationship and pressure create believable variations.</p>
            </div>
            {selectedCharacter ? (
              <div className={styles.fieldGrid}>
                <div className={styles.fullWidth}>
                  <Field
                    label="Compact voice rule"
                    help="One sentence that can guide every scene: rhythm, emotional access, and default strategy."
                    value={selectedCharacter.voice}
                    onChange={(value) => updateCharacter("voice", value)}
                  />
                </div>
                {voiceFields.map((field) => (
                  <Field
                    key={field.key}
                    label={field.label}
                    help={field.help}
                    value={(selectedCharacter[field.key] as string | undefined) ?? ""}
                    onChange={(value) => updateCharacter(field.key, value)}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <p>Your project has no characters yet.</p>
                <button className={styles.button} type="button" onClick={addCharacter}>Create the first character</button>
              </div>
            )}
          </section>
        </div>

        <p className={styles.status} aria-live="polite">{hydrated ? status : "Loading the active PlotPickle project…"}</p>
      </div>
    </main>
  );
}
