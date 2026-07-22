"use client";

import { useMemo, useState } from "react";
import {
  createBlankArcMatrix,
  type AiProvenanceRecord,
  type CharacterArcCheckpoint,
  type PlotPickleProject,
  type RightsCollaborator,
  type SourceAttribution,
  type StoryThread,
  type StoryThreadMilestone,
} from "@/lib/project";
import { compareRevisionSnapshots, createRevisionSnapshot, createStoryThread, restoreRevisionSnapshot, synchronizeThreadSceneLinks } from "@/lib/core-model";
import styles from "./core-model-studio.module.css";

type Section = "threads" | "arcs" | "rights" | "revisions";
type Props = { project: PlotPickleProject; onChange: (project: PlotPickleProject) => void; compact?: boolean; initialSection?: Section };

const threadKinds: StoryThread["kind"][] = ["main", "subplot", "relationship", "mystery", "theme", "world"];
const threadStatuses: StoryThread["status"][] = ["planned", "active", "paused", "resolved", "abandoned"];
const milestoneKinds: StoryThreadMilestone["kind"][] = ["setup", "development", "turn", "reveal", "payoff", "resolution"];
const checkpointKinds: CharacterArcCheckpoint["kind"][] = ["opening", "catalyst", "threshold", "midpoint", "crisis", "climax", "ending", "custom"];
const sourceTypes: SourceAttribution["sourceType"][] = ["research", "quotation", "adaptation", "public-domain", "licensed-material", "other"];
const aiOperations: AiProvenanceRecord["operation"][] = ["brainstorm", "rewrite", "analysis", "dialogue", "image", "audio", "video", "other"];

function id(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ? `${prefix}-${globalThis.crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function TextField({ label, value, onChange, rows = 3, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; rows?: number; placeholder?: string }) {
  return <label className={styles.field}><span>{label}</span>{rows === 1 ? <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /> : <textarea rows={rows} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}</label>;
}

export default function CoreModelStudio({ project, onChange, compact = false, initialSection = "threads" }: Props) {
  const [section, setSection] = useState<Section>(initialSection);
  const [threadId, setThreadId] = useState(project.storyThreads[0]?.id ?? "");
  const [characterId, setCharacterId] = useState(project.characters[0]?.id ?? "");
  const [revisionLabel, setRevisionLabel] = useState("");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [leftRevisionId, setLeftRevisionId] = useState(project.revisions[0]?.id ?? "");
  const [rightRevisionId, setRightRevisionId] = useState(project.revisions.at(-1)?.id ?? "");

  const thread = project.storyThreads.find((item) => item.id === threadId) ?? project.storyThreads[0];
  const character = project.characters.find((item) => item.id === characterId) ?? project.characters[0];
  const scenes = useMemo(() => project.blocks.flatMap((block) => block.scenes.map((scene) => ({ ...scene, blockNumber: block.number, blockTitle: block.title }))), [project.blocks]);
  const leftRevision = project.revisions.find((item) => item.id === leftRevisionId);
  const rightRevision = project.revisions.find((item) => item.id === rightRevisionId);

  function save(next: PlotPickleProject) {
    onChange(synchronizeThreadSceneLinks({ ...next, metadata: { ...next.metadata, updatedAt: new Date().toISOString() } }));
  }

  function addThread() {
    const next = createStoryThread(project);
    save(next);
    setThreadId(next.storyThreads.at(-1)?.id ?? "");
  }

  function updateThread(patch: Partial<StoryThread>) {
    if (!thread) return;
    save({ ...project, storyThreads: project.storyThreads.map((item) => item.id === thread.id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item) });
  }

  function toggleThreadReference(kind: "characterIds" | "sceneIds", value: string) {
    if (!thread) return;
    const current = thread[kind];
    updateThread({ [kind]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] });
  }

  function addMilestone() {
    if (!thread) return;
    const first = scenes[0];
    const milestone: StoryThreadMilestone = { id: id("thread-milestone"), sceneId: first?.id ?? "", blockNumber: first?.blockNumber ?? 1, kind: "development", summary: "", resolved: false };
    updateThread({ milestones: [...thread.milestones, milestone] });
  }

  function updateMilestone(milestoneId: string, patch: Partial<StoryThreadMilestone>) {
    if (!thread) return;
    updateThread({ milestones: thread.milestones.map((item) => item.id === milestoneId ? { ...item, ...patch } : item) });
  }

  function updateArc(key: keyof ReturnType<typeof createBlankArcMatrix>, value: string) {
    if (!character || key === "checkpoints") return;
    const matrix = character.arcMatrix ?? createBlankArcMatrix(character);
    save({ ...project, characters: project.characters.map((item) => item.id === character.id ? { ...item, arcMatrix: { ...matrix, [key]: value } } : item) });
  }

  function addCheckpoint() {
    if (!character) return;
    const matrix = character.arcMatrix ?? createBlankArcMatrix(character);
    const checkpoint: CharacterArcCheckpoint = { id: id("arc-checkpoint"), kind: "custom", blockNumber: 1, sceneId: "", belief: "", strategy: "", pressure: "", choice: "", consequence: "", evidence: "" };
    save({ ...project, characters: project.characters.map((item) => item.id === character.id ? { ...item, arcMatrix: { ...matrix, checkpoints: [...matrix.checkpoints, checkpoint] } } : item) });
  }

  function updateCheckpoint(checkpointId: string, patch: Partial<CharacterArcCheckpoint>) {
    if (!character) return;
    const matrix = character.arcMatrix ?? createBlankArcMatrix(character);
    save({ ...project, characters: project.characters.map((item) => item.id === character.id ? { ...item, arcMatrix: { ...matrix, checkpoints: matrix.checkpoints.map((checkpoint) => checkpoint.id === checkpointId ? { ...checkpoint, ...patch } : checkpoint) } } : item) });
  }

  function updateRights<K extends keyof PlotPickleProject["rights"]>(key: K, value: PlotPickleProject["rights"][K]) {
    save({ ...project, rights: { ...project.rights, [key]: value } });
  }

  function addCollaborator() {
    const now = new Date().toISOString();
    const collaborator: RightsCollaborator = { id: id("collaborator"), name: "", role: "", contribution: "", ownershipShare: "", agreementReference: "", creditedAs: "", createdAt: now, updatedAt: now };
    updateRights("collaborators", [...project.rights.collaborators, collaborator]);
  }

  function addAttribution() {
    const attribution: SourceAttribution = { id: id("attribution"), title: "", creator: "", sourceType: "research", sourceUrl: "", licence: "", permissionReference: "", notes: "", attachedTo: [], createdAt: new Date().toISOString() };
    updateRights("attributions", [...project.rights.attributions, attribution]);
  }

  function addAiRecord() {
    const record: AiProvenanceRecord = { id: id("ai-provenance"), provider: "", model: "", operation: "other", promptSummary: "", outputSummary: "", humanContribution: "", humanDecision: "", retained: false, attachedTo: [], createdAt: new Date().toISOString() };
    updateRights("aiProvenance", [...project.rights.aiProvenance, record]);
  }

  function createSnapshot() {
    const next = createRevisionSnapshot(project, revisionLabel, revisionNotes);
    save(next);
    const created = next.revisions.at(-1);
    setRevisionLabel("");
    setRevisionNotes("");
    if (created) {
      setLeftRevisionId(leftRevisionId || created.id);
      setRightRevisionId(created.id);
    }
  }

  return <div className={`${styles.studio} ${compact ? styles.compact : ""}`}>
    <header className={styles.header}><div><p>Phase A · Canonical project model</p><h2>Story Threads, Character Arcs, Rights and Revisions</h2><span>Every record is saved inside the active schema 1.7 project and travels with import and export.</span></div><strong>Schema {project.schemaVersion}</strong></header>
    <nav className={styles.tabs} aria-label="Core model sections">
      <button className={section === "threads" ? styles.active : ""} onClick={() => setSection("threads")}>Story Threads <small>{project.storyThreads.length}</small></button>
      <button className={section === "arcs" ? styles.active : ""} onClick={() => setSection("arcs")}>Arc Matrix <small>{project.characters.length}</small></button>
      <button className={section === "rights" ? styles.active : ""} onClick={() => setSection("rights")}>Rights & Provenance <small>{project.rights.attributions.length + project.rights.aiProvenance.length}</small></button>
      <button className={section === "revisions" ? styles.active : ""} onClick={() => setSection("revisions")}>Revisions <small>{project.revisions.length}</small></button>
    </nav>

    {section === "threads" ? <section className={styles.section}>
      <div className={styles.split}><aside className={styles.list}><button className={styles.add} onClick={addThread}>Add Story Thread</button>{project.storyThreads.map((item) => <button className={item.id === thread?.id ? styles.selected : ""} key={item.id} onClick={() => setThreadId(item.id)}><strong>{item.name}</strong><span>{item.kind} · {item.status}</span></button>)}{!project.storyThreads.length ? <p>No threads yet. Add the main plot, subplot, relationship, mystery, theme or world pressure.</p> : null}</aside>
      {thread ? <div className={styles.editor}><div className={styles.grid}><TextField label="Thread name" rows={1} value={thread.name} onChange={(name) => updateThread({ name })} /><label className={styles.field}><span>Kind</span><select value={thread.kind} onChange={(event) => updateThread({ kind: event.target.value as StoryThread["kind"] })}>{threadKinds.map((kind) => <option key={kind}>{kind}</option>)}</select></label><label className={styles.field}><span>Status</span><select value={thread.status} onChange={(event) => updateThread({ status: event.target.value as StoryThread["status"] })}>{threadStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><TextField label="Dramatic question" value={thread.question} onChange={(question) => updateThread({ question })} /><TextField label="Summary" value={thread.summary} onChange={(summary) => updateThread({ summary })} /><TextField label="Notes" value={thread.notes} onChange={(notes) => updateThread({ notes })} /></div>
      <div className={styles.reference}><h3>Participating characters</h3>{project.characters.map((item) => <label key={item.id}><input type="checkbox" checked={thread.characterIds.includes(item.id)} onChange={() => toggleThreadReference("characterIds", item.id)} />{item.name}</label>)}</div>
      <div className={styles.reference}><h3>Linked scenes</h3><div className={styles.sceneList}>{scenes.map((item) => <label key={item.id}><input type="checkbox" checked={thread.sceneIds.includes(item.id)} onChange={() => toggleThreadReference("sceneIds", item.id)} /><span>Block {item.blockNumber} · Scene {item.number}</span><strong>{item.title}</strong></label>)}</div></div>
      <div className={styles.collection}><header><h3>Milestones</h3><button onClick={addMilestone}>Add milestone</button></header>{thread.milestones.map((milestone) => <article key={milestone.id}><label><span>Kind</span><select value={milestone.kind} onChange={(event) => updateMilestone(milestone.id, { kind: event.target.value as StoryThreadMilestone["kind"] })}>{milestoneKinds.map((kind) => <option key={kind}>{kind}</option>)}</select></label><label><span>Scene</span><select value={milestone.sceneId} onChange={(event) => { const selected = scenes.find((item) => item.id === event.target.value); updateMilestone(milestone.id, { sceneId: event.target.value, blockNumber: selected?.blockNumber ?? 1 }); }}>{scenes.map((item) => <option key={item.id} value={item.id}>B{item.blockNumber} · S{item.number} · {item.title}</option>)}</select></label><TextField label="Milestone summary" value={milestone.summary} onChange={(summary) => updateMilestone(milestone.id, { summary })} /><label className={styles.check}><input type="checkbox" checked={milestone.resolved} onChange={(event) => updateMilestone(milestone.id, { resolved: event.target.checked })} />Resolved</label><button className={styles.remove} onClick={() => updateThread({ milestones: thread.milestones.filter((item) => item.id !== milestone.id) })}>Remove</button></article>)}</div>
      <button className={styles.danger} onClick={() => { save({ ...project, storyThreads: project.storyThreads.filter((item) => item.id !== thread.id) }); setThreadId(""); }}>Delete thread</button></div> : null}</div>
    </section> : null}

    {section === "arcs" ? <section className={styles.section}>{character ? <><label className={styles.characterSelect}><span>Character</span><select value={character.id} onChange={(event) => setCharacterId(event.target.value)}>{project.characters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className={styles.grid}>{([ ["startingState", "Starting state"], ["consciousWant", "Conscious want"], ["underlyingNeed", "Underlying need"], ["protectiveLie", "Protective lie"], ["emergingTruth", "Emerging truth"], ["midpointShift", "Midpoint shift"], ["crisisChoice", "Crisis choice"], ["climaxChoice", "Climax choice"], ["endingState", "Ending state"], ["relationshipImpact", "Relationship impact"] ] as const).map(([key, label]) => <TextField key={key} label={label} value={(character.arcMatrix ?? createBlankArcMatrix(character))[key]} onChange={(value) => updateArc(key, value)} />)}</div><div className={styles.collection}><header><h3>Scene and block checkpoints</h3><button onClick={addCheckpoint}>Add checkpoint</button></header>{(character.arcMatrix ?? createBlankArcMatrix(character)).checkpoints.map((checkpoint) => <article key={checkpoint.id}><label><span>Kind</span><select value={checkpoint.kind} onChange={(event) => updateCheckpoint(checkpoint.id, { kind: event.target.value as CharacterArcCheckpoint["kind"] })}>{checkpointKinds.map((kind) => <option key={kind}>{kind}</option>)}</select></label><label><span>Block</span><input type="number" min="1" max="24" value={checkpoint.blockNumber ?? ""} onChange={(event) => updateCheckpoint(checkpoint.id, { blockNumber: event.target.value ? Number(event.target.value) : null })} /></label><label><span>Scene</span><select value={checkpoint.sceneId} onChange={(event) => updateCheckpoint(checkpoint.id, { sceneId: event.target.value })}><option value="">No scene selected</option>{scenes.map((item) => <option key={item.id} value={item.id}>B{item.blockNumber} · {item.title}</option>)}</select></label>{(["belief", "strategy", "pressure", "choice", "consequence", "evidence"] as const).map((key) => <TextField key={key} label={key[0].toUpperCase() + key.slice(1)} value={checkpoint[key]} onChange={(value) => updateCheckpoint(checkpoint.id, { [key]: value })} />)}<button className={styles.remove} onClick={() => { const matrix = character.arcMatrix ?? createBlankArcMatrix(character); save({ ...project, characters: project.characters.map((item) => item.id === character.id ? { ...item, arcMatrix: { ...matrix, checkpoints: matrix.checkpoints.filter((entry) => entry.id !== checkpoint.id) } } : item) }); }}>Remove</button></article>)}</div></> : <p>Add a character in Story Planner to begin an Arc Matrix.</p>}</section> : null}

    {section === "rights" ? <section className={styles.section}><div className={styles.grid}><TextField label="Project owner" rows={1} value={project.rights.projectOwner} onChange={(value) => updateRights("projectOwner", value)} /><TextField label="Copyright notice" rows={1} value={project.rights.copyrightNotice} onChange={(value) => updateRights("copyrightNotice", value)} /><TextField label="Rights statement" value={project.rights.rightsStatement} onChange={(value) => updateRights("rightsStatement", value)} /><TextField label="Default creative licence" rows={1} value={project.rights.defaultCreativeLicence} onChange={(value) => updateRights("defaultCreativeLicence", value)} /><TextField label="Source work title" rows={1} value={project.rights.sourceWorkTitle} onChange={(value) => updateRights("sourceWorkTitle", value)} /><TextField label="Source work author" rows={1} value={project.rights.sourceWorkAuthor} onChange={(value) => updateRights("sourceWorkAuthor", value)} /><label className={styles.field}><span>Adaptation status</span><select value={project.rights.adaptationStatus} onChange={(event) => updateRights("adaptationStatus", event.target.value as PlotPickleProject["rights"]["adaptationStatus"])}>{["original", "adaptation", "commissioned", "collaboration", "unknown"].map((item) => <option key={item}>{item}</option>)}</select></label></div>
    <div className={styles.collection}><header><h3>Collaborators</h3><button onClick={addCollaborator}>Add collaborator</button></header>{project.rights.collaborators.map((item) => <article key={item.id}>{(["name", "role", "contribution", "ownershipShare", "agreementReference", "creditedAs"] as const).map((key) => <TextField key={key} label={key.replace(/([A-Z])/g, " $1")} value={item[key]} onChange={(value) => updateRights("collaborators", project.rights.collaborators.map((entry) => entry.id === item.id ? { ...entry, [key]: value, updatedAt: new Date().toISOString() } : entry))} />)}<button className={styles.remove} onClick={() => updateRights("collaborators", project.rights.collaborators.filter((entry) => entry.id !== item.id))}>Remove</button></article>)}</div>
    <div className={styles.collection}><header><h3>Source attributions</h3><button onClick={addAttribution}>Add source</button></header>{project.rights.attributions.map((item) => <article key={item.id}><TextField label="Title" value={item.title} onChange={(value) => updateRights("attributions", project.rights.attributions.map((entry) => entry.id === item.id ? { ...entry, title: value } : entry))} /><TextField label="Creator" value={item.creator} onChange={(value) => updateRights("attributions", project.rights.attributions.map((entry) => entry.id === item.id ? { ...entry, creator: value } : entry))} /><label><span>Source type</span><select value={item.sourceType} onChange={(event) => updateRights("attributions", project.rights.attributions.map((entry) => entry.id === item.id ? { ...entry, sourceType: event.target.value as SourceAttribution["sourceType"] } : entry))}>{sourceTypes.map((type) => <option key={type}>{type}</option>)}</select></label>{(["sourceUrl", "licence", "permissionReference", "notes"] as const).map((key) => <TextField key={key} label={key.replace(/([A-Z])/g, " $1")} value={item[key]} onChange={(value) => updateRights("attributions", project.rights.attributions.map((entry) => entry.id === item.id ? { ...entry, [key]: value } : entry))} />)}<TextField label="Attached object IDs" value={item.attachedTo.join(", ")} onChange={(value) => updateRights("attributions", project.rights.attributions.map((entry) => entry.id === item.id ? { ...entry, attachedTo: value.split(",").map((part) => part.trim()).filter(Boolean) } : entry))} /><button className={styles.remove} onClick={() => updateRights("attributions", project.rights.attributions.filter((entry) => entry.id !== item.id))}>Remove</button></article>)}</div>
    <div className={styles.collection}><header><h3>AI provenance</h3><button onClick={addAiRecord}>Add AI record</button></header>{project.rights.aiProvenance.map((item) => <article key={item.id}><TextField label="Provider" value={item.provider} onChange={(value) => updateRights("aiProvenance", project.rights.aiProvenance.map((entry) => entry.id === item.id ? { ...entry, provider: value } : entry))} /><TextField label="Model" value={item.model} onChange={(value) => updateRights("aiProvenance", project.rights.aiProvenance.map((entry) => entry.id === item.id ? { ...entry, model: value } : entry))} /><label><span>Operation</span><select value={item.operation} onChange={(event) => updateRights("aiProvenance", project.rights.aiProvenance.map((entry) => entry.id === item.id ? { ...entry, operation: event.target.value as AiProvenanceRecord["operation"] } : entry))}>{aiOperations.map((operation) => <option key={operation}>{operation}</option>)}</select></label>{(["promptSummary", "outputSummary", "humanContribution", "humanDecision"] as const).map((key) => <TextField key={key} label={key.replace(/([A-Z])/g, " $1")} value={item[key]} onChange={(value) => updateRights("aiProvenance", project.rights.aiProvenance.map((entry) => entry.id === item.id ? { ...entry, [key]: value } : entry))} />)}<TextField label="Attached object IDs" value={item.attachedTo.join(", ")} onChange={(value) => updateRights("aiProvenance", project.rights.aiProvenance.map((entry) => entry.id === item.id ? { ...entry, attachedTo: value.split(",").map((part) => part.trim()).filter(Boolean) } : entry))} /><label className={styles.check}><input type="checkbox" checked={item.retained} onChange={(event) => updateRights("aiProvenance", project.rights.aiProvenance.map((entry) => entry.id === item.id ? { ...entry, retained: event.target.checked } : entry))} />Retained in project</label><button className={styles.remove} onClick={() => updateRights("aiProvenance", project.rights.aiProvenance.filter((entry) => entry.id !== item.id))}>Remove</button></article>)}</div></section> : null}

    {section === "revisions" ? <section className={styles.section}><div className={styles.snapshotCreate}><TextField label="Snapshot name" rows={1} value={revisionLabel} onChange={setRevisionLabel} placeholder="First complete draft" /><TextField label="Snapshot notes" value={revisionNotes} onChange={setRevisionNotes} /><button onClick={createSnapshot}>Capture revision snapshot</button></div><div className={styles.compare}><label><span>Earlier snapshot</span><select value={leftRevisionId} onChange={(event) => setLeftRevisionId(event.target.value)}><option value="">Select</option>{project.revisions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label><span>Later snapshot</span><select value={rightRevisionId} onChange={(event) => setRightRevisionId(event.target.value)}><option value="">Select</option>{project.revisions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><p>{compareRevisionSnapshots(leftRevision, rightRevision)}</p></div><div className={styles.revisionList}>{[...project.revisions].reverse().map((item) => <article key={item.id}><div><strong>{item.label}</strong><span>{new Date(item.createdAt).toLocaleString()} · {item.contentHash}</span><p>{item.notes || "No notes."}</p></div><button onClick={() => { if (window.confirm(`Restore “${item.label}”? The current revision history will be retained.`)) save(restoreRevisionSnapshot(project, item)); }}>Restore</button><button className={styles.remove} onClick={() => save({ ...project, revisions: project.revisions.filter((entry) => entry.id !== item.id) })}>Delete</button></article>)}</div>{!project.revisions.length ? <p>No snapshots yet. Capture one before a major rewrite or AI-assisted pass.</p> : null}</section> : null}
  </div>;
}
