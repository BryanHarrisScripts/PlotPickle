import Link from "next/link";
import AiRoutingPanel from "../ai-routing-panel";
import LocalRuntimePanel from "../local-runtime-panel";

const sectionStyle = {
  margin: "18px 22px 0",
  padding: 20,
  border: "1px solid rgba(105, 101, 94, 0.32)",
  borderRadius: 12,
  background: "rgba(17, 19, 21, 0.92)",
} as const;

const detailStyle = {
  margin: "14px 22px 0",
  padding: 16,
  border: "1px solid rgba(105, 101, 94, 0.32)",
  borderRadius: 10,
  background: "rgba(11, 14, 14, 0.64)",
  color: "#d6d0c6",
} as const;

export default function AiRoutingPage() {
  return (
    <main style={{ minHeight: "100dvh", background: "#090a0b", color: "#f1eee7", paddingBottom: 24 }}>
      <div style={{ padding: "18px 22px 0" }}>
        <Link href="/?workspace=settings" style={{ color: "#35c9b8" }}>← Back to PlotPickle Settings</Link>
      </div>

      <section style={sectionStyle} aria-labelledby="plain-ai-setup-title">
        <p style={{ margin: 0, color: "#35c9b8", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
          Settings · Advanced AI
        </p>
        <h1 id="plain-ai-setup-title" style={{ margin: "6px 0 10px", fontSize: 28 }}>AI setup, in plain English</h1>
        <p style={{ maxWidth: 900, margin: 0, color: "#b8b1a7", lineHeight: 1.6 }}>
          PlotPickle can make writing, images and video on this computer or through an online AI service. Most writers can leave this page alone after Quick Setup. Open the sections below only when you want to see what PlotPickle found or change where a job is done.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 16 }}>
          <div style={{ padding: 14, border: "1px solid #2b3033", borderRadius: 9, background: "#151819" }}>
            <strong style={{ color: "#f1eee7" }}>On this computer</strong>
            <p style={{ margin: "6px 0 0", color: "#aaa398", lineHeight: 1.45 }}>Private and no per-use AI charge. This is the preferred starting point when your hardware can handle the job.</p>
          </div>
          <div style={{ padding: 14, border: "1px solid #2b3033", borderRadius: 9, background: "#151819" }}>
            <strong style={{ color: "#f1eee7" }}>Online AI</strong>
            <p style={{ margin: "6px 0 0", color: "#aaa398", lineHeight: 1.45 }}>Can be easier or more powerful, but may send project material online and may cost money.</p>
          </div>
          <div style={{ padding: 14, border: "1px solid #2b3033", borderRadius: 9, background: "#151819" }}>
            <strong style={{ color: "#f1eee7" }}>You stay in control</strong>
            <p style={{ margin: "6px 0 0", color: "#aaa398", lineHeight: 1.45 }}>Writing, images and video can each use a different choice. PlotPickle never switches you to a paid service by itself.</p>
          </div>
        </div>
      </section>

      <details style={detailStyle}>
        <summary style={{ cursor: "pointer", fontWeight: 750, color: "#e4c98f" }}>Computer and local AI details</summary>
        <p style={{ maxWidth: 900, lineHeight: 1.5, color: "#aaa398" }}>
          Open this only if you want to see your computer, detected AI programs, model choices or performance settings.
        </p>
        <LocalRuntimePanel />
      </details>

      <details style={{ ...detailStyle, marginBottom: 24 }}>
        <summary style={{ cursor: "pointer", fontWeight: 750, color: "#e4c98f" }}>Cloud and legacy provider overrides</summary>
        <p style={{ maxWidth: 900, lineHeight: 1.5, color: "#aaa398" }}>
          Plain English: use this when you want to choose whether writing, pictures or video are made on your computer or by an online service. The technical provider and model names are shown only so advanced users can verify exactly what is being used.
        </p>
        <AiRoutingPanel />
      </details>
    </main>
  );
}
