import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

/** Load the pure repository contract with a synthetic application version.
 * The real version module is outside this data-URL fixture's evidence scope.
 */
export async function loadStoryProjectRepositoryFixture(sourceText) {
  const raw = sourceText ?? await readFile(new URL("../../lib/projects/persistence/story-project-repository.ts", import.meta.url), "utf8");
  assert.equal(typeof raw, "string", "Story project repository fixture source must be text.");
  const normalized = raw.replace(/\r\n?/gu, "\n");
  const isolated = normalized.replace(
    /^import \{ PLOTPICKLE_VERSION \} from "\.\.\/\.\.\/runtime\/application-version";\n/mu,
    'const PLOTPICKLE_VERSION = "fixture-application-version";\n',
  );
  assert.notEqual(isolated, normalized, "Story project repository fixture version import was not isolated.");
  const compiled = stripTypeScriptTypes(isolated);
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`);
}
