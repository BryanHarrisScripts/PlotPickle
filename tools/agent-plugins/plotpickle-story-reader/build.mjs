import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [path.join(directory, "src/inspect-project.ts")],
  outfile: path.join(directory, "skills/read-plotpickle-project/scripts/inspect-project.mjs"),
  bundle: true, platform: "node", format: "esm", target: "node22", legalComments: "eof",
});
