import { readFileSync, writeFileSync } from "node:fs";

const path = "app/review-workflows-panel.tsx";
let source = readFileSync(path, "utf8");

const providerState = '  const [provider, setProvider] = useState<AiProviderSnapshot>({ connected: false, provider: "", model: "", checkedAt: "" });\n';
if (!source.includes(providerState)) throw new Error("Provider state anchor is missing.");
source = source.replace(providerState, `${providerState}  const [providerMode, setProviderMode] = useState<"local" | "connected">("connected");\n`);

const disconnected = '        setConnectionMessage(connected ? `${value.provider} · ${value.textModel}` : "No provider is connected. Requests can still be prepared locally.");';
if (!source.includes(disconnected)) throw new Error("Connection result anchor is missing.");
source = source.replace(disconnected, `${disconnected}\n        if (!connected) setProviderMode("local");`);

const catchNeedle = '        setProvider({ connected: false, provider: "", model: "", checkedAt: "" });\n        setConnectionMessage(error instanceof Error ? error.message : "No provider is connected.");';
if (!source.includes(catchNeedle)) throw new Error("Connection catch anchor is missing.");
source = source.replace(catchNeedle, '        setProvider({ connected: false, provider: "", model: "", checkedAt: "" });\n        setProviderMode("local");\n        setConnectionMessage(error instanceof Error ? error.message : "No provider is connected.");');

const requestProvider = '      provider,\n    });';
if (!source.includes(requestProvider)) throw new Error("AI request provider anchor is missing.");
source = source.replace(requestProvider, '      provider: providerMode === "connected" ? provider : { connected: false, provider: "", model: "", checkedAt: "" },\n    });');

const customQuestion = '        <label className={styles.wideField}><span>Custom questions · one per line</span><textarea rows={3} value={questions} onChange={(event) => { setQuestions(event.target.value); setRequest(null); setResult(null); }} placeholder="What remains unclear to an audience reader?" /></label>';
if (!source.includes(customQuestion)) throw new Error("AI workflow form anchor is missing.");
const providerChoice = '        <label><span>Provider / model</span><select value={providerMode} onChange={(event) => { setProviderMode(event.target.value as "local" | "connected"); setRequest(null); setResult(null); setAcknowledged(false); }}><option value="local">Local prompt only · no submission</option><option value="connected" disabled={!provider.connected}>{provider.connected ? `${provider.provider} · ${provider.model}` : "No connected provider"}</option></select></label>\n';
source = source.replace(customQuestion, `${providerChoice}${customQuestion}`);

source = source.replace('disabled={!provider.connected || !acknowledged || state === "working"}', 'disabled={providerMode !== "connected" || !provider.connected || !acknowledged || state === "working"}');
source = source.replace('{state === "working" ? "Reviewing…" : provider.connected ? "Submit AI review" : "Connect a provider in Settings to submit"}', '{state === "working" ? "Reviewing…" : providerMode === "local" ? "Local prompt only · no submission" : provider.connected ? "Submit AI review" : "Connect a provider in Settings to submit"}');

writeFileSync(path, source, "utf8");
console.log("Added explicit local-versus-connected provider selection.");
