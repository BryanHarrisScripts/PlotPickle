import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const chunkPaths = [1, 2, 3, 4, 5, 6].map((number) => `scripts/.issue367-payload-${number}`);
const chunks = await Promise.all(chunkPaths.map((filePath) => readFile(filePath, "utf8")));
const encoded = chunks.join("").trim();
const digest = createHash("sha256").update(encoded).digest("hex");
const expectedDigest = "8eb0b27fb1b81f6befa830a70bff2cbc415c761ec9203a15525b567e12b05df6";
if (digest !== expectedDigest) throw new Error(`Issue 367 payload digest mismatch: ${digest}`);

const decoded = gunzipSync(Buffer.from(encoded, "base64"));
const files = JSON.parse(decoded.toString("utf8"));
for (const [filePath, content] of Object.entries(files)) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

const removal = spawnSync("git", ["rm", ...chunkPaths], { stdio: "inherit" });
if (removal.status !== 0) process.exit(removal.status || 1);
console.log(`Installed ${Object.keys(files).length} reviewed Storyboard Creative Director files.`);
