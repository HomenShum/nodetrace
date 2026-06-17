#!/usr/bin/env node

import { runCaptureCli } from "../src/capture/codebaseCapture.mjs";

try {
  await runCaptureCli(process.argv.slice(2), { cwd: process.cwd() });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
