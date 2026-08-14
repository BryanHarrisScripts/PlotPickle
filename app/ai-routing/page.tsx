import Link from "next/link";
import AiRoutingPanel from "../ai-routing-panel";
import LocalRuntimePanel from "../local-runtime-panel";

export default function AiRoutingPage() {
  return (
    <main>
      <div style={{ padding: "18px 22px 0", background: "#f4faf9" }}>
        <Link href="/?workspace=settings">← Back to PlotPickle Settings</Link>
      </div>
      <LocalRuntimePanel />
      <details style={{ margin: "0 22px 24px", padding: 14, border: "1px solid #cbd8d5", borderRadius: 10 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Cloud and legacy provider overrides</summary>
        <p style={{ maxWidth: 900, lineHeight: 1.5 }}>
          The hardware-aware OpenAI-compatible router above is PlotPickle&apos;s primary local AI system. Open this compatibility console only to override image/video routes, use cloud providers, or keep an existing Ollama/H3 setup. Ollama is optional and no longer defines the local architecture.
        </p>
        <AiRoutingPanel />
      </details>
    </main>
  );
}
