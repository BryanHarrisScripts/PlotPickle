import { minimalChatGptGatewayPrototype } from "../../core/sidecars/chatgpt-mcp-gateway-contract.mjs";
import { startContractService } from "./service-process.mjs";

await startContractService("chatgpt-mcp-gateway", async () => {
  const contract = minimalChatGptGatewayPrototype();
  if (!contract.tools.every((tool) => tool.readOnly)) throw new Error("Gateway must remain read-only.");
  return { state: "ready", evidence: [{ kind: "local-contract-loaded", summary: `${contract.tools.length} read-only resource contracts loaded. External transport disconnected; no tunnel, listener or authentication session opened.`, observedAt: new Date().toISOString() }] };
});
