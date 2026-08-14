"use client";

import LocalRuntimePanel from "./local-runtime-panel";
import SageFastModelSetup from "./sage-fast-model-setup";
import styles from "./sage-settings-workspace.module.css";

export default function SageSettingsWorkspace() {
  return (
    <main className={styles.page} aria-label="Sage and PLAN local AI settings">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Settings · Local AI</p>
          <h1>Make Sage and PLAN ready.</h1>
          <p className={styles.intro}>
            Sage uses PlotPickle&apos;s Fast local role. PLAN draft proposals use the Quality local role. Configure both here, test them, then return to the story workspace.
          </p>
        </div>
        <div className={styles.actions}>
          <a className={styles.primaryAction} href="/?workspace=learn">Return to LEARN</a>
          <a className={styles.primaryAction} href="/?workspace=plan">Return to PLAN</a>
          <a className={styles.secondaryAction} href="/ai-routing">Advanced AI routing</a>
        </div>
      </header>

      <section className={styles.readiness} aria-labelledby="sage-readiness-title">
        <div>
          <p className={styles.eyebrow}>Local story readiness</p>
          <h2 id="sage-readiness-title">What needs to be green</h2>
        </div>
        <ol>
          <li><strong>Runtime:</strong> llama.cpp is preferred; LM Studio, Ollama, or another OpenAI-compatible local server also works.</li>
          <li><strong>Sage / Fast:</strong> the Fast role must be available before Sage can answer in LEARN.</li>
          <li><strong>PLAN / Quality:</strong> the Quality role must be available before PLAN can draft story-field proposals.</li>
          <li><strong>8 GB GPUs:</strong> managed llama.cpp switches between Fast and Quality on demand instead of keeping both resident.</li>
          <li><strong>Context:</strong> keep 16K for the normal GTX 1080 profile; 32K remains an explicit override.</li>
        </ol>
        <p className={styles.note}>
          Save the model settings below, then use <strong>Load/test Sage Fast</strong> and <strong>Load/test PLAN Quality</strong>. If a model is missing, use <strong>Review missing-runtime and model plan</strong> in the hardware panel for the reviewed local setup path.
        </p>
      </section>

      <SageFastModelSetup />
      <LocalRuntimePanel />
    </main>
  );
}
