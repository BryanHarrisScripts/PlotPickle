"use client";

import { useEffect, useRef, useState } from "react";
import AiComputeWorkspace from "../settings/compute/ai-compute-workspace";
import H3NativePanel from "../h3-native-panel";
import LocalComfyUiPanel from "./local-comfyui-panel";

const shell: React.CSSProperties = {
  minHeight: "100vh",
  padding: "14px clamp(10px, 2vw, 24px) 28px",
  background: "linear-gradient(180deg, #050605, #080b09 48%, #020302)",
  color: "#ededed",
};

const boundary: React.CSSProperties = {
  margin: "0 0 14px",
  padding: "14px 16px",
  border: "1px solid #287a4b",
  background: "linear-gradient(110deg, #123524, #101310 48%, #080908)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  lineHeight: 1.5,
};

export default function LocalAiSkinHost() {
  const [comfyOpen, setComfyOpen] = useState(false);
  const comfyRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const openComfyUi = (event: Event) => {
      const target = (event as CustomEvent<string>).detail;
      if (target !== "comfyui") return;
      setComfyOpen(true);
      window.requestAnimationFrame(() => comfyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    window.addEventListener("plotpickle:settings-section", openComfyUi);
    return () => window.removeEventListener("plotpickle:settings-section", openComfyUi);
  }, []);

  return (
    <div style={shell} data-skin-v1-local-ai="true">
      <section style={boundary} aria-labelledby="skin-v1-local-ai-title">
        <p style={{ margin: 0, color: "#79bd92", fontSize: 12, letterSpacing: ".08em" }}>PROFILE / LOCAL AI</p>
        <h1 id="skin-v1-local-ai-title" style={{ margin: "5px 0 8px", fontSize: 24 }}>LOCAL AI</h1>
        <p style={{ margin: 0 }}>
          Keep writing, image and video AI on this computer. Opening Local AI does not change an existing route. Choose a ready local route, Off or Manual Import explicitly; PlotPickle does not silently fall back to a paid cloud provider.
        </p>
      </section>

      <AiComputeWorkspace mode="local" />

      <details
        ref={comfyRef}
        open={comfyOpen}
        onToggle={(event) => setComfyOpen(event.currentTarget.open)}
        style={{ marginTop: 16, border: "1px solid #287a4b", background: "#050705" }}
        id="skin-v1-local-comfyui"
      >
        <summary style={{ cursor: "pointer", padding: 14, color: "#79bd92", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>
          COMFYUI / LOCAL IMAGES & VIDEO
        </summary>
        <div style={{ display: "grid", gap: 14, padding: 12 }}>
          <LocalComfyUiPanel />
          <H3NativePanel />
        </div>
      </details>

      <footer style={{ ...boundary, margin: "16px 0 0", color: "#cbd6ce" }}>
        Local model and application downloads may require internet access during installation. Once the required local models are installed, local generation does not require OpenAI, Gemini, MiniMax or other cloud credentials.
      </footer>
    </div>
  );
}
