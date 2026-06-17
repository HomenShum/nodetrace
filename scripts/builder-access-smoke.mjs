import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createBuilderAccessServer } from "../examples/builder-access/server-route.mjs";

const startedAt = new Date();
const tempDir = mkdtempSync(join(tmpdir(), "nodetrace-builder-access-"));
const dbPath = join(tempDir, "nodetrace.sqlite");
const statePath = join(tempDir, "nodetrace-state.json");
const reportPath = join(tempDir, "happy-path.json");
const token = "builder-token-local-smoke-012345";
const issues = [];

const init = spawnSync(process.execPath, ["scripts/init-sqlite.mjs", "--db", dbPath, "--state", statePath, "--json-out", reportPath], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: { ...process.env, NODETRACE_BUILDER_CAPABLE: "1" },
});
if (init.status !== 0) issues.push(`init failed: ${[init.stdout, init.stderr].join("\n").slice(-1200)}`);

let server;
try {
  if (issues.length === 0) {
    server = createBuilderAccessServer({ dbPath, token });
    const url = await listen(server);
    const unauthorized = await fetchWithRetry(`${url}/api/nodetrace/code-ownership?surfaceId=workSurface.traceStrip`);
    if (unauthorized.status !== 401) issues.push(`expected unauthorized status 401, got ${unauthorized.status}`);
    const authorized = await fetchWithRetry(`${url}/api/nodetrace/code-ownership?surfaceId=workSurface.traceStrip`, {
      headers: { "x-nodetrace-builder-token": token },
    });
    const body = await authorized.json();
    if (authorized.status !== 200 || !body.ok) issues.push(`authorized lookup failed: ${authorized.status} ${JSON.stringify(body)}`);
    if (!body.ownership?.componentRef || !body.ownership?.backendRef || !body.ownership?.testRef) {
      issues.push("authorized lookup missing component/backend/test ownership");
    }
  }
} finally {
  if (server) await close(server);
}

const report = {
  ok: issues.length === 0,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  apiKeysRequired: false,
  builderTokenRequired: true,
  issues,
};
writeJson("docs/eval/nodetrace-builder-access-smoke.json", report);
if (tempDir.startsWith(tmpdir())) rmSync(tempDir, { recursive: true, force: true });

if (issues.length > 0) {
  console.error("nodetrace builder access smoke: FAIL");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exitCode = 1;
} else {
  console.log("nodetrace builder access smoke: PASS");
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address !== "object") reject(new Error("server address unavailable"));
      else resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function fetchWithRetry(url, options) {
  let lastError;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError;
}

function writeJson(path, value) {
  const parent = dirname(path);
  if (parent && parent !== "." && !existsSync(parent)) mkdirSync(parent, { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
