import { spawn } from "node:child_process";
import { parseNodeTestOutput, enrichSummaryWithPlan } from "./failure-parser.mjs";
import { writeFailureSummary } from "./reporter.mjs";

function executableForPlatform(command) {
  if (process.platform === "win32" && command === "npm") return "npm.cmd";
  if (process.platform === "win32" && command === "npx") return "npx.cmd";
  return command;
}

export async function runAndSummarize(command, args, options) {
  if (!command) throw new Error("A command is required.");
  const chunks = [];
  const child = spawn(executableForPlatform(command), args, {
    cwd: options.root || process.cwd(),
    env: process.env,
    windowsHide: true,
    stdio: ["inherit", "pipe", "pipe"],
  });

  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
      (stream === child.stdout ? process.stdout : process.stderr).write(chunk);
    });
  }

  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });

  const output = Buffer.concat(chunks).toString("utf8");
  let summary = parseNodeTestOutput(output, options.registry);
  summary = enrichSummaryWithPlan(summary, options.plan || null);
  summary.command = [command, ...args];
  summary.exitCode = exitCode;
  if (exitCode !== 0 && summary.passed) {
    summary.passed = false;
    summary.counts.failures = Math.max(1, summary.counts.failures);
    summary.failures.push({
      id: "failure-process",
      name: "Command exited without structured Node test failures",
      message: `Process exited with code ${exitCode}.`,
      normalizedMessage: `Process exited with code ${exitCode}.`,
      testFile: null,
      line: null,
      column: null,
      detail: [],
      contracts: [],
      classification: "environment",
    });
  }
  await writeFailureSummary(summary, {
    root: options.root,
    reportDirectory: options.reportDirectory,
  });
  return { exitCode, summary };
}
