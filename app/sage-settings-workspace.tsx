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
            Sage uses PlotPickle&apos;s Fast local role. PLAN draft proposals use the Quality local role. If Ollama or LM Studio is already running, choose models it actually reports. Use GGUF file paths only when you intentionally choose PlotPickle-managed llama.cpp.
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
          <li><strong>Running runtime:</strong> if PlotPickle detects Ollama, LM Studio, llama.cpp, or another compatible server, use the detected-runtime mode and select exact reported model IDs.</li>
          <li><strong>Sage / Fast:</strong> assign one reported model to the Fast role before Sage can answer in LEARN.</li>
          <li><strong>PLAN / Quality:</strong> assign one reported model to the Quality role before PLAN can draft story-field proposals. The same model may be used temporarily for both roles.</li>
          <li><strong>Managed llama.cpp:</strong> choose this mode only when you have real GGUF files on disk. PlotPickle will then switch Fast and Quality models on demand.</li>
          <li><strong>Context:</strong> keep 16K for the normal GTX 1080 profile; 32K remains an explicit override.</li>
        </ol>
        <p className={styles.note}>
          Save the setup below, then test Sage Fast and PLAN Quality. A test now follows the selected runtime; it no longer tries to open a llama.cpp GGUF path when Ollama or LM Studio is the runtime you are using.
        </p>
      </section>

      <SageFastModelSetup />
      <LocalRuntimePanel />
    </main>
  );
}