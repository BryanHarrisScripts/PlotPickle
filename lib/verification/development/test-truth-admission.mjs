import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const CATALOG_PATH = "config/verification/test-catalog.json";
const SHA256 = /^[0-9a-f]{64}$/u;
const SCOPES = new Set(["static-source", "unit-fixture", "real-boundary", "real-provider", "real-device", "human-review"]);
const present = (value) => typeof value === "string" && value.trim().length > 0;
const safePath = (value) => present(value) && !path.posix.isAbsolute(value) && !value.includes("\\") && !value.split("/").some((part) => !part || part === ".." || part === ".") && !/[:\u0000\r\n]/u.test(value);
// Git checkouts may use CRLF on Windows; text provenance uses canonical LF.
const canonicalText = (source) => source.replaceAll("\r\n", "\n");
export const testSourceDigest = (source) => createHash("sha256").update(canonicalText(source)).digest("hex");
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const same = (left, right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));
const isTestInput = (file) => file.startsWith("tests/") || (!/^(?:docs|reports|\.artifacts)\//u.test(file) && /\.(?:[cm]?js|[jt]sx?|ps1|py|sh)$/iu.test(file) && /(?:^|\/)[^/]*(?:[-_.])(?:test|spec|proof|smoke)(?:[-_.])[^/]+$/iu.test(file));

export function validateTestTruthGovernance(governance) {
  const errors = [];
  if (governance?.schemaVersion !== 1) errors.push("Test truth governance schemaVersion must be 1.");
  if (!Array.isArray(governance?.approvedTruths) || !Array.isArray(governance?.bindings)) return [...errors, "Approved truth references and bindings are required."];
  const ids = new Set();
  for (const truth of governance.approvedTruths) {
    if (!present(truth?.id) || ids.has(truth.id)) errors.push("Approved truth IDs must be present and unique.");
    ids.add(truth?.id);
    if (!safePath(truth?.source) || !present(truth?.version) || !SHA256.test(truth?.sourceDigest || "") || !present(truth?.approvalRef)) errors.push(`${truth?.id}: version, safe source, digest and approval provenance are required.`);
    if (!Array.isArray(truth?.obligations) || !truth.obligations.length) { errors.push(`${truth?.id}: obligations are required.`); continue; }
    const obligations = new Set();
    for (const obligation of truth.obligations) {
      if (!present(obligation?.id) || obligations.has(obligation.id) || !present(obligation?.start) || !present(obligation?.end)) errors.push(`${truth.id}: unique obligation IDs and exact normative anchors are required.`);
      obligations.add(obligation?.id);
    }
  }
  const targets = new Set();
  for (const binding of governance.bindings) {
    if (!safePath(binding?.target) || targets.has(binding.target) || !SHA256.test(binding?.targetDigest || "")) errors.push("Test bindings need unique safe targets and complete source digests.");
    targets.add(binding?.target);
    if (!Array.isArray(binding?.catalogueIds) || !binding.catalogueIds.length || !binding.catalogueIds.every(present)) errors.push(`${binding?.target}: catalogue owners are required.`);
    if (!Array.isArray(binding?.truthRefs) || !binding.truthRefs.length || binding.truthRefs.some((ref) => !present(ref?.truthId) || !present(ref?.obligationId))) errors.push(`${binding?.target}: specific truth/obligation references are required.`);
    if (!Array.isArray(binding?.scopes) || !binding.scopes.length || binding.scopes.some((scope) => !SCOPES.has(scope))) errors.push(`${binding?.target}: typed evidence scopes are required.`);
    if (!present(binding?.limits)) errors.push(`${binding?.target}: proof limits are required.`);
    if (!Array.isArray(binding?.inputs) || binding.inputs.some((input) => !safePath(input?.path) || !SHA256.test(input?.digest || ""))) errors.push(`${binding?.target}: declared inputs need safe paths and digests.`);
  }
  return errors;
}

export function extractApprovedOracle(source, obligation) {
  const start = source.indexOf(obligation.start);
  if (start < 0 || source.indexOf(obligation.start, start + obligation.start.length) >= 0) throw new Error("Normative start anchor is missing or ambiguous.");
  const end = source.indexOf(obligation.end, start + obligation.start.length);
  if (end < 0) throw new Error("Normative end anchor is missing.");
  return source.slice(start, end).trim();
}

// A binding is a reference to the approved oracle. It cannot confer approval or product PASS.
export async function assessTestTruthAdmission({ catalog, baseCatalog, changedFiles = [], removedFiles = [], readCurrent, readBase, baseSha }) {
  const findings = [];
  const governance = catalog?.truthGovernance;
  const fail = (code, target, detail) => findings.push({code, target, detail});
  if (!/^[0-9a-f]{40}$/u.test(baseSha || "") || !baseCatalog || typeof readCurrent !== "function" || typeof readBase !== "function") {
    return {status:"blocked", baseSha:baseSha || "", findings:[{code:"missing-trusted-base",target:CATALOG_PATH,detail:"Cannot establish the approved comparison source."}], bindings:[]};
  }
  for (const error of validateTestTruthGovernance(governance)) fail("invalid-truth-governance", CATALOG_PATH, error);
  if (findings.length) return {status:"blocked",baseSha,findings,bindings:[]};
  const baseGovernance = baseCatalog.truthGovernance;
  const approved = new Map();
  for (const truth of governance.approvedTruths) {
    const prior = baseGovernance?.approvedTruths?.find((item) => item.id === truth.id);
    if (prior && !same(prior, truth)) fail("approved-reference-amended",truth.source,"An implementation change cannot amend an admitted approved edition or its obligations.");
    try {
      const current = await readCurrent(truth.source), base = await readBase(truth.source);
      if (canonicalText(current) !== canonicalText(base) || testSourceDigest(base) !== truth.sourceDigest) throw new Error("The oracle must already exist unchanged in the trusted base with the declared digest.");
      const isWhitePaper = truth.source === "docs/white-papers/AI_Programming_Evolution_White_Paper.md" && truth.version === "3.0" && /White paper\s*\|\s*Version 3\.0/u.test(base);
      const header = base.split(/\r?\n/u).slice(0,8).join("\n");
      const isApprovedContract = truth.source.startsWith("docs/behavioral-contracts/") && /\*\*Status:\*\*\s*(?:APPROVED|Human-established truths)/u.test(header) && !/PROPOSED/u.test(header);
      if (!isWhitePaper && !isApprovedContract) throw new Error("The source is not an already approved normative document; a proposal or agent label cannot confer approval.");
      if (!isWhitePaper && !base.includes(`**Contract version:** ${truth.version}`) && truth.version !== `sha256:${truth.sourceDigest}`) throw new Error("The stated edition does not match the approved source.");
      const oracles = new Map();
      for (const obligation of truth.obligations) oracles.set(obligation.id, extractApprovedOracle(base, obligation));
      approved.set(truth.id, {truth, oracles});
    } catch (error) { fail("unapproved-or-stale-oracle",truth.source,error.message); }
  }
  for (const prior of baseGovernance?.approvedTruths || []) if (!governance.approvedTruths.some((truth) => truth.id === prior.id)) fail("approved-reference-removed",prior.source,"Approved obligations cannot be silently retired.");
  const currentTargets = new Map();
  for (const entry of catalog.entries || []) for (const target of entry.runner?.targets || []) {
    const groups = currentTargets.get(target) || [];
    groups.push({id:entry.id,layer:entry.ownerLayer}); currentTargets.set(target,groups);
  }
  const required = new Set(changedFiles.filter((file) => isTestInput(file) || currentTargets.has(file)));
  for (const entry of catalog.entries || []) {
    const prior = baseCatalog.entries?.find((item) => item.id === entry.id);
    for (const target of entry.runner?.targets || []) if (!prior || prior.ownerLayer !== entry.ownerLayer || prior.runner?.kind !== entry.runner.kind || !prior.runner.targets.includes(target)) required.add(target);
  }
  for (const file of removedFiles.filter(isTestInput)) fail("removed-test-evidence",file,"Map and approve equivalent replacement evidence before retiring a governed test input.");
  for (const prior of baseGovernance?.bindings || []) if (!governance.bindings.some((binding) => binding.target === prior.target)) fail("test-binding-removed",prior.target,"An existing approved test binding cannot silently become execution-only.");
  const bindings = [];
  const covered = new Set();
  for (const binding of governance.bindings) {
    const ownerIds = (currentTargets.get(binding.target) || []).map((owner) => owner.id).sort();
    if (!ownerIds.length || !same(ownerIds,[...new Set(binding.catalogueIds)].sort())) fail("unregistered-test-target",binding.target,"The binding must match every owning catalogue group.");
    try {
      if (testSourceDigest(await readCurrent(binding.target)) !== binding.targetDigest) throw new Error("Test source changed; renew its approved-truth binding and review the expected outcomes.");
      covered.add(binding.target);
      for (const input of binding.inputs) {
        if (testSourceDigest(await readCurrent(input.path)) !== input.digest) throw new Error(`Declared test input changed: ${input.path}`);
        covered.add(input.path);
      }
    } catch (error) { fail("stale-test-binding",binding.target,error.message); }
    const prior = baseGovernance?.bindings?.find((item) => item.target === binding.target);
    if (prior && prior.truthRefs.some((ref) => !binding.truthRefs.some((candidate) => same(ref,candidate)))) fail("test-obligation-removed",binding.target,"A test revision cannot silently remove an approved obligation.");
    const truthRefs = [];
    for (const ref of binding.truthRefs) {
      const item = approved.get(ref.truthId), oracle = item?.oracles.get(ref.obligationId);
      if (!oracle) { fail("unknown-approved-obligation",binding.target,`${ref.truthId}/${ref.obligationId} is not an admitted normative oracle.`); continue; }
      truthRefs.push({contractId:item.truth.id,contractVersion:item.truth.version,obligationId:ref.obligationId,source:item.truth.source,sourceDigest:item.truth.sourceDigest,oracleDigest:testSourceDigest(oracle)});
    }
    bindings.push({target:binding.target,sourceDigest:binding.targetDigest,ownerLayers:[...new Set((currentTargets.get(binding.target)||[]).map((owner)=>owner.layer))],truthRefs,declaredScopes:binding.scopes,limits:binding.limits});
  }
  for (const target of required) if (!covered.has(target)) fail("missing-approved-truth-binding",target,"New or revised test evidence must name an approved obligation and its unchanged normative source.");
  return {status:findings.length?"blocked":"ready",baseSha,findings,bindings,
    note:"Admission links expected outcomes to approved meaning. It is not observed product conformance or an automatic semantic audit of every assertion."};
}

function git(root, args, allowMissing = false) {
  const result = spawnSync("git",args,{cwd:root,encoding:"utf8",shell:false,maxBuffer:16*1024*1024});
  if (result.status !== 0) { if (allowMissing) return null; throw new Error(result.stderr?.trim() || "Git comparison failed."); }
  return result.stdout;
}

export async function assessRepositoryTestTruth({root=process.cwd(),baseRef="origin/main",includeWorkingTree=false}) {
  try {
    const baseSha = git(root,["rev-parse","--verify",`${baseRef}^{commit}`]).trim();
    const baseText = git(root,["show",`${baseSha}:${CATALOG_PATH}`]);
    const currentRoot = await realpath(root);
    const readCurrent = async (file) => {
      if (!safePath(file)) throw new Error("Unsafe source path.");
      const actual = await realpath(path.join(root,file));
      if (!actual.startsWith(`${currentRoot}${path.sep}`)) throw new Error("Source resolves outside the repository.");
      return readFile(actual,"utf8");
    };
    let delta = git(root,["diff","--name-status","--no-renames",baseSha,"HEAD"]);
    if (includeWorkingTree) delta += git(root,["diff","--name-status","--no-renames","HEAD"]);
    const changedFiles=[],removedFiles=[];
    for (const row of delta.trim().split(/\r?\n/u).filter(Boolean)) {
      const [status,file] = row.split("\t");
      (status === "D" ? removedFiles : changedFiles).push(file);
    }
    if (includeWorkingTree) changedFiles.push(...git(root,["ls-files","--others","--exclude-standard"]).trim().split(/\r?\n/u).filter(Boolean));
    return await assessTestTruthAdmission({catalog:JSON.parse(await readCurrent(CATALOG_PATH)),baseCatalog:JSON.parse(baseText),baseSha,changedFiles,removedFiles,readCurrent,
      readBase:async(file)=>{if(!safePath(file))throw new Error("Unsafe normative path.");return git(root,["show",`${baseSha}:${file}`]);}});
  } catch (error) { return {status:"blocked",baseSha:"",findings:[{code:"missing-trusted-base",target:CATALOG_PATH,detail:error.message}],bindings:[]}; }
}
