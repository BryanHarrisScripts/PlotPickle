import { appendFileSync } from "node:fs";
import path from "node:path";

// Used only by the isolated Windows launcher proof, after reviewed provisioning.
const root = process.env.PLOTPICKLE_2698_AUDIT_ROOT;
if (root) {
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const method = String(options?.method || input?.method || "GET").toUpperCase();
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    const inference = /\/(chat\/completions|completions|generate|api\/chat|api\/generate)$/.test(url.pathname);
    appendFileSync(path.join(root, `${process.pid}.jsonl`), JSON.stringify({ method, host: url.hostname, path: url.pathname, loopback, inference }) + "\n");
    if (!loopback || inference) throw new Error("Windows startup proof detected an unrequested remote or inference fetch.");
    return nativeFetch(input, options);
  };
}
