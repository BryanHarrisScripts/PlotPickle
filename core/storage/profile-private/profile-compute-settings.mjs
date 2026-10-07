// One account-owned encrypted record; adapters retain their existing typed projections.
export const COMPUTE_SETTING_NAMES = Object.freeze([
  "ai-connection.json", "writing-assistant-profiles.json", "media-routing.json",
  "ai-routing.json", "plotpickle-agent-compute.json", "h3-native-routing.json",
  "local-runtime.json", "story-mode-policy.json", "story-mode-job-routing.json",
]);
export const COMPUTE_PRIVATE_NAMES = Object.freeze([
  ...COMPUTE_SETTING_NAMES, "openai-video-jobs.json", "h3-native-jobs.json",
]);
const RECORD = "compute-setup.json";
const queues = new WeakMap();
function queueFor(storage) {
  let queue = queues.get(storage);
  if (!queue) { queue = new Map(); queues.set(storage, queue); }
  return queue;
}
export async function readProfileComputeSetting(context, name) {
  if (!context) throw new Error("Unlock a PlotPickle profile before reading compute setup.");
  if (!COMPUTE_SETTING_NAMES.includes(name)) throw new Error("Unknown compute setting.");
  await queueFor(context.privateStorage).get(context.profileId);
  const record = await context.privateStorage.readCredential(context.authContext, RECORD);
  if (record?.version === 1 && Object.hasOwn(record.settings ?? {}, name)) return record.settings[name];
  // Existing profile-owned records are safe migration input. OS-account secrets are never read.
  return context.privateStorage.readCredential(context.authContext, name);
}
export function writeProfileComputeSetting(context, name, value) {
  if (!context) throw new Error("Unlock a PlotPickle profile before saving compute setup.");
  if (!COMPUTE_SETTING_NAMES.includes(name)) throw new Error("Unknown compute setting.");
  const queue = queueFor(context.privateStorage);
  const prior = queue.get(context.profileId) ?? Promise.resolve();
  const write = prior.catch(() => {}).then(async () => {
    const stored = await context.privateStorage.readCredential(context.authContext, RECORD);
    const settings = stored?.version === 1 ? { ...stored.settings } : {};
    settings[name] = value;
    await context.privateStorage.writeCredential(context.authContext, RECORD, { version: 1, settings });
  });
  queue.set(context.profileId, write);
  return write.finally(() => { if (queue.get(context.profileId) === write) queue.delete(context.profileId); });
}
