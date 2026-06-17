import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const startedAtMs = Date.now();
const tempDir = mkdtempSync(join(tmpdir(), "nodetrace-next-e2e-"));
const issues = [];
let setupReceipt;
let output = "";

try {
  createNextTarget(tempDir);
  const result = spawnSync(process.execPath, ["bin/nodetrace.mjs", "add", "--target", tempDir, "--framework", "next"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  if (result.status !== 0) issues.push(`installer failed: ${output.slice(-2000)}`);
  const receiptPath = join(tempDir, ".nodetrace", "setup-receipt.json");
  if (existsSync(receiptPath)) {
    setupReceipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    if (!setupReceipt.ok) issues.push("setup receipt ok=false");
    if (setupReceipt.framework !== "next") issues.push(`expected next framework, got ${setupReceipt.framework}`);
    if (!setupReceipt.nextSteps?.includes("Open /nodetrace")) issues.push("setup receipt missing /nodetrace next step");
  } else {
    issues.push("missing setup receipt");
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

const report = {
  ok: issues.length === 0,
  startedAt: new Date(startedAtMs).toISOString(),
  completedAt: new Date().toISOString(),
  totalMs: Date.now() - startedAtMs,
  apiKeysRequired: false,
  framework: "next",
  phases: setupReceipt?.phases?.map((phase) => ({
    name: phase.name,
    ok: phase.ok,
    durationMs: phase.durationMs,
  })) ?? [],
  issues,
};
writeJson("docs/eval/nodetrace-next-e2e-smoke.json", report);

if (issues.length > 0) {
  console.error("nodetrace next e2e smoke: FAIL");
  for (const issue of issues) console.error(`  - ${issue}`);
  if (output.trim()) console.error(output.trim().slice(-3000));
  process.exitCode = 1;
} else {
  console.log(`nodetrace next e2e smoke: PASS ${Math.round(report.totalMs / 1000)}s`);
}

function createNextTarget(targetDir) {
  mkdirp(join(targetDir, "src", "app"));
  writeFileSync(join(targetDir, "package.json"), `\uFEFF${JSON.stringify({
    name: "nodetrace-next-e2e",
    private: true,
    type: "module",
    scripts: { build: "next build" },
    dependencies: {
      next: "^15.0.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    },
  }, null, 2)}\n`);
  writeFileSync(join(targetDir, "src", "app", "layout.tsx"), `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`);
  writeFileSync(join(targetDir, "src", "app", "page.tsx"), `export default function Page() {
  return <main>Home</main>;
}
`);
}

function mkdirp(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function writeJson(path, value) {
  const parent = dirname(path);
  if (parent && parent !== "." && !existsSync(parent)) mkdirSync(parent, { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
