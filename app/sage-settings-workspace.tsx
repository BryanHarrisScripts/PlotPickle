"use client";

import AgentObservabilityPanel from "./agent-observability-panel";
import DeepSeekHarnessPanel from "./deepseek-harness-panel";
import LocalRuntimePanel from "./local-runtime-panel";
import SageFastModelSetup from "./sage-fast-model-setup";
import styles from "./sage-settings-workspace.module.css";

export default function SageSettingsWorkspace() {
  return (
    <main className={styles.page} aria-label="Sage and PLAN local AI settings">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Settings · Quick Setup</p>
          <h1>Set up Sage and PLAN.</h1>
          <p className={styles.intro}>
            You do not need to understand model files, GPU layers, ports, or command-line tools. PlotPickle will start with the local AI it can already find and keep expert controls out of the way unless you ask for them.
          </p>
        </div>
        <div className={styles.actions}>
          <a className={styles.primaryAction} href="/?workspace=learn">Return to LEARN</a>
          <a className={styles.primaryAction} href="/?workspace=plan">Return to PLAN</a>
          <a className={styles.secondaryAction} href="/ai-routing">Advanced AI routing</a>
        </div>
      </header>

      <section className={styles.quickStart} aria-labelledby="quick-setup-title">
        <div>
          <p className={styles.eyebrow}>Quick Setup</p>
          <h2 id="quick-setup-title">Four simple steps</h2>
        </div>
        <ol className={styles.steps}>
          <li><strong>Step 1:</strong> Choose how you want PlotPickle to talk to local AI.</li>
          <li><strong>Step 2:</strong> Pick the model PlotPickle found.</li>
          <li><strong>Step 3:</strong> Test Sage.</li>
          <li><strong>Step 4:</strong> Test PLAN.</li>
        </ol>
        <p className={styles.note}>For most people, “Use my running local AI” is the right choice. If PlotPickle finds only one suitable model, you can assign it to both Sage and PLAN with one click.</p>
      </section>

      <SageFastModelSetup />
      <AgentObservabilityPanel />

      <details className={styles.advancedRuntime}>
        <summary>Advanced runtime details</summary>
        <p>Open this only when you want hardware, runtime, agent harness, context, or expert routing information.</p>
        <DeepSeekHarnessPanel />
        <LocalRuntimePanel />
      </details>
    </main>
  );
}
