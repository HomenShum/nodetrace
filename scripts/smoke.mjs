import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const startedAt = new Date();
const tempDir = mkdtempSync(join(tmpdir(), "nodetrace-smoke-"));
const dbPath = join(tempDir, "nodetrace.sqlite");
const statePath = join(tempDir, "nodetrace-state.json");
const reportPath = join(tempDir, "happy-path.json");
const result = spawnSync(process.execPath, ["scripts/init-sqlite.mjs", "--db", dbPath, "--state", statePath, "--json-out", reportPath], {
  cwd: process.cwd(),
  encoding: "utf8",
});

const issues = [];
if (result.status !== 0) issues.push(`happy path failed: ${[result.stdout, result.stderr].join("\n").slice(-1200)}`);
for (const file of [dbPath, statePath, reportPath]) {
  if (!existsSync(file)) issues.push(`missing ${file}`);
}

if (issues.length === 0) {
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const provider = readFileSync("src/trace/TraceLensProvider.tsx", "utf8");
  const panel = readFileSync("src/trace/TraceLensPanel.tsx", "utf8");
  const schema = readFileSync("db/schema.sql", "utf8");
  const readme = readFileSync("README.md", "utf8");
  const walkthrough = readFileSync("docs/WALKTHROUGH.md", "utf8");
  for (const required of ["surfaces", "proofs", "traces", "builderCapable"]) {
    if (!(required in state)) issues.push(`state missing ${required}`);
  }
  for (const required of ["data-nodetrace-surface", "data-noderoom-surface", "resolveTraceHit"]) {
    if (!provider.includes(required)) issues.push(`TraceLensProvider missing ${required}`);
  }
  for (const required of ["Business proof", "Runtime trace", "Code ownership", "Builder", "Review"]) {
    if (!panel.includes(required)) issues.push(`TraceLensPanel missing ${required}`);
  }
  for (const table of ["trace_sessions", "trace_surfaces", "trace_proofs", "trace_events", "trace_code_ownership"]) {
    if (!schema.includes(table)) issues.push(`schema missing ${table}`);
  }
  for (const required of [
    "docs/WALKTHROUGH.md",
    "nodetrace-dashboard.png",
    "nodetrace-trace-lens.png",
    "nodetrace-walkthrough.gif",
    "nodetrace-walkthrough.mp4",
  ]) {
    if (!readme.includes(required)) issues.push(`README.md missing ${required}`);
  }
  for (const required of [
    "Visual Walkthrough",
    "nodetrace-walkthrough.gif",
    "nodetrace-walkthrough.mp4",
    "nodetrace-dashboard.png",
    "nodetrace-trace-lens.png",
    "npx nodetrace add",
    "setup-receipt.json",
  ]) {
    if (!walkthrough.includes(required)) issues.push(`docs/WALKTHROUGH.md missing ${required}`);
  }
  for (const file of [
    "docs/screenshots/nodetrace-dashboard.png",
    "docs/screenshots/nodetrace-trace-lens.png",
    "docs/walkthroughs/nodetrace-walkthrough.mp4",
    "docs/walkthroughs/nodetrace-walkthrough.gif",
  ]) {
    if (!existsSync(file)) issues.push(`missing ${file}`);
  }
}

const report = {
  ok: issues.length === 0,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  apiKeysRequired: false,
  issues,
};

writeJson("docs/eval/nodetrace-smoke.json", report);
if (issues.length === 0) {
  console.log("nodetrace smoke: PASS");
} else {
  console.error("nodetrace smoke: FAIL");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exitCode = 1;
}

if (tempDir.startsWith(tmpdir())) rmSync(tempDir, { recursive: true, force: true });

function writeJson(path, value) {
  const parent = dirname(path);
  if (parent && parent !== "." && !existsSync(parent)) mkdirSync(parent, { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
