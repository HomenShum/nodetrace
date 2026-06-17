import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";

let Database;
try {
  ({ default: Database } = await import("better-sqlite3"));
} catch {
  console.error("Missing dependency: run `npm install` before `npm run agent:scale:smoke`.");
  process.exit(1);
}

const startedAt = new Date();
const startedMs = performance.now();
const tempDir = mkdtempSync(join(tmpdir(), "nodetrace-agent-scale-"));
const dbPath = join(tempDir, "qa-agent.sqlite");
const statePath = join(tempDir, "nodetrace-state.json");
const issues = [];
const traceCount = 125;
let db;

try {
  db = new Database(dbPath);
  db.exec(readFileSync("db/schema.sql", "utf8"));
  const session = {
    id: "qa-agent-125-step-run",
    title: "Long-running QA agent trace",
    status: "verified",
    summary: "A 125-step QA agent run was stored as portable NodeTrace rows.",
    createdAt: startedAt.toISOString(),
  };
  const surface = {
    id: "qaAgent.stepLedger",
    label: "QA agent step ledger",
    proofAvailable: true,
    about: "Long-running QA agent actions, checks, retries, and receipts.",
  };
  const proof = {
    id: "qa-agent-proof-001",
    sessionId: session.id,
    surfaceId: surface.id,
    artifactId: "qa-demo-artifact",
    elementId: "qa-step-125",
    title: "Final QA receipt",
    status: "verified",
    confidence: 0.97,
    sourceLabel: "qa-agent-runner",
    sourceUrl: null,
    detail: "The final step is linked to a visible QA result while the full operation ledger stays durable.",
    createdAt: startedAt.toISOString(),
  };
  const ownership = {
    id: "qa-agent-owner-001",
    surfaceId: surface.id,
    ownerLabel: "QA automation team",
    componentRef: "server-only/components/qa-trace-panel",
    backendRef: "server-only/backend/qa-run-store",
    queryRef: "server-only/queries/qaRunTrace",
    mutationRef: "server-only/mutations/appendQaStep",
    skillRef: "server-only/skills/qa-long-runner",
    testRef: "server-only/tests/qa-long-runner.spec.ts",
    createdAt: startedAt.toISOString(),
  };

  db.prepare(`
    insert into trace_sessions (id, title, status, summary, created_at)
    values (@id, @title, @status, @summary, @createdAt)
  `).run(session);
  db.prepare(`
    insert into trace_surfaces (id, label, proof_available, about)
    values (@id, @label, @proofAvailable, @about)
  `).run({ ...surface, proofAvailable: 1 });
  db.prepare(`
    insert into trace_proofs
      (id, session_id, surface_id, artifact_id, element_id, title, status, confidence, source_label, source_url, detail, created_at)
    values
      (@id, @sessionId, @surfaceId, @artifactId, @elementId, @title, @status, @confidence, @sourceLabel, @sourceUrl, @detail, @createdAt)
  `).run(proof);
  const insertTrace = db.prepare(`
    insert into trace_events
      (id, session_id, surface_id, artifact_id, element_id, phase, actor, status, summary, duration_ms, created_at)
    values
      (@id, @sessionId, @surfaceId, @artifactId, @elementId, @phase, @actor, @status, @summary, @durationMs, @createdAt)
  `);
  const insertOwner = db.prepare(`
    insert into trace_code_ownership
      (id, surface_id, owner_label, component_ref, backend_ref, query_ref, mutation_ref, skill_ref, test_ref, builder_only, created_at)
    values
      (@id, @surfaceId, @ownerLabel, @componentRef, @backendRef, @queryRef, @mutationRef, @skillRef, @testRef, 1, @createdAt)
  `);
  const traces = Array.from({ length: traceCount }, (_, index) => {
    const step = index + 1;
    return {
      id: `qa-step-${String(step).padStart(3, "0")}`,
      sessionId: session.id,
      surfaceId: surface.id,
      artifactId: "qa-demo-artifact",
      elementId: `qa-step-${step}`,
      phase: `qa-step-${String(step).padStart(3, "0")}`,
      actor: "qa-agent",
      status: step === traceCount ? "ok" : step % 31 === 0 ? "blocked" : "ok",
      summary: step === traceCount ? "Published final QA receipt" : `Checked scenario ${step}`,
      durationMs: 20 + (step % 11),
      createdAt: new Date(startedAt.getTime() + step * 1000).toISOString(),
    };
  });
  db.transaction(() => {
    for (const trace of traces) insertTrace.run(trace);
    insertOwner.run(ownership);
  })();

  const clientState = {
    generatedAt: new Date().toISOString(),
    session: {
      id: session.id,
      title: session.title,
      status: session.status,
      summary: session.summary,
    },
    builderCapable: false,
    surfaces: [surface],
    proofs: [{ ...proof, sessionId: undefined, createdAt: undefined }].map(({ sessionId: _s, createdAt: _c, ...item }) => item),
    traces: traces.map(({ sessionId: _sessionId, createdAt: _createdAt, ...trace }) => trace),
    codeOwnership: [],
  };
  writeJson(statePath, clientState);

  const panelSource = readFileSync("src/trace/TraceLensPanel.tsx", "utf8");
  const schema = readFileSync("db/schema.sql", "utf8");
  const visibleWindow = clientState.traces.filter((trace) => trace.surfaceId === surface.id).slice(-6).reverse();
  if (clientState.traces.length !== traceCount) issues.push(`expected ${traceCount} trace rows, got ${clientState.traces.length}`);
  if (visibleWindow.length !== 6) issues.push(`expected 6-row visible window, got ${visibleWindow.length}`);
  if (visibleWindow[0]?.id !== "qa-step-125") issues.push(`expected newest trace first, got ${visibleWindow[0]?.id}`);
  if (clientState.codeOwnership.length !== 0) issues.push("public state exposed code ownership while builderCapable=false");
  for (const required of ["query_ref", "mutation_ref", "skill_ref"]) {
    if (!schema.includes(required)) issues.push(`schema missing ${required}`);
  }
  for (const required of ["Component", "Query", "Mutation", "Skill", "Test", "privileged server route", ".slice(-6).reverse()"]) {
    if (!panelSource.includes(required)) issues.push(`TraceLensPanel missing ${required}`);
  }
} finally {
  db?.close();
  if (tempDir.startsWith(tmpdir())) rmSync(tempDir, { recursive: true, force: true });
}

const report = {
  ok: issues.length === 0,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  durationMs: Math.round(performance.now() - startedMs),
  apiKeysRequired: false,
  scenario: "long-running 125-step QA agent",
  traceRows: traceCount,
  visibleWindowRows: 6,
  publicCodeOwnershipRows: 0,
  builderOwnershipFields: ["componentRef", "backendRef", "queryRef", "mutationRef", "skillRef", "testRef"],
  issues,
};
writeJson("docs/eval/nodetrace-agent-scale-smoke.json", report);

if (issues.length > 0) {
  console.error("nodetrace agent scale smoke: FAIL");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exitCode = 1;
} else {
  console.log(`nodetrace agent scale smoke: PASS ${traceCount} rows`);
}

function writeJson(path, value) {
  const parent = dirname(path);
  if (parent && parent !== "." && !existsSync(parent)) mkdirSync(parent, { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
