"use client";

/* eslint-disable @next/next/no-img-element -- Storyboard assets are served by PlotPickle's private local gateway or supplied by the writer. */

import { useMemo, useState } from "react";
import { createStoryboardFrame, type MiniBlock, type PlotPickleProject, type StoryBlock, type StoryScene, type VisualFrame } from "@/lib/project";
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

export default function VisualStoryboard({
  project,
  initialBlockNumber,
  visualAct,
  onVisualActChange,
  onOpenPlannerBlock,
  onChange,
}: {
  project: PlotPickleProject;
  initialBlockNumber: number;
  visualAct: number;
  onVisualActChange: (act: number) => void;
  onOpenPlannerBlock: (number: number) => void;
  onChange: (project: PlotPickleProject) => void;
}) {
  const [mode, setMode] = useState<BoardMode>("blocks");
  const [blockNumber, setBlockNumber] = useState(initialBlockNumber);
  const [miniBlockNumber, setMiniBlockNumber] = useState(1);
  const [working, setWorking] = useState<WorkingState>("idle");
  const [message, setMessage] = useState("");

  const block = project.blocks[blockNumber - 1] ?? project.blocks[0];
  const mini = miniBlockFor(block, miniBlockNumber);
  const scene = sceneFor(block, miniBlockNumber);
  const frame = primaryFrame(block, miniBlockNumber);
  const prompt = useMemo(() => storyboardPrompt(project, block, scene, mini, frame), [project, block, scene, mini, frame]);
  const identityInputs = useMemo(() => storyboardIdentityInputs(project, block, scene, mini), [project, block, scene, mini]);
  const identityWarnings = identityInputs.filter((identity) => identity.diagnostic.severity !== "clear");
  const visibleBlocks = visualAct ? project.blocks.filter((item) => item.act === visualAct) : project.blocks;
  const visibleMinis = visibleBlocks.flatMap((item) => [1, 2, 3, 4].map((number) => ({ block: item, mini: miniBlockFor(item, number), frame: primaryFrame(item, number) })));
  const completed = project.blocks.flatMap((item) => [1, 2, 3, 4].map((number) => primaryFrame(item, number))).filter((item) => item.src).length;
  const prompted = project.blocks.flatMap((item) => [1, 2, 3, 4].map((number) => primaryFrame(item, number))).filter((item) => item.prompt).length;

  function choose(blockNumberValue: number, miniBlockNumberValue = 1) {
    setBlockNumber(blockNumberValue);
    setMiniBlockNumber(miniBlockNumberValue);
    setMode("minis");
    setWorking("idle");
    setMessage("");
  }

  function updateFrame(patch: Partial<VisualFrame>) {
    onChange({
      ...project,
      blocks: project.blocks.map((item) => item.number === block.number ? {
        ...item,
        visuals: item.visuals.some((visual) => visual.id === frame.id)
          ? item.visuals.map((visual) => visual.id === frame.id ? { ...visual, ...patch, miniBlockNumber } : visual)
          : [...item.visuals, { ...frame, ...patch, miniBlockNumber }],
      } : item),
    });
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
        <div><span>Visual Storyboard</span><h1>Put the entire movie in front of you.</h1><p>Move from the 24-block overview into all 96 mini-block visuals. PlotPickle builds each prompt from the story and approved character identities you have already developed.</p></div>
        <div className={styles.progress}><strong>{completed}<small>/96 images</small></strong><div><i style={{ width: `${Math.round((completed / 96) * 100)}%` }} /></div><span>{prompted} edited prompts</span></div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.modeSwitch}><button type="button" className={mode === "blocks" ? styles.active : ""} onClick={() => setMode("blocks")}>24 Blocks</button><button type="button" className={mode === "minis" ? styles.active : ""} onClick={() => setMode("minis")}>96 Mini-blocks</button></div>
        <div className={styles.actFilter}>{[0, 1, 2, 3, 4].map((act) => <button type="button" className={visualAct === act ? styles.active : ""} key={act} onClick={() => onVisualActChange(act)}>{act ? `Act ${act}` : "All acts"}</button>)}</div>
      </div>

      <div className={styles.workspace}>
        <main className={styles.board}>
          {mode === "blocks" ? <div className={styles.blockGrid}>{visibleBlocks.map((item) => {
            const frames = [1, 2, 3, 4].map((number) => primaryFrame(item, number));
            const hero = frames.find((visual) => visual.src);
            const count = frames.filter((visual) => visual.src).length;
            return <button type="button" className={`${styles.blockCard} ${styles[`act${item.act}`]} ${item.number === block.number ? styles.selected : ""}`} key={item.id} onClick={() => choose(item.number)}>
              <div className={styles.blockImage}>{hero?.src ? <img src={hero.src} alt={hero.alt || `Block ${item.number}`} /> : <span>{String(item.number).padStart(2, "0")}</span>}<b>{count}/4</b></div>
              <div><small>Block {item.number} · Sequence {item.sequenceNumber}</small><strong>{item.title}</strong><p>{item.summary || item.purpose}</p></div>
              <div className={styles.miniDots}>{frames.map((visual, index) => <i className={visual.src ? styles.done : visual.prompt ? styles.ready : ""} key={visual.id || index} />)}</div>
            </button>;
          })}</div> : <div className={styles.miniGrid}>{visibleMinis.map(({ block: item, mini: itemMini, frame: itemFrame }) => <button type="button" className={`${styles.miniCard} ${item.number === block.number && itemMini.number === miniBlockNumber ? styles.selected : ""}`} key={`${item.id}-${itemMini.number}`} onClick={() => choose(item.number, itemMini.number)}>
            <div className={styles.miniImage}>{itemFrame.src ? <img src={itemFrame.src} alt={itemFrame.alt || `Block ${item.number}.${itemMini.number}`} /> : <span><b>{item.number}.{itemMini.number}</b><small>{itemMini.label}</small></span>}</div>
            <div><small>Act {item.act} · Block {item.number}</small><strong>{itemMini.label}</strong><p>{itemMini.visualBeat || itemMini.purpose || itemMini.function}</p><em>{itemFrame.src ? "Image complete" : itemFrame.prompt ? "Prompt ready" : "Ready to develop"}</em></div>
          </button>)}</div>}
        </main>

        <aside className={styles.inspector}>
          <p><strong>Current approved storyboard</strong> frames remain separate from historical source art.</p>
          <AfterglowLegacyVisuals project={project} mode="block" blockNumber={block.number} />
          <div className={styles.inspectorHead}><div><span>Selected visual</span><h2>Block {block.number}.{miniBlockNumber}</h2><strong>{block.title} · {mini.label}</strong></div><button type="button" onClick={() => onOpenPlannerBlock(block.number)}>Open story block</button></div>
          <div className={styles.turnStrip}>{[1, 2, 3, 4].map((number) => { const itemMini = miniBlockFor(block, number); const itemFrame = primaryFrame(block, number); return <button type="button" className={number === miniBlockNumber ? styles.active : ""} onClick={() => setMiniBlockNumber(number)} key={number}><span>{number}</span><strong>{itemMini.label}</strong><i className={itemFrame.src ? styles.done : itemFrame.prompt ? styles.ready : ""} /></button>; })}</div>
          <div className={styles.context}><small>Scene purpose</small><p>{scene.purpose || "Add the scene purpose in the Structure Map or Block editor."}</p><small>Mini-block purpose</small><p>{mini.visualBeat || mini.purpose || mini.function}</p></div>
          {identityInputs.length ? <div className={styles.context}><small>Character identity status</small>{identityInputs.map((identity) => <p key={identity.characterId}><strong>{identity.name}</strong> · {identity.status} v{identity.version} · {identity.referenceImages.length} approved reference{identity.referenceImages.length === 1 ? "" : "s"}{identity.diagnostic.severity !== "clear" ? ` — ${identity.diagnostic.message}` : ""}</p>)}</div> : null}
          {identityWarnings.length ? <p className={styles.note}><strong>Identity review needed:</strong> {identityWarnings.map((identity) => identity.name).join(", ")}. The prompt includes the available draft identity, but lock a master identity in Characters for dependable continuity.</p> : null}
          <div className={styles.preview}>{frame.src ? <img src={frame.src} alt={frame.alt || `Block ${block.number}.${miniBlockNumber} storyboard`} /> : <div><strong>No image yet</strong><span>The complete default prompt is ready below.</span></div>}</div>
          <label><span>Image prompt</span><textarea rows={12} value={frame.prompt || prompt} onChange={(event) => updateFrame({ prompt: event.target.value })} /></label>
          <div className={styles.promptActions}><button type="button" onClick={() => updateFrame({ prompt })}>Rebuild from story</button><button type="button" onClick={copyPrompt}>Copy prompt</button><button type="button" disabled={working === "prompt" || working === "image"} onClick={refinePrompt}>{working === "prompt" ? "Refining…" : "Refine with AI"}</button></div>
          <label><span>Shot and lens</span><input value={frame.shot} onChange={(event) => updateFrame({ shot: event.target.value })} placeholder="Wide two-shot, 35mm lens, low eye line…" /></label>
          <label><span>Continuity lock</span><textarea rows={3} value={frame.continuity} onChange={(event) => updateFrame({ continuity: event.target.value })} placeholder="Wardrobe, props, injuries, time of day, screen direction…" /></label>
          <label><span>Caption</span><input value={frame.caption} onChange={(event) => updateFrame({ caption: event.target.value })} placeholder="What changes in this image?" /></label>
          <label><span>Accessible description</span><input value={frame.alt} onChange={(event) => updateFrame({ alt: event.target.value })} /></label>
          <button type="button" className={styles.generate} disabled={working === "image" || working === "prompt"} onClick={generateImage}>{working === "image" ? "Generating image…" : frame.src ? "Regenerate storyboard image" : "Generate storyboard image"}</button>
          {message ? <p className={working === "error" ? styles.error : styles.message} role="status">{message}</p> : null}
          <p className={styles.note}>AI is optional. The generated image is saved by the private local server; the prompt and structured reference list can also be used with another image tool.</p>
        </aside>
      </div>
    </div>
  );
}
