"use client";

/* eslint-disable @next/next/no-img-element -- Local generated assets are served by PlotPickle's loopback gateway. */

import { useMemo, useState } from "react";
import type { Character, PlotPickleProject } from "@/lib/project";
import styles from "./character-image-generator.module.css";

type ImageResponse = { assetUrl?: string; revisedPrompt?: string; message?: string };

export default function CharacterImageGenerator({ project, character, onImage }: { project: PlotPickleProject; character: Character; onImage: (value: string) => void }) {
  const identityPrompt = useMemo(() => [
    `Create a consistent cinematic character reference portrait for ${character.name}.`,
    character.role && `Story role: ${character.role}.`,
    character.description && `Physical and personal description: ${character.description}.`,
    character.originEnvironment && `Origin environment: ${character.originEnvironment}.`,
    character.socialContext && `Social context: ${character.socialContext}.`,
    character.strengths && `Visible bearing: ${character.strengths}.`,
    project.world.period && `Period: ${project.world.period}.`,
    project.world.visualLanguage && `Project visual language: ${project.world.visualLanguage}.`,
    "Single character, neutral three-quarter pose, clear face, production-reference lighting, no text, no border. Preserve these identity details for future images.",
  ].filter(Boolean).join(" "), [character, project.world.period, project.world.visualLanguage]);
  const [prompt, setPrompt] = useState(identityPrompt);
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState("");

  async function generate() {
    if (!prompt.trim() || state === "working") return;
    setState("working");
    setMessage("Generating and saving the reference image locally…");
    try {
      const response = await fetch("/api/local-ai/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), characterId: character.id }),
      });
      const result = await response.json() as ImageResponse;
      if (!response.ok || !result.assetUrl) throw new Error(result.message || "The image provider returned no image.");
      onImage(result.assetUrl);
      setState("idle");
      setMessage("Character reference generated and attached. Keep the description stable to guide future images.");
      if (result.revisedPrompt) setPrompt(result.revisedPrompt);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Character image generation is unavailable.");
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.heading}><div><span>Optional AI image</span><h3>Character reference and consistency</h3><p>The prompt is built from this character and the project world. The generated portrait is saved on this computer and becomes the character thumbnail.</p></div>{character.image ? <img src={character.image} alt={`${character.name} reference`} /> : null}</div>
      <label><span>Reference prompt</span><textarea rows={5} value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label>
      <div className={styles.actions}><button type="button" onClick={() => setPrompt(identityPrompt)}>Rebuild from character</button><button type="button" className={styles.generate} disabled={state === "working" || !prompt.trim()} onClick={generate}>{state === "working" ? "Generating…" : character.image ? "Generate a new reference" : "Generate character image"}</button></div>
      {message ? <p className={state === "error" ? styles.error : styles.status} role="status">{message}</p> : null}
      <small>Requires an image-capable provider connected in Settings. Nothing is generated without your request.</small>
    </section>
  );
}
