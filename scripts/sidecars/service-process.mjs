import process from "node:process";

export function publishSidecarStatus(status) {
  if (typeof process.send !== "function") return;
  process.send({
    kind: "status",
    state: status.state,
    evidence: Array.isArray(status.evidence) ? status.evidence : [],
  });
}

export function parseSidecarArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const next = argv[index + 1];
    values[token.slice(2)] = next && !next.startsWith("--") ? argv[++index] : "1";
  }
  return values;
}

// Contract services remain alive under the launcher supervisor and expose health only.
// Product work continues through the existing authenticated host gateways.
export async function runContractService({ id, descriptor, home, signal = () => false }) {
  const { claimServiceRequests, completeServiceRequest, writeServiceStatus } = await import("../../core/sidecars/runtime/service-bus.mjs");
  await writeServiceStatus(home, id, descriptor);
  publishSidecarStatus(descriptor);
  while (!signal()) {
    for (const item of await claimServiceRequests(home, id)) {
      const health = item.request?.operation === "health";
      await completeServiceRequest(home, id, item, {
        requestId: item.request.requestId,
        state: health ? descriptor.state : "failed",
        evidence: health ? descriptor.evidence : [{ kind: "operation-rejected", summary: "Product requests require the authenticated host gateway.", observedAt: new Date().toISOString() }],
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  await writeServiceStatus(home, id, { state: "stopped", evidence: [] });
}

export async function startContractService(id, createDescriptor) {
  const args = parseSidecarArgs(process.argv.slice(2));
  if (!args.home) throw new Error("Contract service requires PlotPickle home.");
  let stopped = false;
  process.on("SIGINT", () => { stopped = true; });
  process.on("SIGTERM", () => { stopped = true; });
  try {
    await runContractService({ id, descriptor: await createDescriptor(), home: args.home, signal: () => stopped });
  } catch (error) {
    publishSidecarStatus({ state: "degraded", evidence: [{ kind: "startup-error", summary: error.message, observedAt: new Date().toISOString() }] });
    throw error;
  }
}
