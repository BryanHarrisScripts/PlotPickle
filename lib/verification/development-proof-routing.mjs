import { pathMatches } from "./verification-core.mjs";

const COMMIT_SHA = /^[0-9a-f]{40}$/iu;
const unique = (items) => [...new Set(items)];

export function validateProofRouting(contract) {
  const errors = [];
  if (contract?.schemaVersion !== 1 || contract?.authority !== "config/verification/ownership-map.json") {
    errors.push("Proof routing must extend the canonical verification ownership map.");
  }
  if (!contract?.proofs || !Array.isArray(contract?.classes)) return [...errors, "Proof routing needs proofs and classes."];
  const ids = new Set();
  for (const route of contract.classes) {
    if (!route?.id || ids.has(route.id)) errors.push(`Duplicate or missing class: ${route?.id}`);
    ids.add(route.id);
    if (!Array.isArray(route.paths) || !route.paths.length) errors.push(`${route.id} needs path patterns.`);
    for (const proof of route.proofs || []) if (!contract.proofs[proof]) errors.push(`${route.id} refers to unknown proof ${proof}.`);
  }
  for (const [id, proof] of Object.entries(contract.proofs)) {
    if (!["deterministic", "product"].includes(proof.kind)) errors.push(`${id} has an invalid proof kind.`);
  }
  return errors;
}

export function resolveProofRoute({ changedFiles = [], classes = [], contract, ownershipPlan }) {
  const errors = validateProofRouting(contract);
  if (errors.length) throw new Error(errors.join("\n"));
  const files = unique(changedFiles.map((file) => String(file).replaceAll("\\", "/")));
  const selected = contract.classes.filter((route) =>
    classes.includes(route.id) || files.some((file) => route.paths.some((pattern) => pathMatches(pattern, file)))
  );
  const unknown = classes.filter((id) => !contract.classes.some((route) => route.id === id));
  if (unknown.length) throw new Error(`Unknown proof classes: ${unknown.join(", ")}`);
  const codeFiles = files.filter((file) => !file.startsWith("docs/") && !file.endsWith(".md") && !file.startsWith("tests/"));
  const documentationOnly = files.length > 0 && !codeFiles.length && classes.length === 0;
  const selectedClasses = documentationOnly ? selected.filter((route) => route.id === "documentation") : selected;
  const proofIds = unique(selectedClasses.flatMap((route) => route.proofs));
  const productProofs = proofIds.filter((id) => contract.proofs[id].kind === "product");
  return {
    status: ownershipPlan?.status === "blocked" ? "blocked" : "ready",
    classes: selectedClasses.map((route) => route.id),
    deterministicProofs: proofIds.filter((id) => contract.proofs[id].kind === "deterministic"),
    productProofs,
    productProofStatus: productProofs.length ? "UNPROVEN" : "NOT_REQUIRED",
    note: "A planned proof is not observed evidence. Existing architecture verification remains the test and CI authority.",
  };
}

export function assessProductProof({ route, evidence = [], testedCommit, verifiedArtifactRefs = [] }) {
  if (!route.productProofs.length) return { status: "NOT_REQUIRED", missing: [] };
  const trustedRefs = new Set(verifiedArtifactRefs);
  const validObservation = (record) => record?.testedCommit === testedCommit && COMMIT_SHA.test(testedCommit || "") &&
    typeof record?.action === "string" && record.action.trim() &&
    typeof record?.observed === "string" && record.observed.trim() &&
    typeof record?.artifactRef === "string" && record.artifactRef.trim() && trustedRefs.has(record.artifactRef);
  const missing = route.productProofs.filter((id) => !evidence.some((record) =>
    record?.proofId === id && record?.finding === "supports" && validObservation(record)
  ));
  const contradiction = evidence.some((record) => route.productProofs.includes(record?.proofId) &&
    record?.finding === "contradicts" && validObservation(record));
  return { status: contradiction ? "FAIL" : missing.length ? "UNPROVEN" : "PASS", missing };
}
