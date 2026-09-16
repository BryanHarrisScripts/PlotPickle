"use client";

/* eslint-disable @next/next/no-img-element -- writer-supplied planning references may be local or external sources. */

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  normalizePlotPickleProject,
  type PlotPickleProject,
  type VisualReference,
} from "@/lib/projects/project";
import { registerProjectAssetSource } from "@/lib/projects/persistence/project-assets";
import styles from "./preproduction-visual-thinking.module.css";

const STORAGE_KEY = "plotpickle.project.v1";
const SKETCH_WIDTH = 480;
const SKETCH_HEIGHT = 270;

type VisualTarget = {
  readonly kind: "project" | "block";
  readonly id: string;
  readonly label: string;
};

function newId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function routeBlockNumber() {
  const number = Number(new URLSearchParams(window.location.search).get("block") || 0);
  return Number.isFinite(number) && number >= 1 && number <= 24 ? Math.trunc(number) : null;
}

function resolveTarget(project: PlotPickleProject): VisualTarget {
  const number = routeBlockNumber();
  const block = number ? project.blocks.find((candidate) => candidate.number === number) : null;
  return block
    ? { kind: "block", id: block.id, label: `Block ${String(block.number).padStart(2, "0")} · ${block.title}` }
    : { kind: "project", id: project.id, label: project.metadata.title || "Current project" };
}

function isUsableReferenceSource(value: string) {
  return /^(https?:\/\/|\/assets\/|\/api\/local-ai\/assets\/)/i.test(value.trim());
}

export default function PreproductionVisualThinking() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [project, setProject] = useState<PlotPickleProject | null>(null);
  const [target, setTarget] = useState<VisualTarget | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [referenceTitle, setReferenceTitle] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [status, setStatus] = useState("Rough visuals are planning evidence only.");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const normalized = stored ? normalizePlotPickleProject(JSON.parse(stored)) : null;
      if (!normalized) {
        setStatus("Open or save an Outline project before capturing visual thinking.");
        return;
      }
      setProject(normalized);
      setTarget(resolveTarget(normalized));
    } catch {
      setStatus("The current Outline project could not be read.");
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#111111";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
  }, []);

  const targetReferences = useMemo(() => {
    if (!project || !target) return [];
    return project.development.visualReferences.filter((reference) => (
      reference.targetKind === target.kind && reference.targetId === target.id
    ));
  }, [project, target]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function startDrawing(event: PointerEvent<HTMLCanvasElement>) {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = point(event);
    context.beginPath();
    context.moveTo(next.x, next.y);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const next = point(event);
    context.lineTo(next.x, next.y);
    context.stroke();
  }

  function stopDrawing(event: PointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function clearSketch() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#111111";
    setStatus("Sketch cleared. Nothing was removed from the project.");
  }

  function saveVisual(source: string, sourceType: VisualReference["sourceType"], title: string, importFileName = "") {
    if (!project || !target) return;
    const now = new Date().toISOString();
    const referenceId = newId("visual-reference");
    const label = title.trim() || (sourceType === "manual-import" ? "Rough pre-production sketch" : "Pre-production reference");
    const registered = registerProjectAssetSource(project.assets, {
      target: { kind: "other", id: `preproduction-visual:${target.kind}:${target.id}` },
      source,
      kind: "image",
      label,
      mediaType: source.startsWith("data:image/webp") ? "image/webp" : undefined,
      variationExtensions: {
        preproductionRole: "rough-visual-thinking",
        planningEvidence: true,
        targetKind: target.kind,
        targetId: target.id,
        targetLabel: target.label,
        visualReferenceId: referenceId,
      },
      provenanceIds: [`visual-reference:${referenceId}`],
      approval: "unreviewed",
      updatedAt: now,
    });

    if (!registered.reference) {
      setStatus("That visual source could not be registered.");
      return;
    }

    const reference: VisualReference = {
      id: referenceId,
      title: label,
      sourceUrl: source,
      importFileName,
      sourceType,
      purpose: sourceType === "manual-import" ? "composition" : "inspiration",
      rightsStatus: sourceType === "manual-import" ? "owned" : "unknown",
      ownershipNotes: sourceType === "manual-import" ? "Writer-created rough sketch." : "Review source rights before production use.",
      permittedUse: "Pre-production planning reference only; not Storyboard canon or production approval.",
      attribution: "",
      targetKind: target.kind,
      targetId: target.id,
      targetLabel: target.label,
      notes: decisionNote.trim(),
      createdAt: now,
      updatedAt: now,
    };

    const next: PlotPickleProject = {
      ...project,
      metadata: { ...project.metadata, updatedAt: now },
      development: {
        ...project.development,
        visualReferences: [...project.development.visualReferences, reference],
      },
      assets: registered.registry,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setProject(next);
    setDecisionNote("");
    setReferenceTitle("");
    setReferenceUrl("");
    setStatus(`${label} saved as unreviewed planning evidence. Storyboard canon was not changed.`);
  }

  function saveSketch() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const source = canvas.toDataURL("image/webp", 0.72);
    saveVisual(source, "manual-import", referenceTitle || "Rough pre-production sketch", `rough-sketch-${Date.now()}.webp`);
  }

  function saveReference() {
    if (!isUsableReferenceSource(referenceUrl)) {
      setStatus("Enter an http(s), /assets/, or local PlotPickle asset reference.");
      return;
    }
    saveVisual(referenceUrl.trim(), "link", referenceTitle || "Pre-production visual reference");
  }

  return (
    <details className={styles.panel}>
      <summary>
        <span>VISUALIZE</span>
        <strong>Rough visual thinking</strong>
        <small>{target?.label ?? "Current Outline context"}</small>
      </summary>
      <div className={styles.body}>
        <header className={styles.intro}>
          <div>
            <span>CREATE · LEARN · VISUALIZE</span>
            <h2>Sketch the question before you make the picture.</h2>
            <p>Use a fast black-and-white sketch or a reference link to clarify intent. Saved media stays unreviewed planning evidence until a later Human decision promotes anything downstream.</p>
          </div>
          <strong>{targetReferences.length} reference{targetReferences.length === 1 ? "" : "s"} at this scope</strong>
        </header>

        <label className={styles.note}>
          <span>What should this rough visual help you decide?</span>
          <textarea
            rows={3}
            value={decisionNote}
            onChange={(event) => setDecisionNote(event.target.value)}
            placeholder="Example: Does the opening image make the character feel isolated without revealing the locked room yet?"
          />
        </label>

        <div className={styles.captureGrid}>
          <section className={styles.sketchArea} aria-label="Black-and-white rough sketch">
            <header><strong>Quick sketch</strong><span>Black + white only</span></header>
            <canvas
              ref={canvasRef}
              aria-label="Draw a rough pre-production sketch"
              height={SKETCH_HEIGHT}
              width={SKETCH_WIDTH}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
            />
            <div className={styles.actions}>
              <button type="button" onClick={clearSketch}>Clear</button>
              <button type="button" onClick={saveSketch} disabled={!project}>Save rough sketch</button>
            </div>
          </section>

          <section className={styles.referenceArea} aria-label="Reference capture">
            <header><strong>Reference</strong><span>Planning vocabulary, not canon</span></header>
            <label>Title<input value={referenceTitle} onChange={(event) => setReferenceTitle(event.target.value)} placeholder="Opening image reference" /></label>
            <label>Image / asset URL<input value={referenceUrl} onChange={(event) => setReferenceUrl(event.target.value)} placeholder="https://… or /assets/…" /></label>
            <button type="button" onClick={saveReference} disabled={!project}>Save reference</button>
          </section>
        </div>

        {targetReferences.length ? (
          <div className={styles.saved} aria-label="Saved planning references">
            {targetReferences.slice(-4).reverse().map((reference) => (
              <article key={reference.id}>
                {isUsableReferenceSource(reference.sourceUrl) || reference.sourceUrl.startsWith("data:image/")
                  ? <img src={reference.sourceUrl} alt="" />
                  : <div aria-hidden="true" className={styles.placeholder}>REF</div>}
                <div><strong>{reference.title}</strong><span>{reference.purpose} · {reference.rightsStatus}</span><p>{reference.notes || "No decision note."}</p></div>
              </article>
            ))}
          </div>
        ) : null}

        <p className={styles.status} role="status">{status}</p>
      </div>
    </details>
  );
}
