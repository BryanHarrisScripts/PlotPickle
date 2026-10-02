// Registration is local metadata, not evidence of a successful model response.
export function reportStartupAgentInventory(status, write = console.log) {
  const registered = new Set(status.agents || []);
  const runtimeReady = status.ready === true && status.runtime === "mastra" && status.mode === "embedded";
  const sageReady = runtimeReady && registered.has("curriculum-guide");
  const foundationsReady = runtimeReady && registered.has("foundations-planner");
  const healthy = runtimeReady && sageReady && foundationsReady;
  write("PlotPickle - Agent Runtime Inventory");
  write(`Mastra embedded runtime: ${runtimeReady ? "READY" : "UNAVAILABLE"}`);
  write(`Sage registration: ${sageReady ? "READY" : "UNAVAILABLE"}`);
  write(`Foundations Planner registration: ${foundationsReady ? "READY" : "UNAVAILABLE"}`);
  write("Inference tests: NOT RUN (explicit diagnostics only)");
  write(`RUNTIME INVENTORY: ${healthy ? "READY" : "NEEDS ATTENTION"}`);
  return { healthy, inferenceAttempted: false };
}
