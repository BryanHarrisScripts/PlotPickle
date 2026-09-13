import { pathToFileURL } from "node:url";
import { discoverGitHubRepositories, loadDiscoveryContract } from "./discover-github.mjs";
import { publishDailyRadar } from "./issue-lifecycle.mjs";

export async function runRadar({
  repository = process.env.GITHUB_REPOSITORY,
  auth = process.env.GITHUB_TOKEN,
  fetchImpl = globalThis.fetch,
  now = new Date(),
  discoveryResult = null,
} = {}) {
  const contract = await loadDiscoveryContract();
  const discovery = discoveryResult || await discoverGitHubRepositories({
    contract,
    token: auth,
    fetchImpl,
    now,
  });
  return publishDailyRadar({
    repository,
    auth,
    contract,
    discoveryResult: discovery,
    fetchImpl,
    now,
  });
}

const directUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (directUrl && import.meta.url === directUrl) {
  runRadar()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
