import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

function cleanHeader(value, label) {
  const text = String(value || "").trim();
  if (!text || /[\r\n]/u.test(text)) throw new Error(`OSS Radar email ${label} is invalid.`);
  return text;
}

export function renderEmailArtifact({ email, from, to } = {}) {
  if (!email?.subject || !email?.body) throw new Error("OSS Radar email artifact requires subject and body.");
  const sender = cleanHeader(from, "from address");
  const recipient = cleanHeader(to, "to address");
  const subject = cleanHeader(email.subject, "subject");
  const body = String(email.body).replace(/\r?\n/gu, "\r\n");
  return [
    `From: ${sender}`,
    `To: ${recipient}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
    "",
  ].join("\r\n");
}

export async function writeEmailArtifact({ resultPath, outputPath, from, to } = {}) {
  const payload = JSON.parse(await readFile(resultPath, "utf8"));
  const artifact = renderEmailArtifact({ email: payload.email, from, to });
  await writeFile(outputPath, artifact, "utf8");
  return outputPath;
}

const directUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (directUrl && import.meta.url === directUrl) {
  const [, , resultPath, outputPath] = process.argv;
  if (!resultPath || !outputPath) {
    process.stderr.write("Usage: node email-artifact.mjs <radar-result.json> <output.eml>\n");
    process.exitCode = 2;
  } else {
    const from = process.env.OSS_RADAR_EMAIL_FROM || "oss-radar@plotpickle.invalid";
    const to = process.env.OSS_RADAR_EMAIL_TO || "human-review@plotpickle.invalid";
    writeEmailArtifact({ resultPath, outputPath, from, to })
      .then(() => process.stdout.write(`${outputPath}\n`))
      .catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      });
  }
}
