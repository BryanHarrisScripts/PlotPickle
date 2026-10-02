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
