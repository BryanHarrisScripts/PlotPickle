import { createInterface } from "node:readline/promises";
import process from "node:process";

function divider() {
  return "============================================================";
}

export function agentLoaded({ name, purpose, instructions, automatic = false }) {
  process.stdout.write(`\n${divider()}\n`);
  process.stdout.write(`AGENT LOADED: ${name}\n`);
  process.stdout.write(`${divider()}\n`);
  process.stdout.write(`Purpose: ${purpose}\n`);
  process.stdout.write(`Instructions required: ${automatic ? "No - this agent runs automatically." : "Yes."}\n`);
  process.stdout.write(`Instructions: ${instructions}\n`);
}

export function agentStatus(status, detail) {
  process.stdout.write(`\nSTATUS: ${status}\n`);
  if (detail) process.stdout.write(`${detail}\n`);
}

export function agentCompleted(result) {
  process.stdout.write(`\n${divider()}\n`);
  process.stdout.write("AGENT COMPLETED\n");
  process.stdout.write(`${divider()}\n`);
  if (result) process.stdout.write(`Result: ${result}\n`);
}

export function agentNeedsAttention(message) {
  process.stderr.write(`\n${divider()}\n`);
  process.stderr.write("AGENT NEEDS ATTENTION\n");
  process.stderr.write(`${divider()}\n`);
  process.stderr.write(`${message}\n`);
}

export async function keepAgentWindowOpen(name) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    await prompt.question(`\n${name} will remain open. Press Enter when you want to close this window. `);
  } finally {
    prompt.close();
  }
}
