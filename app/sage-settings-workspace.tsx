"use client";

import AgentObservabilityPanel from "./agent-observability-panel";
import AiRoutingPanel from "./ai-routing-panel";
import BuzzLiveHealthCard from "./buzz-live-health-card";
import DeepSeekHarnessPanel from "./deepseek-harness-panel";
import LocalRuntimePanel from "./local-runtime-panel";
import SageFastModelSetup from "./sage-fast-model-setup";
import styles from "./sage-settings-workspace.module.css";

const SETTINGS_CATEGORIES = [
  { id: "settings-quick", label: "Quick Setup", detail: "The simple four-step path" },
  { id: "settings-models", label: "Models & Agents", detail: "Sage and PLAN local AI" },
  { id: "settings-activity", label: "Agent Activity & BUZZ", detail: "Runtime and Guildhall health" },
  { id: "settings-routing", label: "AI Routing", detail: "Choose where writing, images and video run" },
  { id: "settings-advanced", label: "Advanced Runtime", detail: "Hardware and expert details" },
] as const;

export default function SageSettingsWorkspace() {
  return (
    <main
      aria-label="Sage and PLAN local AI settings"
      className={styles.page}
      data-plotpickle-settings="v2"
    >
      <aside data-settings-rail="navigation">
        <header>
          <p>Settings</p>
          <h2>Configure PlotPickle</h2>
          <span>Choose a category, make the change in the centre, and keep context visible on the right.</span>
        </header>
        <nav aria-label="Settings categories">
          {SETTINGS_CATEGORIES.map((category) => (
            <a href={`#${category.id}`} key={category.id}>
              <strong>{category.label}</strong>
              <span>{category.detail}</span>
            </a>
          ))}
        </nav>
      </aside>

      <section data-settings-main>
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
            <a className={styles.secondaryAction} href="#settings-routing">Advanced AI routing</a>
          </div>
        </header>

        <section className={styles.quickStart} data-settings-section id="settings-quick" aria-labelledby="quick-setup-title">
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

        <section data-settings-section id="settings-models">
          <SageFastModelSetup />
        </section>

        <section data-settings-section id="settings-activity">
          <AgentObservabilityPanel />
          <BuzzLiveHealthCard />
        </section>

        <section data-settings-section id="settings-routing" aria-label="Advanced AI routing">
          <AiRoutingPanel />
        </section>

        <section data-settings-section id="settings-advanced">
          <details className={styles.advancedRuntime}>
            <summary>Advanced runtime details</summary>
            <p>Open this only when you want hardware, runtime, agent harness, context, or expert runtime information. AI provider routing is configured in the dedicated AI Routing section above so the hardware view is not repeated.</p>
            <DeepSeekHarnessPanel />
            <LocalRuntimePanel />
          </details>
        </section>
      </section>

      <aside aria-label="Settings help and status" data-settings-rail="context">
        <section>
          <p>Persistent help</p>
          <h2>Change one thing at a time.</h2>
          <span>The centre column owns the actual controls. The left column gets you to the category; this rail explains what the category affects without sending you around another loop.</span>
        </section>
        <section>
          <p>AI Routing</p>
          <h3>One active choice per job.</h3>
          <span>Writing, images and video each use one route at a time. Choose the route you want; unavailable choices show what must be configured or tested first. Ollama is optional and no longer defines the local architecture.</span>
        </section>
        <section>
          <p>Agent Activity</p>
          <h3>See what is actually running.</h3>
          <span>Use Agent Activity to confirm Sage, PLAN, Wyrmwood and developer-worker state instead of guessing whether a selector or model change took effect.</span>
        </section>
        <section>
          <p>BUZZ / Guildhall</p>
          <h3>Coordination, not another brain.</h3>
          <span>BUZZ carries signed community and Guildhall activity. Mastra remains the PlotPickle product-agent runtime; PPF remains the creative record.</span>
        </section>
        <section>
          <p>Safety</p>
          <h3>Local stays local unless you choose otherwise.</h3>
          <small>PlotPickle does not silently turn a failed local model into a paid cloud request. Advanced routing remains an explicit choice.</small>
        </section>
      </aside>
    </main>
  );
}
