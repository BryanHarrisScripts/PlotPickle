import Link from "next/link";
import AiRoutingPanel from "../ai-routing-panel";
import LocalRuntimePanel from "../local-runtime-panel";

export default function AiRoutingPage() {
  return (
    <main style={{ minHeight: "100dvh", background: "#090a0b", color: "#f1eee7", paddingBottom: 24 }}>
      <div style={{ padding: "18px 22px 0" }}>
        <Link href="/?workspace=settings" style={{ color: "#35c9b8" }}>← Back to PlotPickle Settings</Link>
      </div>
      <LocalRuntimePanel />
      <details style={{ margin: "0 22px 24px", padding: 14, border: "1px solid rgba(105, 101, 94, 0.32)", borderRadius: 10, background: "rgba(11, 14, 14, 0.64)", color: "#d6d0c6" }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, color: "#e4c98f" }}>Cloud and legacy provider overrides</summary>
        <p style={{ maxWidth: 900, lineHeight: 1.5, color: "#aaa398" }}>
          The hardware-aware OpenAI-compatible router above is PlotPickle&apos;s primary local AI system. Open this compatibility console only to override image/video routes, use cloud providers, or keep an existing Ollama/H3 setup. Ollama is optional and no longer defines the local architecture.
        </p>
        <AiRoutingPanel />
      </details>
    </main>
  );
}
