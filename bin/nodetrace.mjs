#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = readJson(join(packageRoot, "package.json")).version;
const args = process.argv.slice(2);
const command = args[0] ?? "help";

if (command === "add") {
  addNodeTrace(parseOptions(args.slice(1)));
} else if (command === "capture") {
  const { runCaptureCli } = await import("../src/capture/codebaseCapture.mjs");
  await runCaptureCli(args.slice(1), { cwd: process.cwd() });
} else if (command === "help" || command === "--help" || command === "-h") {
  printHelp();
} else if (command === "--version" || command === "-v") {
  console.log(version);
} else {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exitCode = 1;
}

function addNodeTrace(options) {
  const targetDir = resolve(options.target ?? ".");
  const force = Boolean(options.force);
  const shouldInstall = !options.skipInstall;
  const shouldVerify = !options.skipVerify;
  const framework = options.framework ?? detectFramework(targetDir);
  const startedAtMs = Date.now();
  const phases = [];

  if (!existsSync(join(targetDir, "package.json"))) {
    fail(`No package.json found in ${targetDir}`);
    return;
  }

  console.log(`NodeTrace add -> ${formatPath(targetDir)}`);
  copyDir(join(packageRoot, "src", "trace"), join(targetDir, "src", "nodetrace"), { force });
  copyText(join(packageRoot, "db", "schema.sql"), join(targetDir, "db", "nodetrace.schema.sql"), { force });
  copyText(join(packageRoot, "scripts", "init-sqlite.mjs"), join(targetDir, "scripts", "nodetrace-init.mjs"), {
    force,
    replacements: [["../db/schema.sql", "../db/nodetrace.schema.sql"]],
  });
  writeText(join(targetDir, "scripts", "nodetrace-smoke.mjs"), targetSmokeScript(), { force });
  copyText(join(packageRoot, "src", "DemoDashboard.tsx"), join(targetDir, "src", "nodetrace-demo", "DemoDashboard.tsx"), {
    force,
    replacements: [["./trace", "../nodetrace"]],
  });
  copyText(join(packageRoot, "src", "styles.css"), join(targetDir, "src", "nodetrace-demo", "styles.css"), { force });
  if (framework === "next") {
    writeText(nextPagePath(targetDir), nextPage(nextPageImport(targetDir)), { force });
  } else {
    writeText(join(targetDir, "src", "nodetrace-demo", "main.tsx"), demoMain(), { force });
    writeText(join(targetDir, "nodetrace.html"), demoHtml(), { force });
  }
  writeText(join(targetDir, "docs", "NODETRACE_INTEGRATION.md"), integrationDoc(framework), { force });
  copyText(join(packageRoot, "public", "nodetrace-state.json"), join(targetDir, "public", "nodetrace-state.json"), { force });
  updatePackageJson(targetDir, framework);

  const packageManager = detectPackageManager(targetDir);
  if (shouldInstall) phases.push(runCommand(targetDir, "install dependencies", packageManager.install));
  if (phases.every((phase) => phase.ok) && shouldVerify) {
    phases.push(runCommand(targetDir, "happy path", packageManager.run("nodetrace:happy-path")));
    if (phases.every((phase) => phase.ok)) phases.push(runCommand(targetDir, "smoke", packageManager.run("nodetrace:smoke")));
    const pkg = readJson(join(targetDir, "package.json"));
    if (phases.every((phase) => phase.ok) && pkg.scripts?.build) phases.push(runCommand(targetDir, "build", packageManager.run("build")));
  }

  const receipt = {
    ok: phases.every((phase) => phase.ok),
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date().toISOString(),
    totalMs: Date.now() - startedAtMs,
    targetDir,
    framework,
    apiKeysRequired: false,
    files: [
      "src/nodetrace",
      "src/nodetrace-demo",
      "db/nodetrace.schema.sql",
      "scripts/nodetrace-init.mjs",
      "scripts/nodetrace-smoke.mjs",
      framework === "next" ? formatPath(nextPagePath(targetDir), targetDir) : "nodetrace.html",
      "docs/NODETRACE_INTEGRATION.md",
    ],
    phases,
    nextSteps: [
      "npm run nodetrace:dev",
      framework === "next" ? "Open /nodetrace" : "Open /nodetrace.html",
      "Copy TraceLensProvider and TraceLensPanel into your app shell when ready.",
    ],
  };
  writeJson(join(targetDir, ".nodetrace", "setup-receipt.json"), receipt);

  if (!receipt.ok) {
    console.error("NodeTrace add failed. See .nodetrace/setup-receipt.json");
    process.exitCode = 1;
    return;
  }

  console.log("NodeTrace add: PASS");
  console.log("Next:");
  console.log("  npm run nodetrace:dev");
  console.log(framework === "next"
    ? "  open http://127.0.0.1:3000/nodetrace or the Next URL printed by your app"
    : "  open http://127.0.0.1:5173/nodetrace.html or the Vite URL printed by your app");
}

function copyDir(sourceDir, targetDir, options) {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir)) {
    const sourcePath = join(sourceDir, entry);
    const targetPath = join(targetDir, entry);
    const stats = statSync(sourcePath);
    if (stats.isDirectory()) copyDir(sourcePath, targetPath, options);
    else if (stats.isFile()) copyText(sourcePath, targetPath, options);
  }
}

function copyText(sourcePath, targetPath, options) {
  let text = readFileSync(sourcePath, "utf8");
  for (const [from, to] of options.replacements ?? []) text = text.replaceAll(from, to);
  writeText(targetPath, text, options);
}

function writeText(targetPath, text, options) {
  if (existsSync(targetPath) && !options.force) throw new Error(`Refusing to overwrite ${formatPath(targetPath)}. Re-run with --force.`);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, text);
}

function updatePackageJson(targetDir, framework) {
  const path = join(targetDir, "package.json");
  const pkg = readJson(path);
  pkg.scripts = {
    ...pkg.scripts,
    "nodetrace:dev": pkg.scripts?.["nodetrace:dev"] ?? (framework === "next" ? "next dev" : "vite --host 127.0.0.1 --open /nodetrace.html"),
    "nodetrace:happy-path": "node scripts/nodetrace-init.mjs --json-out docs/eval/nodetrace-happy-path.json",
    "nodetrace:smoke": "node scripts/nodetrace-smoke.mjs",
  };
  pkg.dependencies = {
    ...pkg.dependencies,
    "better-sqlite3": pkg.dependencies?.["better-sqlite3"] ?? "^12.11.1",
    "lucide-react": pkg.dependencies?.["lucide-react"] ?? "^0.515.0",
    react: pkg.dependencies?.react ?? "^19.0.0",
    "react-dom": pkg.dependencies?.["react-dom"] ?? "^19.0.0",
  };
  pkg.devDependencies = {
    ...pkg.devDependencies,
    "@types/node": pkg.devDependencies?.["@types/node"] ?? "^22.10.0",
    "@types/react": pkg.devDependencies?.["@types/react"] ?? "^19.0.0",
    "@types/react-dom": pkg.devDependencies?.["@types/react-dom"] ?? "^19.0.0",
    typescript: pkg.devDependencies?.typescript ?? "^5.7.2",
  };
  if (framework !== "next") {
    pkg.devDependencies["@vitejs/plugin-react"] = pkg.devDependencies?.["@vitejs/plugin-react"] ?? "^4.3.4";
    pkg.devDependencies.vite = pkg.devDependencies?.vite ?? "^6.0.7";
  }
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

function runCommand(cwd, name, command) {
  const startedAt = performance.now();
  console.log(`- ${name}: ${command.join(" ")}`);
  const result = spawnSync(command[0], command.slice(1), {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const output = [result.error?.message, result.stdout, result.stderr].filter(Boolean).join("\n");
  const ok = result.status === 0;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${formatMs(Math.round(performance.now() - startedAt))}`);
  if (!ok && output.trim()) console.error(output.trim().slice(-3000));
  return {
    name,
    command: command.join(" "),
    ok,
    durationMs: Math.round(performance.now() - startedAt),
    detail: ok ? "completed" : output.slice(-240).replace(/\s+/g, " ").trim() || "failed",
  };
}

function detectPackageManager(targetDir) {
  if (existsSync(join(targetDir, "pnpm-lock.yaml"))) return { install: ["pnpm", "install"], run: (script) => ["pnpm", "run", script] };
  if (existsSync(join(targetDir, "yarn.lock"))) return { install: ["yarn", "install"], run: (script) => ["yarn", script] };
  if (existsSync(join(targetDir, "bun.lockb")) || existsSync(join(targetDir, "bun.lock"))) return { install: ["bun", "install"], run: (script) => ["bun", "run", script] };
  return { install: [npmCommand(), "install"], run: (script) => [npmCommand(), "run", script] };
}

function targetSmokeScript() {
  return `import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const tempDir = mkdtempSync(join(tmpdir(), "nodetrace-target-smoke-"));
const dbPath = join(tempDir, "nodetrace.sqlite");
const statePath = join(tempDir, "nodetrace-state.json");
const reportPath = join(tempDir, "happy-path.json");
const result = spawnSync(process.execPath, ["scripts/nodetrace-init.mjs", "--db", dbPath, "--state", statePath, "--json-out", reportPath], {
  cwd: process.cwd(),
  encoding: "utf8",
});
const issues = [];
if (result.status !== 0) issues.push(\`happy path failed: \${[result.stdout, result.stderr].join("\\n").slice(-1200)}\`);
for (const file of [dbPath, statePath, reportPath, "src/nodetrace/TraceLensPanel.tsx", "src/nodetrace/TraceLensProvider.tsx", "db/nodetrace.schema.sql", "nodetrace.html"]) {
  if (file === "nodetrace.html" && (existsSync("app/nodetrace/page.tsx") || existsSync("src/app/nodetrace/page.tsx"))) continue;
  if (!existsSync(file)) issues.push(\`missing \${file}\`);
}
if (issues.length === 0) {
  const panel = readFileSync("src/nodetrace/TraceLensPanel.tsx", "utf8");
  const provider = readFileSync("src/nodetrace/TraceLensProvider.tsx", "utf8");
  for (const required of ["Business proof", "Runtime trace", "Code ownership", "Review", "Builder", "Query", "Mutation", "Skill"]) {
    if (!panel.includes(required)) issues.push(\`TraceLensPanel missing \${required}\`);
  }
  for (const required of ["data-nodetrace-surface", "data-noderoom-surface"]) {
    if (!provider.includes(required)) issues.push(\`TraceLensProvider missing \${required}\`);
  }
}
const report = { ok: issues.length === 0, completedAt: new Date().toISOString(), apiKeysRequired: false, issues };
writeJson("docs/eval/nodetrace-smoke.json", report);
if (tempDir.startsWith(tmpdir())) rmSync(tempDir, { recursive: true, force: true });
if (issues.length > 0) {
  console.error("nodetrace target smoke: FAIL");
  for (const issue of issues) console.error(\`  - \${issue}\`);
  process.exitCode = 1;
} else {
  console.log("nodetrace target smoke: PASS");
}
function writeJson(path, value) {
  const parent = dirname(path);
  if (parent && parent !== "." && !existsSync(parent)) mkdirSync(parent, { recursive: true });
  writeFileSync(path, \`\${JSON.stringify(value, null, 2)}\\n\`);
}
`;
}

function nextPage(importPath) {
  return `"use client";

import { DemoDashboard } from "${importPath}";
import "${importPath.replace(/DemoDashboard$/, "styles.css")}";

export default function NodeTracePage() {
  return <DemoDashboard />;
}
`;
}

function demoMain() {
  return `import React from "react";
import { createRoot } from "react-dom/client";
import { DemoDashboard } from "./DemoDashboard";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DemoDashboard />
  </React.StrictMode>,
);
`;
}

function demoHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NodeTrace Integration</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/nodetrace-demo/main.tsx"></script>
  </body>
</html>
`;
}

function integrationDoc(framework) {
  const route = framework === "next" ? "/nodetrace" : "/nodetrace.html";
  const entry = framework === "next" ? "App Router page at `src/app/nodetrace/page.tsx` or `app/nodetrace/page.tsx`" : "Vite demo entry at `nodetrace.html`";
  return `# NodeTrace Integration

This app was patched by \`nodetrace add\`.

## Run

\`\`\`bash
npm run nodetrace:happy-path
npm run nodetrace:smoke
npm run nodetrace:dev
\`\`\`

Open \`${route}\` in the dev server.

## Files Added

- \`src/nodetrace/\`: portable Trace Lens components and types.
- \`src/nodetrace-demo/\`: no-key demo dashboard entry.
- \`db/nodetrace.schema.sql\`: generic SQLite trace schema.
- \`scripts/nodetrace-init.mjs\`: local SQLite/state initializer.
- \`scripts/nodetrace-smoke.mjs\`: target app smoke.
- ${entry}.

## Wire Into The App

Wrap the app shell with \`TraceLensProvider\`, render \`TraceLensPanel\`, and tag visible surfaces with \`data-nodetrace-surface\`.

Keep \`builderCapable\` server-verified. Do not expose code ownership, file paths, query names, mutation names, skill paths, raw prompts, cookies, tokens, or secrets in public client state. Builder ownership should come from a privileged server route and include component, query, mutation, skill, and test refs.
`;
}

function parseOptions(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--target" || value === "--dir") {
      parsed.target = values[index + 1];
      index += 1;
    } else if (value === "--force") {
      parsed.force = true;
    } else if (value === "--framework") {
      const framework = values[index + 1];
      if (framework !== "vite" && framework !== "next") {
        console.error("--framework must be vite or next");
        process.exit(1);
      }
      parsed.framework = framework;
      index += 1;
    } else if (value === "--skip-install") {
      parsed.skipInstall = true;
    } else if (value === "--skip-verify") {
      parsed.skipVerify = true;
    }
  }
  return parsed;
}

function detectFramework(targetDir) {
  const pkg = readJson(join(targetDir, "package.json"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.next || existsSync(join(targetDir, "next.config.js")) || existsSync(join(targetDir, "next.config.mjs"))) return "next";
  return "vite";
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function nextPagePath(targetDir) {
  return existsSync(join(targetDir, "src", "app"))
    ? join(targetDir, "src", "app", "nodetrace", "page.tsx")
    : join(targetDir, "app", "nodetrace", "page.tsx");
}

function nextPageImport(targetDir) {
  return existsSync(join(targetDir, "src", "app"))
    ? "../../nodetrace-demo/DemoDashboard"
    : "../../src/nodetrace-demo/DemoDashboard";
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function formatMs(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

function formatPath(path, from = process.cwd()) {
  const relativePath = relative(from, path);
  return relativePath && !relativePath.startsWith("..") ? relativePath : path;
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function printHelp() {
  console.log(`NodeTrace ${version}

Commands:
  nodetrace add [--target <dir>] [--framework vite|next] [--force] [--skip-install] [--skip-verify]
  nodetrace capture --plan <capture-plan.json> [--dry-run]

Default add behavior copies Trace Lens, patches package scripts/dependencies,
runs install, runs the no-key happy path, runs target smoke, and runs build
when the target app has a build script. Vite targets get nodetrace.html; Next
targets get an App Router /nodetrace page.

Capture runs a reusable real-codebase proof plan: actual source screenshots
from real files plus actual running-app Playwright screenshots and a manifest.
`);
}
