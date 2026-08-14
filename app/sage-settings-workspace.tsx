"use client";

import Link from "next/link";
import LocalRuntimePanel from "./local-runtime-panel";
import styles from "./sage-settings-workspace.module.css";

export default function SageSettingsWorkspace() {
  return (
    <main className={styles.page} aria-label="Sage local AI settings">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Settings · Sage Brinewick</p>
          <h1>Make Sage ready to answer.</h1>
          <p className={styles.intro}>
            Sage uses PlotPickle&apos;s Fast local model. Choose a local runtime below, make the Fast model available, then return to LEARN and ask your question again.
          </p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.primaryAction} href="/?workspace=learn">Return to LEARN</Link>
          <Link className={styles.secondaryAction} href="/ai-routing">Advanced AI routing</Link>
        </div>
      </header>

      <section className={styles.readiness} aria-labelledby="sage-readiness-title">
        <div>
          <p className={styles.eyebrow}>Sage readiness</p>
          <h2 id="sage-readiness-title">What needs to be green</h2>
        </div>
        <ol>
          <li><strong>Runtime:</strong> llama.cpp is preferred; LM Studio, Ollama, or another OpenAI-compatible local server also works.</li>
          <li><strong>Fast model:</strong> the Fast role must show <em>installed</em> and be reported by the active runtime.</li>
          <li><strong>Context:</strong> keep 16K for the normal GTX 1080 profile; 32K remains an explicit override.</li>
          <li><strong>Return:</strong> once Runtime shows <em>Ready</em> and Fast shows <em>installed</em>, return to LEARN and Sage will use that model.</li>
        </ol>
        <p className={styles.note}>
          If the Fast model is missing, use <strong>Review missing-runtime and model plan</strong> below. PlotPickle will show the hardware-aware llama.cpp/model path and will not silently download an unreviewed model.
        </p>
      </section>

      <LocalRuntimePanel />
    </main>
  );
}
