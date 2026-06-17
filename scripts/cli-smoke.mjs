import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const tempDir = mkdtempSync(join(tmpdir(), "nodetrace-cli-smoke-"));
const targetDir = join(tempDir, "app");
mkdirp(targetDir);
writeFileSync(join(targetDir, "package.json"), `${JSON.stringify({
  name: "nodetrace-target",
  private: true,
  type: "module",
  scripts: {
    build: "node -e \"console.log('target build placeholder')\"",
  },
}, null, 2)}\n`);
mkdirp(join(targetDir, "src"));
writeFileSync(join(targetDir, "src", "main.tsx"), "console.log('target app');\n");

const result = spawnSync(process.execPath, ["bin/nodetrace.mjs", "add", "--target", targetDir, "--skip-install", "--skip-verify"], {
  cwd: process.cwd(),
  encoding: "utf8",
});

const issues = [];
if (result.status !== 0) issues.push(`nodetrace add failed: ${[result.stdout, result.stderr].join("\n").slice(-1200)}`);
for (const file of [
  "src/nodetrace/TraceLensPanel.tsx",
  "src/nodetrace/TraceLensProvider.tsx",
  "src/nodetrace-demo/DemoDashboard.tsx",
  "db/nodetrace.schema.sql",
  "scripts/nodetrace-init.mjs",
  "scripts/nodetrace-smoke.mjs",
  "nodetrace.html",
  "docs/NODETRACE_INTEGRATION.md",
  ".nodetrace/setup-receipt.json",
]) {
  if (!existsSync(join(targetDir, file))) issues.push(`missing ${file}`);
}

if (issues.length === 0) {
  const pkg = JSON.parse(readFileSync(join(targetDir, "package.json"), "utf8"));
  for (const script of ["nodetrace:dev", "nodetrace:happy-path", "nodetrace:smoke"]) {
    if (!pkg.scripts?.[script]) issues.push(`package missing ${script}`);
  }
  const panel = readFileSync(join(targetDir, "src/nodetrace/TraceLensPanel.tsx"), "utf8");
  const provider = readFileSync(join(targetDir, "src/nodetrace/TraceLensProvider.tsx"), "utf8");
  for (const required of ["Business proof", "Runtime trace", "Code ownership", "Review", "Builder"]) {
    if (!panel.includes(required)) issues.push(`panel missing ${required}`);
  }
  for (const required of ["data-nodetrace-surface", "data-noderoom-surface"]) {
    if (!provider.includes(required)) issues.push(`provider missing ${required}`);
  }
}

const report = {
  ok: issues.length === 0,
  completedAt: new Date().toISOString(),
  apiKeysRequired: false,
  issues,
};
writeJson("docs/eval/nodetrace-cli-smoke.json", report);
if (tempDir.startsWith(tmpdir())) rmSync(tempDir, { recursive: true, force: true });

if (issues.length > 0) {
  console.error("nodetrace cli smoke: FAIL");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exitCode = 1;
} else {
  console.log("nodetrace cli smoke: PASS");
}

function mkdirp(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function writeJson(path, value) {
  const parent = dirname(path);
  mkdirp(parent);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
