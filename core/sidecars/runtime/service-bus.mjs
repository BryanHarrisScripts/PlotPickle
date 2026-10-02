import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

function safeId(value, label) {
  const id = String(value ?? "").trim();
  if (!/^[a-z0-9][a-z0-9_.:-]{0,239}$/iu.test(id)) throw new Error(`Invalid ${label}.`);
  return id;
}

export function runtimeServicePaths(home, serviceId) {
  const id = safeId(serviceId, "service id");
  const root = path.resolve(home, "node", "runtime", "sidecars");
  return Object.freeze({
    root,
    status: path.join(root, "services", id, "status.json"),
    inbox: path.join(root, "requests", id),
    processing: path.join(root, "processing", id),
    results: path.join(root, "results", id),
  });
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await rename(temp, file);
}

export async function writeServiceStatus(home, serviceId, status) {
  const paths = runtimeServicePaths(home, serviceId);
  const document = Object.freeze({
    schemaVersion: 1,
    id: serviceId,
    ...status,
    observedAt: status.observedAt || new Date().toISOString(),
  });
  await atomicJson(paths.status, document);
  return document;
}

export async function enqueueServiceRequest(home, serviceId, request) {
  const paths = runtimeServicePaths(home, serviceId);
  const requestId = safeId(request?.requestId, "request id");
  await mkdir(paths.inbox, { recursive: true });
  const file = path.join(paths.inbox, `${requestId.replaceAll(":", "_")}.json`);
  await atomicJson(file, request);
  return file;
}

export async function claimServiceRequests(home, serviceId) {
  const paths = runtimeServicePaths(home, serviceId);
  await mkdir(paths.inbox, { recursive: true });
  await mkdir(paths.processing, { recursive: true });
  const entries = (await readdir(paths.inbox)).filter((name) => name.endsWith(".json")).sort();
  const claimed = [];
  for (const name of entries) {
    const source = path.join(paths.inbox, name);
    const target = path.join(paths.processing, name);
    try {
      await rename(source, target);
      claimed.push(Object.freeze({ file: target, request: JSON.parse(await readFile(target, "utf8")) }));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return claimed;
}

export async function completeServiceRequest(home, serviceId, claimed, result) {
  const paths = runtimeServicePaths(home, serviceId);
  await mkdir(paths.results, { recursive: true });
  const requestId = safeId(result?.requestId, "request id");
  const file = path.join(paths.results, `${requestId.replaceAll(":", "_")}.json`);
  await atomicJson(file, result);
  await rm(claimed.file, { force: true });
  return file;
}

export async function readServiceResult(home, serviceId, requestId) {
  const paths = runtimeServicePaths(home, serviceId);
  const id = safeId(requestId, "request id");
  const file = path.join(paths.results, `${id.replaceAll(":", "_")}.json`);
  return JSON.parse(await readFile(file, "utf8"));
}
