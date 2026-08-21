#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";
import { verificationPlaywrightArgs } from "./full-verification-auth.mjs";

const requestedArgs = process.argv.slice(2);
if (!requestedArgs.length) {
  console.error("PlotPickle stdio launcher requires npx arguments.");
  process.exit(2);
}

const npxArgs = verificationPlaywrightArgs(requestedArgs);
const isWindows = process.platform === "win32";
const command = isWindows
  ? (process.env.ComSpec || process.env.COMSPEC || "cmd.exe")
  : "npx";
const commandArgs = isWindows
  ? ["/d", "/c", "npx.cmd", ...npxArgs]
  : npxArgs;

const child = spawn(command, commandArgs, {
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

child.once("error", (error) => {
  console.error(`PlotPickle could not start npx: ${error.message}`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    console.error(`PlotPickle npx child stopped by signal ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = Number.isInteger(code) ? code : 1;
});
