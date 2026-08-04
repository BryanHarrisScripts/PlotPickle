import Link from "next/link";
import AiRoutingPanel from "../ai-routing-panel";

export default function AiRoutingPage() {
  return (
    <main>
      <div style={{ padding: "18px 22px 0", background: "#f4faf9" }}>
        <Link href="/?workspace=settings">← Back to PlotPickle Settings</Link>
      </div>
      <AiRoutingPanel />
    </main>
  );
}
