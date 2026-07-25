"use client";

/* eslint-disable @next/next/no-img-element -- Bundled offline WebP references are loaded lazily from public assets. */

import { useEffect, useMemo, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import { createSpecialistSuggestion, type SpecialistSuggestion } from "@/lib/specialist-labs";
import styles from "./visual-reference-library.module.css";

export type VisualReference = {
  id: string;
  title: string;
  summary: string;
  category: "genre" | "emotion" | "environment" | "architecture" | "period" | "palette" | "cinematography" | "illustration";
  tags: string[];
  alt: string;
  image: { thumbnail: string; card: string; full: string; width: number; height: number };
  palette: Array<{ hex: string; label: string; proportion: number }>;
  contrast: string;
  saturation: string;
  lighting: string;
  texture: string;
  geometry: string;
  cameraFeel: string;
  emotionalEffect: string;
  usefulFor: string[];
  caution: string;
  source: { archive: string; repository: string; originalFilename: string; generated: boolean; originalPrompt: string; rightsNote: string; renamedFromFilm?: string };
};

type Props = {
  project: PlotPickleProject;
  onPrepareSuggestion: (suggestion: SpecialistSuggestion) => void;
  onStatus: (message: string) => void;
};

const categoryLabels = ["all", "genre", "emotion", "environment", "architecture", "period", "palette", "cinematography", "illustration"] as const;
const treatmentTags = ["warm", "cool", "muted", "high-saturation", "monochrome", "low-key", "high-key", "natural", "practical", "atmospheric", "cinematic", "sketch", "watercolour", "symmetrical", "minimal", "ornate", "surreal"] as const;

type Scope = "project" | "character" | "location" | "block" | "mini-block";

function copyText(value: string) {
  void navigator.clipboard?.writeText(value);
}

export default function VisualReferenceLibrary({ project, onPrepareSuggestion, onStatus }: Props) {
  const [references, setReferences] = useState<VisualReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categoryLabels)[number]>("all");
  const [treatment, setTreatment] = useState("all");
  const [sort, setSort] = useState<"title" | "category" | "recent">("title");
  const [selectedId, setSelectedId] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [selectedColours, setSelectedColours] = useState<string[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [writerNote, setWriterNote] = useState("");
  const [scope, setScope] = useState<Scope>("project");
  const [targetId, setTargetId] = useState(project.id);

  useEffect(() => {
    let cancelled = false;
    fetch("/visual-references/manifest.json", { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`Reference manifest returned ${response.status}.`);
        return response.json() as Promise<VisualReference[]>;
      })
      .then((data) => {
        if (cancelled) return;
        setReferences(data);
        setSelectedId(data[0]?.id ?? "");
        setSelectedColours(data[0]?.palette.slice(0, 3).map((item) => item.hex) ?? []);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "The bundled reference manifest could not be loaded.");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const result = references.filter((reference) => {
      const haystack = [reference.title, reference.summary, reference.category, reference.tags.join(" "), reference.emotionalEffect, reference.lighting, reference.texture, reference.geometry, reference.cameraFeel, reference.palette.map((item) => item.hex).join(" ")].join(" ").toLowerCase();
      return (!search || haystack.includes(search)) && (category === "all" || reference.category === category) && (treatment === "all" || reference.tags.includes(treatment));
    });
    return [...result].sort((left, right) => sort === "category" ? `${left.category}-${left.title}`.localeCompare(`${right.category}-${right.title}`) : sort === "recent" ? recentIds.indexOf(left.id) - recentIds.indexOf(right.id) : left.title.localeCompare(right.title));
  }, [category, query, recentIds, references, sort, treatment]);

  const selected = references.find((reference) => reference.id === selectedId) ?? filtered[0] ?? references[0];

  function selectReference(reference: VisualReference) {
    setSelectedId(reference.id);
    setRecentIds((current) => [reference.id, ...current.filter((id) => id !== reference.id)].slice(0, 30));
    setSelectedColours(reference.palette.slice(0, 3).map((item) => item.hex));
    setSelectedIngredients([reference.lighting, reference.texture, reference.geometry, reference.cameraFeel]);
  }

  function setScopeValue(next: Scope) {
    setScope(next);
    if (next === "project") setTargetId(project.id);
    else if (next === "character") setTargetId(project.characters[0]?.id ?? "");
    else if (next === "location") setTargetId(project.world.locations[0]?.id ?? "");
    else if (next === "block") setTargetId(project.blocks[0]?.id ?? "");
    else setTargetId(project.blocks[0]?.miniBlocks[0]?.id ?? "");
  }

  function targets() {
    if (scope === "character") return project.characters.map((item) => ({ id: item.id, label: item.name || "Unnamed character" }));
    if (scope === "location") return project.world.locations.map((item) => ({ id: item.id, label: item.name || "Unnamed location" }));
    if (scope === "block") return project.blocks.map((item) => ({ id: item.id, label: `Block ${item.number}: ${item.title}` }));
    if (scope === "mini-block") return project.blocks.flatMap((block) => block.miniBlocks.map((item) => ({ id: item.id, label: `Block ${block.number}.${item.number}: ${item.label}` })));
    return [{ id: project.id, label: project.metadata.title || "Whole project" }];
  }

  function prepareReferenceSuggestion() {
    if (!selected) return;
    const paletteLine = selectedColours.length ? `Starting palette: ${selectedColours.join(", ")}.` : "No palette colours selected.";
    const ingredientLine = selectedIngredients.length ? `Visual ingredients: ${selectedIngredients.join("; ")}.` : "No visual ingredients selected.";
    const target = targets().find((item) => item.id === targetId)?.label || scope;
    const after = [`Reference: ${selected.title}.`, paletteLine, ingredientLine, writerNote.trim() ? `Writer note: ${writerNote.trim()}` : "", `Intended scope: ${scope} · ${target}.`, "Use these ingredients as an editable starting vocabulary; do not copy a finished film, creator or production design."].filter(Boolean).join("\n");
    onPrepareSuggestion(createSpecialistSuggestion({
      lab: "visual",
      title: `Visual reference · ${selected.title}`,
      summary: `Bundled PlotPickle reference selection for ${scope}. The image itself remains separate from project-owned assets.`,
      target: `world.visualLanguage · ${scope}:${targetId}`,
      before: project.world.visualLanguage || "No approved project visual language recorded.",
      after,
      prompt: "Writer-selected bundled reference ingredients; no AI call was made.",
      generated: false,
      metadata: {
        collection: "PlotPickle Visual Reference Library",
        referenceId: selected.id,
        referenceTitle: selected.title,
        selectedColours: selectedColours.join(", "),
        selectedIngredients: selectedIngredients.join("; "),
        writerNote: writerNote.trim(),
        scope,
        targetId,
        provenance: `${selected.source.archive} · ${selected.source.originalFilename}`,
        rightsNote: selected.source.rightsNote,
        approvalBoundary: "Reference selection is a reviewable proposal. Bundled imagery is not copied into the canonical project and no visual rule changes until approval.",
      },
    }));
    onStatus("Visual reference ingredients are ready in the review gate. The canonical project and bundled image remain unchanged.");
  }

  if (loading) return <p className={styles.status}>Loading the bundled offline reference manifest…</p>;
  if (loadError) return <p className={styles.error}>{loadError}</p>;

  return <section className={styles.library} aria-label="Built-in Visual Reference Library">
    <header className={styles.header}><div><span>Reference Library</span><h3>Discover visual vocabulary without changing the project</h3><p>{references.length} bundled WebP boards remain separate from project-owned images. Search, compare and deliberately copy only the ingredients you choose.</p></div><strong>{filtered.length} shown</strong></header>
    <div className={styles.filters}>
      <label>Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mood, genre, environment, period, colour, lighting or treatment" /></label>
      <label>Category<select value={category} onChange={(event) => setCategory(event.target.value as (typeof categoryLabels)[number])}>{categoryLabels.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label>Visual treatment<select value={treatment} onChange={(event) => setTreatment(event.target.value)}><option value="all">all</option>{treatmentTags.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label>Sort<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="title">title</option><option value="category">category</option><option value="recent">recently viewed</option></select></label>
    </div>
    <div className={styles.layout}>
      <div className={styles.cards} role="listbox" aria-label="Visual references">{filtered.map((reference) => <button type="button" role="option" aria-selected={selected?.id === reference.id} className={selected?.id === reference.id ? styles.selectedCard : styles.card} key={reference.id} onClick={() => selectReference(reference)}><img src={reference.image.thumbnail} alt={reference.alt} loading="lazy" width="480" height="320" /><span>{reference.category}</span><strong>{reference.title}</strong><small>{reference.emotionalEffect}</small></button>)}</div>
      {selected ? <aside className={styles.detail} aria-label={`${selected.title} details`}>
        <img src={selected.image.card} alt={selected.alt} loading="lazy" />
        <span>{selected.category}</span><h3>{selected.title}</h3><p>{selected.summary}</p>
        <div className={styles.swatches}>{selected.palette.map((colour) => <button type="button" key={colour.hex} title={`Copy ${colour.hex}`} onClick={() => copyText(colour.hex)}><i style={{ background: colour.hex }} aria-hidden="true" /><strong>{colour.label}</strong><small>{colour.hex} · {Math.round(colour.proportion * 100)}%</small></button>)}</div>
        <dl><div><dt>Contrast</dt><dd>{selected.contrast}</dd></div><div><dt>Saturation</dt><dd>{selected.saturation}</dd></div><div><dt>Lighting</dt><dd>{selected.lighting}</dd></div><div><dt>Texture</dt><dd>{selected.texture}</dd></div><div><dt>Shape and composition</dt><dd>{selected.geometry}</dd></div><div><dt>Camera feel</dt><dd>{selected.cameraFeel}</dd></div><div><dt>Audience effect</dt><dd>{selected.emotionalEffect}</dd></div></dl>
        <p className={styles.caution}>{selected.caution}</p>
        <fieldset><legend>Choose what the proposal may copy</legend><div className={styles.choiceGrid}>{selected.palette.map((colour) => <label key={colour.hex}><input type="checkbox" checked={selectedColours.includes(colour.hex)} onChange={(event) => setSelectedColours((current) => event.target.checked ? [...current, colour.hex] : current.filter((item) => item !== colour.hex))} /> {colour.label} · {colour.hex}</label>)}</div><div className={styles.choiceGrid}>{[selected.lighting, selected.texture, selected.geometry, selected.cameraFeel].map((ingredient) => <label key={ingredient}><input type="checkbox" checked={selectedIngredients.includes(ingredient)} onChange={(event) => setSelectedIngredients((current) => event.target.checked ? [...current, ingredient] : current.filter((item) => item !== ingredient))} /> {ingredient}</label>)}</div></fieldset>
        <div className={styles.scope}><label>Scope<select value={scope} onChange={(event) => setScopeValue(event.target.value as Scope)}><option value="project">project</option><option value="character">character</option><option value="location">location</option><option value="block">block</option><option value="mini-block">mini-block</option></select></label><label>Target<select value={targetId} onChange={(event) => setTargetId(event.target.value)}>{targets().map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label></div>
        <label>Writer note<textarea rows={4} value={writerNote} onChange={(event) => setWriterNote(event.target.value)} placeholder="What should this reference contribute, change or avoid?" /></label>
        <button type="button" className={styles.primary} onClick={prepareReferenceSuggestion}>Open in Visual Bible proposal</button>
        <details><summary>Provenance and sharing caution</summary><p>{selected.source.archive}</p><p>{selected.source.originalFilename}</p><p>{selected.source.rightsNote}</p></details>
      </aside> : null}
    </div>
  </section>;
}
