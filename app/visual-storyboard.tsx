"use client";

/* eslint-disable @next/next/no-img-element -- Storyboard assets are served by PlotPickle's private local gateway or supplied by the writer. */

import { useEffect, useMemo, useRef, useState } from "react";
import { createStoryboardFrame, type MiniBlock, type PlotPickleProject, type StoryBlock, type StoryScene, type VisualFrame } from "@/lib/project";
import { migrateLegacyAssetReferences, resolveProjectAssetSource } from "@/lib/project-assets";
import {
  approvedCharacterIdentityPrompt,
  approvedCharacterReferenceImages,
  characterVisualIdentityDiagnostic,
  getCharacterVisualIdentity,
  type CharacterWithVisualIdentity,
} from "@/lib/character-visual-identity";
import AfterglowLegacyVisuals from "./afterglow-legacy-visuals";
import styles from "./visual-storyboard.module.css";

type BoardMode = "blocks" | "minis";
type VisualSection = "overview" | "characters" | "locations" | "assets" | "language" | "blocks" | "frames" | "pitch" | "diagnostics";
type WorkingState = "idle" | "prompt" | "image" | "error";
type AiResponse = { text?: string; assetUrl?: string; revisedPrompt?: string; message?: string };

function miniBlockFor(block: StoryBlock, miniBlockNumber: number) {
  return block.scenes.flatMap((scene) => scene.miniBlocks).find((mini) => mini.number === miniBlockNumber) ?? block.scenes[0].miniBlocks[0];
}

function sceneFor(block: StoryBlock, miniBlockNumber: number) {
  return block.scenes.find((scene) => scene.miniBlocks.some((mini) => mini.number === miniBlockNumber)) ?? block.scenes[0];
}

function primaryFrame(block: StoryBlock, miniBlockNumber: number) {
  return block.visuals.find((frame) => frame.miniBlockNumber === miniBlockNumber)
    ?? createStoryboardFrame(block.number, miniBlockNumber);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function charactersForVisual(project: PlotPickleProject, block: StoryBlock, scene: StoryScene, mini: MiniBlock) {
  const characterIds = unique([...block.characterIds, ...scene.characterIds, mini.characterId]);
  return characterIds.map((id) => project.characters.find((character) => character.id === id)).filter(Boolean) as CharacterWithVisualIdentity[];
}

export function storyboardIdentityInputs(project: PlotPickleProject, block: StoryBlock, scene: StoryScene, mini: MiniBlock) {
  const characters = charactersForVisual(project, block, scene, mini);
  return characters.map((character) => {
    const identity = getCharacterVisualIdentity(character);
    return {
      characterId: character.id,
      name: character.name,
      version: identity.version,
      status: identity.status,
      approvedPrompt: approvedCharacterIdentityPrompt(character),
      negativePrompt: identity.negativePrompt,
      referenceImages: approvedCharacterReferenceImages(character),
      wardrobeVariants: identity.wardrobeVariants,
      sceneContinuityNotes: identity.sceneContinuityNotes,
      diagnostic: characterVisualIdentityDiagnostic(character),
    };
  });
}

export function storyboardPrompt(project: PlotPickleProject, block: StoryBlock, scene: StoryScene, mini: MiniBlock, frame: VisualFrame) {
  const locationIds = unique([...block.locationIds, ...scene.locationIds]);
  const identities = storyboardIdentityInputs(project, block, scene, mini);
  const locations = locationIds.map((id) => project.world.locations.find((location) => location.id === id)).filter(Boolean);
  const screenplay = project.screenplay.draftElements
    .filter((element) => element.blockNumber === block.number && element.miniBlockNumber === mini.number)
    .map((element) => `${element.type}: ${element.text}`)
    .join(" | ")
    .slice(0, 1800);
  const characterText = identities.map((identity) => [
    `${identity.name} — identity version ${identity.version}, ${identity.status}`,
    identity.approvedPrompt,
    identity.negativePrompt && `Do not drift: ${identity.negativePrompt}`,
    identity.referenceImages.length && `Match ${identity.referenceImages.length} approved reference image${identity.referenceImages.length === 1 ? "" : "s"}`,
    identity.wardrobeVariants && `Allowed wardrobe variants: ${identity.wardrobeVariants}`,
    identity.sceneContinuityNotes && `Current continuity notes: ${identity.sceneContinuityNotes}`,
  ].filter(Boolean).join(". ")).join("\n");
  const locationText = locations.map((location) => `${location!.name}: ${location!.description}`).join(" | ");

  return [
    "Create one cinematic landscape storyboard frame for a feature screenplay. Show a single decisive visual moment, not a collage, contact sheet, poster, title card, or split screen.",
    `Project: ${project.metadata.title}. Genre: ${project.metadata.genre || "unspecified"}. Tone: ${project.metadata.tone || "cinematic and story-appropriate"}.`,
    project.world.period && `Period: ${project.world.period}.`,
    project.world.visualLanguage && `Project visual language: ${project.world.visualLanguage}.`,
    `Block ${block.number} of 24 — ${block.title}. Block purpose: ${block.purpose}. ${block.summary && `Story action: ${block.summary}.`}`,
    `Scene ${scene.number} — ${scene.title}. Scene purpose: ${scene.purpose}. ${scene.objective && `Objective: ${scene.objective}.`} ${scene.conflict && `Conflict: ${scene.conflict}.`} ${scene.turn && `Turn: ${scene.turn}.`} ${scene.outcome && `Outcome: ${scene.outcome}.`}`,
    `Mini-block ${block.number}.${mini.number} — ${mini.label}. Dramatic function: ${mini.function}. ${mini.purpose && `Purpose: ${mini.purpose}.`} ${mini.objective && `Objective: ${mini.objective}.`} ${mini.resistance && `Resistance: ${mini.resistance}.`} ${mini.action && `Visible action: ${mini.action}.`} ${mini.revelation && `Revelation: ${mini.revelation}.`} ${mini.turn && `Turn: ${mini.turn}.`} ${mini.visualBeat && `Required visual beat: ${mini.visualBeat}.`} ${mini.entryState && `Entry state: ${mini.entryState}.`} ${mini.exitState && `Exit state: ${mini.exitState}.`}`,
    mini.notes && `Treatment evidence for this exact mini-block: ${mini.notes.slice(0, 1800)}.`,
    characterText && `CHARACTER IDENTITY LOCKS — reproduce these exact approved identities in the image:\n${characterText}`,
    locationText && `Location: ${locationText}.`,
    screenplay && `Screenplay evidence for this exact mini-block: ${screenplay}.`,
    block.storyboardDirection && `Block storyboard direction: ${block.storyboardDirection}.`,
    frame.shot ? `Camera and composition: ${frame.shot}.` : "Camera and composition: readable cinematic wide or medium-wide frame, clear staging, expressive faces and body language, purposeful depth, 16:9 composition.",
    frame.continuity && `Frame continuity lock: ${frame.continuity}.`,
    "Keep wardrobe, age, facial structure, hair, props, injuries, time of day, colour language and screen direction consistent with the approved identity packages and established project details. No captions, lettering, logos, borders, watermarks or UI.",
  ].filter(Boolean).join("\n");
}

export default function VisualStoryboard({ project, initialBlockNumber, visualAct, onVisualActChange, onOpenPlannerBlock, onChange }: {
  project: PlotPickleProject;
  initialBlockNumber: number;
  visualAct: number;
  onVisualActChange: (act: number) => void;
  onOpenPlannerBlock: (number: number) => void;
  onChange: (project: PlotPickleProject) => void;
}) {
  const [mode, setMode] = useState<BoardMode>("blocks");
  const [activeSection, setActiveSection] = useState<VisualSection>("overview");
  const [blockNumber, setBlockNumber] = useState(initialBlockNumber);
  const [miniBlockNumber, setMiniBlockNumber] = useState(1);
  const [working, setWorking] = useState<WorkingState>("idle");
  const [message, setMessage] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  const block = project.blocks[blockNumber - 1] ?? project.blocks[0];
  const mini = miniBlockFor(block, miniBlockNumber);
  const scene = sceneFor(block, miniBlockNumber);
  const frame = primaryFrame(block, miniBlockNumber);
  const frameSource = resolveProjectAssetSource(project.assets, frame.assetRef, frame.src);
  const prompt = useMemo(() => storyboardPrompt(project, block, scene, mini, frame), [project, block, scene, mini, frame]);
  const identityInputs = useMemo(() => storyboardIdentityInputs(project, block, scene, mini), [project, block, scene, mini]);
  const identityWarnings = identityInputs.filter((identity) => identity.diagnostic.severity !== "clear");
  const visibleBlocks = visualAct ? project.blocks.filter((item) => item.act === visualAct) : project.blocks;
  const visibleMinis = visibleBlocks.flatMap((item) => [1, 2, 3, 4].map((number) => ({ block: item, mini: miniBlockFor(item, number), frame: primaryFrame(item, number) })));
  const allFrames = project.blocks.flatMap((item) => [1, 2, 3, 4].map((number) => primaryFrame(item, number)));
  const completed = allFrames.filter((item) => item.src).length;
  const prompted = allFrames.filter((item) => item.prompt).length;
  const lockedCharacters = project.characters.filter((character) => getCharacterVisualIdentity(character).status === "locked").length;
  const characterReferences = project.characters.filter((character) => character.image || approvedCharacterReferenceImages(character as CharacterWithVisualIdentity).length).length;
  const locationReferences = project.world.locations.filter((location) => location.image).length;
  const productionAssets = unique(project.production.breakdowns.flatMap((item) => [item.props, item.vehicles, item.wardrobe])).length;
  const continuityWarnings = allFrames.filter((item) => item.src && !item.continuity).length
    + project.characters.filter((character) => characterVisualIdentityDiagnostic(character as CharacterWithVisualIdentity).severity !== "clear").length;
  const missingReferences = Math.max(0, project.characters.length - characterReferences) + Math.max(0, project.world.locations.length - locationReferences) + (96 - completed);

  const navigation: { id: VisualSection; label: string; detail: string; count: string }[] = [
    { id: "overview", label: "Visual overview", detail: "Production readiness", count: `${completed}/96` },
    { id: "characters", label: "Characters & identity locks", detail: "Approved faces and references", count: `${lockedCharacters}/${project.characters.length}` },
    { id: "locations", label: "Locations & world", detail: "Environment references", count: `${locationReferences}/${project.world.locations.length}` },
    { id: "assets", label: "Props, vehicles & wardrobe", detail: "Recurring production assets", count: String(productionAssets) },
    { id: "language", label: "Colour, lighting & language", detail: "The film's visual rules", count: project.world.visualLanguage ? "Ready" : "Missing" },
    { id: "blocks", label: "24-block storyboard", detail: "Whole-film overview", count: `${project.blocks.filter((item) => item.visuals.some((visual) => visual.src)).length}/24` },
    { id: "frames", label: "96 mini-block frames", detail: "Playable visual moments", count: `${completed}/96` },
    { id: "pitch", label: "Posters, pitch & production", detail: "Presentation references", count: project.review.pitchPackage.visualStatement || project.production.distribution.posterPlan ? "Ready" : "Draft" },
    { id: "diagnostics", label: "Continuity & missing assets", detail: "Visual review queue", count: String(continuityWarnings + missingReferences) },
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedSection = params.get("visualSection") as VisualSection | null;
    const requestedBlock = Number(params.get("block"));
    const requestedMini = Number(params.get("mini"));
    if (requestedSection && navigation.some((item) => item.id === requestedSection)) {
      setActiveSection(requestedSection);
      if (requestedSection === "frames") setMode("minis");
      if (requestedSection === "blocks") setMode("blocks");
      window.requestAnimationFrame(() => document.getElementById(`visual-${requestedSection}`)?.scrollIntoView({ block: "start" }));
    }
    if (requestedBlock >= 1 && requestedBlock <= 24) setBlockNumber(requestedBlock);
    if (requestedMini >= 1 && requestedMini <= 4) setMiniBlockNumber(requestedMini);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sections = [...(contentRef.current?.querySelectorAll<HTMLElement>("[data-visual-section]") ?? [])];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.getAttribute("data-visual-section") as VisualSection);
    }, { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.1, 0.5] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [mode]);

  function syncUrl(section: VisualSection, blockValue = blockNumber, miniValue = miniBlockNumber) {
    const url = new URL(window.location.href);
    url.searchParams.set("visualSection", section);
    url.searchParams.set("block", String(blockValue));
    url.searchParams.set("mini", String(miniValue));
    window.history.replaceState({}, "", url);
  }

  function openSection(section: VisualSection) {
    if (section === "blocks") setMode("blocks");
    if (section === "frames") setMode("minis");
    setActiveSection(section);
    syncUrl(section);
    window.requestAnimationFrame(() => document.getElementById(`visual-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function choose(blockNumberValue: number, miniBlockNumberValue = 1) {
    setBlockNumber(blockNumberValue);
    setMiniBlockNumber(miniBlockNumberValue);
    setMode("minis");
    setWorking("idle");
    setMessage("");
    setActiveSection("frames");
    syncUrl("frames", blockNumberValue, miniBlockNumberValue);
  }

  function updateFrame(patch: Partial<VisualFrame>) {
    onChange(migrateLegacyAssetReferences({
      ...project,
      blocks: project.blocks.map((item) => item.number === block.number ? {
        ...item,
        visuals: item.visuals.some((visual) => visual.id === frame.id)
          ? item.visuals.map((visual) => visual.id === frame.id ? {
            ...visual,
            ...patch,
            assetRef: patch.src === "" ? undefined : patch.assetRef ?? visual.assetRef,
            miniBlockNumber,
          } : visual)
          : [...item.visuals, {
            ...frame,
            ...patch,
            assetRef: patch.src === "" ? undefined : patch.assetRef ?? frame.assetRef,
            miniBlockNumber,
          }],
      } : item),
    }));
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(frame.prompt || prompt);
    setMessage("Prompt copied. You can use it with any image generator.");
  }

  async function refinePrompt() {
    if (working !== "idle") return;
    setWorking("prompt");
    setMessage("Refining the prompt while preserving the approved identity locks…");
    try {
      const response = await fetch("/api/local-ai/generate/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructions: "Rewrite the supplied storyboard image prompt for an image model. Preserve every story, character identity lock, approved reference instruction, negative identity rule, location, continuity and camera fact exactly. Strengthen visible action, composition, lighting, spatial relationships and emotional readability. Return only the final image prompt without Markdown.",
          prompt: frame.prompt || prompt,
        }),
      });
      const result = await response.json() as AiResponse;
      if (!response.ok || !result.text) throw new Error(result.message || "AI returned no prompt.");
      updateFrame({ prompt: result.text });
      setWorking("idle");
      setMessage("The refined prompt is ready. Review it before generating the image.");
    } catch (error) {
      setWorking("error");
      setMessage(error instanceof Error ? error.message : "Prompt refinement is unavailable.");
    }
  }

  async function generateImage() {
    if (working === "image" || working === "prompt") return;
    const billingAcknowledged = window.confirm("Generate one storyboard image? A connected cloud provider may charge the API account saved by this user. PlotPickle does not supply credits or pay for generation.");
    if (!billingAcknowledged) {
      setMessage("Storyboard generation was cancelled. No provider request was made.");
      return;
    }
    const activePrompt = frame.prompt || prompt;
    setWorking("image");
    setMessage(identityWarnings.length ? "Generating with identity warnings. Review the result carefully before treating it as approved." : "Generating with the locked character identities and saving the frame locally…");
    try {
      const response = await fetch("/api/local-ai/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: activePrompt,
          assetId: `storyboard-block-${block.number}-mini-${miniBlockNumber}`,
          aspect: "landscape",
          referenceImages: unique(identityInputs.flatMap((identity) => identity.referenceImages)),
          identityLocks: identityInputs.map(({ diagnostic, ...identity }) => identity),
          requestCount: 1,
          billingAcknowledged,
        }),
      });
      const result = await response.json() as AiResponse;
      if (!response.ok || !result.assetUrl) throw new Error(result.message || "The image provider returned no image.");
      updateFrame({ src: result.assetUrl, prompt: result.revisedPrompt || activePrompt, alt: frame.alt || `${project.metadata.title}, Block ${block.number}, mini-block ${miniBlockNumber}: ${mini.visualBeat || mini.function}` });
      setWorking("idle");
      setMessage("Storyboard frame generated, saved locally and attached to this mini-block. Identity locks remain available for the next frame.");
    } catch (error) {
      setWorking("error");
      setMessage(error instanceof Error ? error.message : "Image generation is unavailable.");
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><span>Visual Board</span><h1>Manage the film's complete visual production language.</h1><p>Navigate identity locks, locations, recurring assets, visual rules, all 24 story blocks and all 96 playable frames without leaving the board.</p></div>
        <div className={styles.progress}><strong>{completed}<small>/96 images</small></strong><div><i style={{ width: `${Math.round((completed / 96) * 100)}%` }} /></div><span>{prompted} edited prompts</span></div>
      </header>

      <div className={styles.visualLayout}>
        <nav className={styles.visualNav} aria-label="Visual Board sections">
          <div className={styles.visualNavHead}><strong>Visual production</strong><span>{continuityWarnings + missingReferences} items to review</span></div>
          {navigation.map((item) => <button type="button" key={item.id} className={activeSection === item.id ? styles.navActive : ""} aria-current={activeSection === item.id ? "location" : undefined} onClick={() => openSection(item.id)}>
            <span><strong>{item.label}</strong><small>{item.detail}</small></span><b>{item.count}</b>
          </button>)}
        </nav>

        <div className={styles.visualContent} ref={contentRef}>
          <section id="visual-overview" data-visual-section="overview" className={styles.assetSection} tabIndex={-1}>
            <div className={styles.sectionHead}><div><span>Visual overview</span><h2>Production readiness at a glance</h2></div></div>
            <div className={styles.metricGrid}>
              <article><strong>{lockedCharacters}</strong><span>locked characters</span></article><article><strong>{locationReferences}</strong><span>location references</span></article><article><strong>{completed}</strong><span>completed frames</span></article><article><strong>{continuityWarnings}</strong><span>continuity warnings</span></article>
            </div>
          </section>

          <section id="visual-characters" data-visual-section="characters" className={styles.assetSection} tabIndex={-1}>
            <div className={styles.sectionHead}><div><span>Characters & identity locks</span><h2>Approved faces, silhouettes and appearance variants</h2></div><b>{lockedCharacters}/{project.characters.length} locked</b></div>
            <div className={styles.referenceGrid}>{project.characters.map((character) => { const identity = getCharacterVisualIdentity(character); const references = approvedCharacterReferenceImages(character as CharacterWithVisualIdentity); return <article key={character.id}>{character.image ? <img src={character.image} alt={`${character.name} character reference`} /> : <div className={styles.referencePlaceholder}>{character.name.slice(0, 1) || "?"}</div>}<div><strong>{character.name || "Unnamed character"}</strong><span>{identity.status} · v{identity.version}</span><small>{references.length} approved reference{references.length === 1 ? "" : "s"}{identity.wardrobeVariants ? " · wardrobe variants recorded" : ""}</small></div></article>; })}</div>
          </section>

          <section id="visual-locations" data-visual-section="locations" className={styles.assetSection} tabIndex={-1}>
            <div className={styles.sectionHead}><div><span>Locations & world references</span><h2>Keep every environment geographically and visually consistent</h2></div><b>{locationReferences}/{project.world.locations.length} referenced</b></div>
            <div className={styles.referenceGrid}>{project.world.locations.map((location) => <article key={location.id}>{location.image ? <img src={location.image} alt={`${location.name} location reference`} /> : <div className={styles.referencePlaceholder}>⌂</div>}<div><strong>{location.name || "Unnamed location"}</strong><span>{location.image ? "Reference attached" : "Reference missing"}</span><small>{location.description || "Add the environment, geography and production details."}</small></div></article>)}</div>
          </section>

          <section id="visual-assets" data-visual-section="assets" className={styles.assetSection} tabIndex={-1}>
            <div className={styles.sectionHead}><div><span>Props, vehicles & wardrobe</span><h2>Recurring production assets from scene breakdowns</h2></div><b>{productionAssets} recorded</b></div>
            <div className={styles.assetColumns}>{[ ["Props", unique(project.production.breakdowns.map((item) => item.props))], ["Vehicles", unique(project.production.breakdowns.map((item) => item.vehicles))], ["Wardrobe", unique(project.production.breakdowns.map((item) => item.wardrobe))] ].map(([label, values]) => <article key={label as string}><strong>{label as string}</strong>{(values as string[]).length ? (values as string[]).map((value) => <p key={value}>{value}</p>) : <p className={styles.missing}>No {String(label).toLowerCase()} references recorded yet.</p>}</article>)}</div>
          </section>

          <section id="visual-language" data-visual-section="language" className={styles.assetSection} tabIndex={-1}>
            <div className={styles.sectionHead}><div><span>Colour, lighting & visual language</span><h2>The rules that make every image belong to the same film</h2></div></div>
            <div className={styles.languageGrid}><article><strong>World visual language</strong><p>{project.world.visualLanguage || "Define palette, lighting, texture, framing and recurring visual motifs in World."}</p></article><article><strong>Pitch visual statement</strong><p>{project.review.pitchPackage.visualStatement || project.development.pitch.visualVision || "Add the audience-facing visual promise in Pitch & Vision."}</p></article><article><strong>Period and technology</strong><p>{[project.world.period, project.world.technology].filter(Boolean).join(" · ") || "Specify period and technology constraints for dependable image continuity."}</p></article></div>
          </section>

          <section id={`visual-${mode === "blocks" ? "blocks" : "frames"}`} data-visual-section={mode === "blocks" ? "blocks" : "frames"} className={styles.storyboardSection} tabIndex={-1}>
            <div className={styles.toolbar}>
              <div className={styles.modeSwitch}><button type="button" className={mode === "blocks" ? styles.active : ""} onClick={() => openSection("blocks")}>24 Blocks</button><button type="button" className={mode === "minis" ? styles.active : ""} onClick={() => openSection("frames")}>96 Mini-blocks</button></div>
              <div className={styles.actFilter}>{[0, 1, 2, 3, 4].map((act) => <button type="button" className={visualAct === act ? styles.active : ""} key={act} onClick={() => onVisualActChange(act)}>{act ? `Act ${act}` : "All acts"}</button>)}</div>
            </div>
            <div className={styles.workspace}>
              <main className={styles.board}>
                {mode === "blocks" ? <div className={styles.blockGrid}>{visibleBlocks.map((item) => { const frames = [1, 2, 3, 4].map((number) => primaryFrame(item, number)); const hero = frames.find((visual) => visual.src); const count = frames.filter((visual) => visual.src).length; return <button type="button" className={`${styles.blockCard} ${styles[`act${item.act}`]} ${item.number === block.number ? styles.selected : ""}`} key={item.id} onClick={() => choose(item.number)}><div className={styles.blockImage}>{hero?.src ? <img src={hero.src} alt={hero.alt || `Block ${item.number}`} /> : <span>{String(item.number).padStart(2, "0")}</span>}<b>{count}/4</b></div><div><small>Block {item.number} · Sequence {item.sequenceNumber}</small><strong>{item.title}</strong><p>{item.summary || item.purpose}</p></div><div className={styles.miniDots}>{frames.map((visual, index) => <i className={visual.src ? styles.done : visual.prompt ? styles.ready : ""} key={visual.id || index} />)}</div></button>; })}</div> : <div className={styles.miniGrid}>{visibleMinis.map(({ block: item, mini: itemMini, frame: itemFrame }) => <button type="button" className={`${styles.miniCard} ${item.number === block.number && itemMini.number === miniBlockNumber ? styles.selected : ""}`} key={`${item.id}-${itemMini.number}`} onClick={() => choose(item.number, itemMini.number)}><div className={styles.miniImage}>{itemFrame.src ? <img src={itemFrame.src} alt={itemFrame.alt || `Block ${item.number}.${itemMini.number}`} /> : <span><b>{item.number}.{itemMini.number}</b><small>{itemMini.label}</small></span>}</div><div><small>Act {item.act} · Block {item.number}</small><strong>{itemMini.label}</strong><p>{itemMini.visualBeat || itemMini.purpose || itemMini.function}</p><em>{itemFrame.src ? "Image complete" : itemFrame.prompt ? "Prompt ready" : "Ready to develop"}</em></div></button>)}</div>}
              </main>
              <aside className={styles.inspector}>
                <p><strong>Current approved storyboard</strong> frames remain separate from historical source art.</p>
                <AfterglowLegacyVisuals project={project} mode="block" blockNumber={block.number} />
                <div className={styles.inspectorHead}><div><span>Selected visual</span><h2>Block {block.number}.{miniBlockNumber}</h2><strong>{block.title} · {mini.label}</strong></div><button type="button" onClick={() => onOpenPlannerBlock(block.number)}>Open story block</button></div>
                <div className={styles.turnStrip}>{[1, 2, 3, 4].map((number) => { const itemMini = miniBlockFor(block, number); const itemFrame = primaryFrame(block, number); return <button type="button" className={number === miniBlockNumber ? styles.active : ""} onClick={() => choose(block.number, number)} key={number}><span>{number}</span><strong>{itemMini.label}</strong><i className={itemFrame.src ? styles.done : itemFrame.prompt ? styles.ready : ""} /></button>; })}</div>
                <div className={styles.context}><small>Scene purpose</small><p>{scene.purpose || "Add the scene purpose in the Structure Map or Block editor."}</p><small>Mini-block purpose</small><p>{mini.visualBeat || mini.purpose || mini.function}</p></div>
                {identityInputs.length ? <div className={styles.context}><small>Character identity status</small>{identityInputs.map((identity) => <p key={identity.characterId}><strong>{identity.name}</strong> · {identity.status} v{identity.version} · {identity.referenceImages.length} approved reference{identity.referenceImages.length === 1 ? "" : "s"}{identity.diagnostic.severity !== "clear" ? ` — ${identity.diagnostic.message}` : ""}</p>)}</div> : null}
                {identityWarnings.length ? <p className={styles.note}><strong>Identity review needed:</strong> {identityWarnings.map((identity) => identity.name).join(", ")}.</p> : null}
                <div className={styles.preview}>{frameSource ? <img src={frameSource} alt={frame.alt || `Block ${block.number}.${miniBlockNumber} storyboard`} /> : <div><strong>No image yet</strong><span>The complete default prompt is ready below.</span></div>}</div>
                <label><span>Image prompt</span><textarea rows={12} value={frame.prompt || prompt} onChange={(event) => updateFrame({ prompt: event.target.value })} /></label>
                <div className={styles.promptActions}><button type="button" onClick={() => updateFrame({ prompt })}>Rebuild from story</button><button type="button" onClick={copyPrompt}>Copy prompt</button><button type="button" disabled={working === "prompt" || working === "image"} onClick={refinePrompt}>{working === "prompt" ? "Refining…" : "Refine with AI"}</button></div>
                <label><span>Shot and lens</span><input value={frame.shot} onChange={(event) => updateFrame({ shot: event.target.value })} placeholder="Wide two-shot, 35mm lens, low eye line…" /></label>
                <label><span>Continuity lock</span><textarea rows={3} value={frame.continuity} onChange={(event) => updateFrame({ continuity: event.target.value })} placeholder="Wardrobe, props, injuries, time of day, screen direction…" /></label>
                <label><span>Caption</span><input value={frame.caption} onChange={(event) => updateFrame({ caption: event.target.value })} placeholder="What changes in this image?" /></label>
                <label><span>Accessible description</span><input value={frame.alt} onChange={(event) => updateFrame({ alt: event.target.value })} /></label>
                <button type="button" className={styles.generate} disabled={working === "image" || working === "prompt"} onClick={generateImage}>{working === "image" ? "Generating image…" : frameSource ? "Regenerate storyboard image" : "Generate storyboard image"}</button>
                {message ? <p className={working === "error" ? styles.error : styles.message} role="status">{message}</p> : null}
                <p className={styles.note}>AI is optional. The generated image is saved by the private local server; the prompt and structured reference list can also be used with another image tool.</p>
              </aside>
            </div>
          </section>

          <section id="visual-pitch" data-visual-section="pitch" className={styles.assetSection} tabIndex={-1}>
            <div className={styles.sectionHead}><div><span>Posters, pitch & production references</span><h2>Images that communicate the film beyond the storyboard</h2></div></div>
            <div className={styles.languageGrid}><article><strong>Pitch visual statement</strong><p>{project.review.pitchPackage.visualStatement || "No pitch visual statement yet."}</p></article><article><strong>Poster plan</strong><p>{project.production.distribution.posterPlan || "No poster plan yet."}</p></article><article><strong>Sales materials</strong><p>{project.production.distribution.salesMaterials || "No production or sales image plan yet."}</p></article></div>
          </section>

          <section id="visual-diagnostics" data-visual-section="diagnostics" className={styles.assetSection} tabIndex={-1}>
            <div className={styles.sectionHead}><div><span>Continuity & missing assets</span><h2>A real visual review queue</h2></div><b>{continuityWarnings + missingReferences} open</b></div>
            <div className={styles.diagnosticList}><p><strong>{96 - completed} storyboard frames</strong><span>still need an approved image.</span></p><p><strong>{project.characters.length - characterReferences} character references</strong><span>are missing or not approved.</span></p><p><strong>{project.world.locations.length - locationReferences} location references</strong><span>are missing.</span></p><p><strong>{allFrames.filter((item) => item.src && !item.continuity).length} completed frames</strong><span>need a continuity lock.</span></p></div>
          </section>
        </div>
      </div>
    </div>
  );
}
