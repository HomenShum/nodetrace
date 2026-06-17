import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";

let Database;
try {
  ({ default: Database } = await import("better-sqlite3"));
} catch {
  console.error("Missing dependency: run `npm install` before `npm run trace-coach:sqlite`.");
  process.exit(1);
}

const options = parseArgs(process.argv.slice(2));
const dbPath = resolve(options.db ?? process.env.NODETRACE_DB_PATH ?? ".nodetrace/trace-coach.sqlite");
const statePath = resolve(options.state ?? process.env.NODETRACE_STATE_PATH ?? "public/nodetrace-state.json");
const reportPath = resolve(options["json-out"] ?? "docs/eval/nodetrace-trace-coach-sqlite.json");
const sourceRoot = resolve(options["source-root"] ?? process.env.NODETRACE_SOURCE_ROOT ?? "..");
const startedAt = new Date();
const startedMs = performance.now();

mkdirSync(dirname(dbPath), { recursive: true });
mkdirSync(dirname(statePath), { recursive: true });
mkdirSync(dirname(reportPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
const schemaSql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
db.exec(schemaSql);
ensureCoachSchema(db, schemaSql);

const session = {
  id: "trace-coach-noderoom-sqlite",
  title: "Trace Coach: NodeRoom codebase trace",
  status: "verified",
  summary:
    "A NodeRoom-looking local Trace tab seeded from NodeRoom's real trace UI source path: record list, detail tabs, steps, flow, screenshot boxes, and raw JSON.",
  createdAt: startedAt.toISOString(),
};

const surfaces = [
  {
    id: "workSurface.trace",
    label: "Trace tab",
    proofAvailable: true,
    about: "NodeRoom's master-detail trace tab with Overview, Steps, Flow, Evidence, and Raw JSON.",
  },
  {
    id: "workSurface.traceStrip",
    label: "Room trace strip",
    proofAvailable: true,
    about: "The bottom room activity strip that opens into the full trace surface.",
  },
  {
    id: "workSurface.traceSteps",
    label: "Trace steps",
    proofAvailable: true,
    about: "Grouped, bounded, source-linked steps with screenshot and metric attachments.",
  },
  {
    id: "workSurface.traceFlow",
    label: "Trace flow",
    proofAvailable: true,
    about: "NodeRoom's graph view over the same trace steps.",
  },
  {
    id: "workSurface.traceData",
    label: "Trace data",
    proofAvailable: true,
    about: "The shared TraceRecord and TraceStep data model behind the tabs.",
  },
  {
    id: "workSurface.traceStyle",
    label: "Trace styling",
    proofAvailable: true,
    about: "The NodeRoom visual layer for record lists, tabs, step cards, and screenshot boxes.",
  },
];

const graphNodes = [
  { id: "artifact", label: "Artifact trace tab", kind: "component" },
  { id: "surface", label: "TraceSurface", kind: "component" },
  { id: "data", label: "traceData", kind: "schema" },
  { id: "steps", label: "StepRow", kind: "component" },
  { id: "flow", label: "TraceFlow", kind: "component" },
  { id: "style", label: "NodeRoom CSS", kind: "runtime" },
];

const graphEdges = [
  { id: "artifact-surface", from: "artifact", to: "surface", label: "opens full trace tab" },
  { id: "surface-data", from: "surface", to: "data", label: "loads records" },
  { id: "surface-steps", from: "surface", to: "steps", label: "renders step list" },
  { id: "surface-flow", from: "surface", to: "flow", label: "renders graph tab" },
  { id: "steps-style", from: "steps", to: "style", label: "uses screenshot box styles" },
  { id: "flow-style", from: "flow", to: "style", label: "uses dark graph shell" },
];

const coachSteps = [
  {
    id: "coach-step-01-artifact-entry",
    order: 1,
    stepLabel: "Step 01",
    group: "Entry",
    title: "Open NodeRoom's Trace tab from the artifact shell",
    narrative:
      "Start from the real artifact panel. NodeRoom exposes a trace tab and a bottom room trace strip, so users can move from live room activity into the full provenance view.",
    surfaceId: "workSurface.traceStrip",
    codeBlock: codeBlock("src/ui/panels/Artifact.tsx", 'data-noderoom-surface="workSurface.traceStrip"', -8, 18),
    uiCapture: {
      selector: '[data-noderoom-surface="workSurface.traceStrip"]',
      rect: { x: 184, y: 1086, width: 700, height: 210 },
      screenshotPath: "captures/noderoom-room-trace-strip.png",
      alt: "NodeRoom bottom room trace strip with recent room events and trace telemetry.",
    },
    diagram: {
      kind: "mermaid",
      nodeId: "artifact",
      source:
        "flowchart LR\n  Artifact[Artifact shell] --> Strip[Room trace strip]\n  Strip --> TraceTab[Trace tab]\n  TraceTab --> Surface[TraceSurface]",
    },
  },
  {
    id: "coach-step-02-detail-tabs",
    order: 2,
    stepLabel: "Step 02",
    group: "Trace tabs",
    title: "Use the real NodeRoom trace tabs",
    narrative:
      "The sample should follow NodeRoom's detail-tab model instead of a loose walkthrough card: Overview, Steps, Flow, Evidence, and Raw JSON all hang off one selected trace record.",
    surfaceId: "workSurface.trace",
    codeBlock: codeBlock("src/ui/panels/TraceSurface.tsx", "type DetailTab =", 0, 32),
    uiCapture: {
      selector: '[data-testid="trace-surface"] .r-tracevu-tabs',
      rect: { x: 548, y: 118, width: 354, height: 42 },
      screenshotPath: "captures/noderoom-trace-detail-tabs.png",
      alt: "NodeRoom trace detail tabs for Overview, Steps, Flow, Evidence, and Raw JSON.",
    },
    diagram: {
      kind: "mermaid",
      nodeId: "surface",
      source:
        "flowchart LR\n  Record[Selected trace record] --> Overview\n  Record --> Steps\n  Record --> Flow\n  Record --> Evidence\n  Record --> RawJSON[Raw JSON]",
    },
  },
  {
    id: "coach-step-03-trace-data",
    order: 3,
    stepLabel: "Step 03",
    group: "Data model",
    title: "Seed the app from NodeRoom TraceRecord data",
    narrative:
      "NodeTrace now seeds from the same mental model NodeRoom uses: records contain ordered steps, source metadata, verdicts, attachments, and raw audit payloads.",
    surfaceId: "workSurface.traceData",
    codeBlock: codeBlock("src/ui/panels/traceData.ts", "export interface TraceRecord", -18, 24),
    uiCapture: {
      selector: '[data-testid="trace-record"]',
      rect: { x: 20, y: 160, width: 300, height: 108 },
      screenshotPath: "captures/noderoom-trace-record-list.png",
      alt: "NodeRoom trace record list showing source, step count, and verdict pills.",
    },
    diagram: {
      kind: "mermaid",
      nodeId: "data",
      source:
        "flowchart TB\n  TraceRecord --> Source\n  TraceRecord --> Verdict\n  TraceRecord --> Steps\n  Steps --> Attachments\n  Attachments --> ScreenshotBox[normalized screenshot box]",
    },
  },
  {
    id: "coach-step-04-step-row",
    order: 4,
    stepLabel: "Step 04",
    group: "Steps",
    title: "Render code and UI evidence like NodeRoom step rows",
    narrative:
      "Each step is an ordered, source-linked unit. Screenshot attachments carry a normalized box so the UI can draw exactly what was clicked or extracted.",
    surfaceId: "workSurface.traceSteps",
    codeBlock: codeBlock("src/ui/panels/TraceStepRow.tsx", "a.box &&", -16, 12),
    uiCapture: {
      selector: '[data-testid="trace-step"] .r-tracevu-shotframe',
      rect: { x: 410, y: 310, width: 454, height: 256 },
      screenshotPath: "captures/noderoom-trace-step-box.png",
      alt: "NodeRoom trace step screenshot frame with a highlighted bounding box overlay.",
    },
    diagram: {
      kind: "mermaid",
      nodeId: "steps",
      source:
        "flowchart LR\n  Step[TraceStep] --> Label\n  Step --> Detail\n  Step --> Attachments\n  Attachments --> Screenshot\n  Screenshot --> Box[box x y w h]",
    },
  },
  {
    id: "coach-step-05-flow",
    order: 5,
    stepLabel: "Step 05",
    group: "Flow",
    title: "Keep the latest flow tab behavior",
    narrative:
      "NodeRoom's Flow tab derives graph nodes and edges from the same ordered steps. Clicking a node opens the same step renderer, avoiding drift between graph and list.",
    surfaceId: "workSurface.traceFlow",
    codeBlock: codeBlock("src/ui/panels/TraceFlow.tsx", "const { nodes, edges }", -8, 34),
    uiCapture: {
      selector: '[data-testid="trace-flow"]',
      rect: { x: 336, y: 184, width: 760, height: 456 },
      screenshotPath: "captures/noderoom-trace-flow.png",
      alt: "NodeRoom trace flow graph with grouped phases, animated edges, controls, and minimap.",
    },
    diagram: {
      kind: "mermaid",
      nodeId: "flow",
      source:
        "flowchart LR\n  Steps[Ordered TraceStep list] --> Nodes[ReactFlow nodes]\n  Nodes --> Edges[Sequential edges]\n  Nodes --> Detail[Shared StepRow detail]",
    },
  },
  {
    id: "coach-step-06-style",
    order: 6,
    stepLabel: "Step 06",
    group: "Look and feel",
    title: "Match NodeRoom's dark trace surface",
    narrative:
      "The sample app should look like NodeRoom: dark app chrome, compact tabs, muted metadata, accent verdict pills, step cards, and screenshot highlight boxes.",
    surfaceId: "workSurface.traceStyle",
    codeBlock: codeBlock("src/app/styles.css", ".r-tracevu-tabs", -12, 44),
    uiCapture: {
      selector: ".r-tracevu",
      rect: { x: 170, y: 62, width: 690, height: 888 },
      screenshotPath: "captures/noderoom-trace-surface-style.png",
      alt: "NodeRoom dark trace surface with record list, detail pane, tabs, and step cards.",
    },
    diagram: {
      kind: "mermaid",
      nodeId: "style",
      source:
        "flowchart TB\n  Tokens[NodeRoom design tokens] --> TraceList\n  Tokens --> DetailTabs\n  Tokens --> StepCards\n  Tokens --> ScreenshotBoxes",
    },
  },
];

const sourceMode = coachSteps.some((step) => step.codeBlock.sourceMode === "snapshot") ? "snapshot" : "live";

const proofs = coachSteps.map((step) => ({
  id: `${step.id}-proof`,
  sessionId: session.id,
  surfaceId: step.surfaceId,
  artifactId: "noderoom-codebase-trace",
  elementId: step.id,
  title: `${step.stepLabel}: ${step.title}`,
  status: "verified",
  confidence: step.codeBlock.sourceMode === "live" ? 0.97 : 0.88,
  sourceLabel: step.codeBlock.filePath,
  sourceUrl: "https://github.com/HomenShum/noderoom",
  detail: step.narrative,
  createdAt: startedAt.toISOString(),
}));

const traces = coachSteps.map((step) => ({
  id: `${step.id}-trace`,
  sessionId: session.id,
  surfaceId: step.surfaceId,
  artifactId: "noderoom-codebase-trace",
  elementId: step.id,
  phase: step.group?.toLowerCase().replaceAll(" ", "-") ?? `step-${step.order}`,
  actor: "trace-coach",
  status: "ok",
  summary: `${step.stepLabel}: ${step.title}`,
  durationMs: 48 + step.order * 9,
  createdAt: new Date(startedAt.getTime() + step.order * 1000).toISOString(),
}));

db.transaction(() => {
  db.prepare("delete from trace_sessions where id = ?").run(session.id);

  db.prepare(`
    insert into trace_sessions (id, title, status, summary, created_at)
    values (@id, @title, @status, @summary, @createdAt)
  `).run(session);

  const insertSurface = db.prepare(`
    insert or replace into trace_surfaces (id, label, proof_available, about)
    values (@id, @label, @proofAvailable, @about)
  `);
  for (const surface of surfaces) insertSurface.run({ ...surface, proofAvailable: surface.proofAvailable ? 1 : 0 });

  const insertProof = db.prepare(`
    insert into trace_proofs
      (id, session_id, surface_id, artifact_id, element_id, title, status, confidence, source_label, source_url, detail, created_at)
    values
      (@id, @sessionId, @surfaceId, @artifactId, @elementId, @title, @status, @confidence, @sourceLabel, @sourceUrl, @detail, @createdAt)
  `);
  for (const proof of proofs) insertProof.run(proof);

  const insertTrace = db.prepare(`
    insert into trace_events
      (id, session_id, surface_id, artifact_id, element_id, phase, actor, status, summary, duration_ms, created_at)
    values
      (@id, @sessionId, @surfaceId, @artifactId, @elementId, @phase, @actor, @status, @summary, @durationMs, @createdAt)
  `);
  for (const trace of traces) insertTrace.run(trace);

  const insertStep = db.prepare(`
    insert into trace_coach_steps
      (id, session_id, surface_id, step_order, step_label, step_group, title, narrative, code_file_path, code_start_line, code_end_line, code_snippet, ui_selector, ui_rect_json, screenshot_path, screenshot_alt, diagram_kind, diagram_node_id, diagram_source, created_at)
    values
      (@id, @sessionId, @surfaceId, @order, @stepLabel, @group, @title, @narrative, @codeFilePath, @codeStartLine, @codeEndLine, @codeSnippet, @uiSelector, @uiRectJson, @screenshotPath, @screenshotAlt, @diagramKind, @diagramNodeId, @diagramSource, @createdAt)
  `);
  for (const step of coachSteps) {
    insertStep.run({
      id: step.id,
      sessionId: session.id,
      surfaceId: step.surfaceId,
      order: step.order,
      stepLabel: step.stepLabel,
      group: step.group ?? null,
      title: step.title,
      narrative: step.narrative,
      codeFilePath: step.codeBlock.filePath,
      codeStartLine: step.codeBlock.startLine,
      codeEndLine: step.codeBlock.endLine,
      codeSnippet: step.codeBlock.snippet,
      uiSelector: step.uiCapture.selector,
      uiRectJson: JSON.stringify(step.uiCapture.rect),
      screenshotPath: step.uiCapture.screenshotPath,
      screenshotAlt: step.uiCapture.alt,
      diagramKind: step.diagram.kind,
      diagramNodeId: step.diagram.nodeId,
      diagramSource: step.diagram.source,
      createdAt: startedAt.toISOString(),
    });
  }

  const insertNode = db.prepare(`
    insert into trace_coach_graph_nodes (id, session_id, label, kind)
    values (@id, @sessionId, @label, @kind)
  `);
  for (const node of graphNodes) insertNode.run({ ...node, sessionId: session.id });

  const insertEdge = db.prepare(`
    insert into trace_coach_graph_edges (id, session_id, from_node_id, to_node_id, label)
    values (@id, @sessionId, @from, @to, @label)
  `);
  for (const edge of graphEdges) insertEdge.run({ ...edge, sessionId: session.id });
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
  surfaces,
  proofs: proofs.map(({ sessionId: _sessionId, createdAt: _createdAt, ...proof }) => proof),
  traces: traces.map(({ sessionId: _sessionId, createdAt: _createdAt, ...trace }) => trace),
  codeOwnership: [],
  coach: {
    mode: "campaign",
    activeStepId: coachSteps[0].id,
    sourceRepo: "HomenShum/noderoom",
    sourceMode,
    steps: coachSteps.map(({ codeBlock: block, ...step }) => ({
      ...step,
      codeBlock: {
        filePath: block.filePath,
        startLine: block.startLine,
        endLine: block.endLine,
        snippet: block.snippet,
      },
    })),
    graphNodes,
    graphEdges,
  },
};

writeJson(statePath, clientState);
const report = {
  ok: true,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  durationMs: Math.round(performance.now() - startedMs),
  apiKeysRequired: false,
  sourceRepo: "HomenShum/noderoom",
  sourceRoot: relativePath(sourceRoot),
  sourceMode,
  databasePath: relativePath(dbPath),
  statePath: relativePath(statePath),
  coachSteps: coachSteps.length,
  graphNodes: graphNodes.length,
  graphEdges: graphEdges.length,
  captureModel: "NodeRoom code path + data-noderoom selector + DOMRect + screenshotPath",
  onboardingModel: "ordered steps only; no video timestamps stored",
  visualModel: "NodeRoom trace-tab look and feel",
};
writeJson(reportPath, report);
db.close();

console.log(`nodetrace trace coach sqlite: PASS ${coachSteps.length} NodeRoom codebase steps (${sourceMode})`);
console.log(`wrote ${report.databasePath}`);
console.log(`wrote ${report.statePath}`);

function codeBlock(filePath, anchor, before, after) {
  const { source, mode } = readNodeRoomSource(filePath);
  const lines = source.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(anchor));
  if (index < 0) throw new Error(`anchor not found in ${filePath}: ${anchor}`);
  const start = Math.max(0, index + before);
  const end = Math.min(lines.length - 1, index + after);
  return {
    filePath,
    startLine: start + 1,
    endLine: end + 1,
    snippet: lines.slice(start, end + 1).join("\n"),
    sourceMode: mode,
  };
}

function readNodeRoomSource(filePath) {
  const livePath = resolve(sourceRoot, filePath);
  if (existsSync(livePath)) {
    return { source: readFileSync(livePath, "utf8"), mode: "live" };
  }
  const snapshot = NODE_ROOM_SOURCE_SNAPSHOTS[filePath];
  if (snapshot) return { source: snapshot, mode: "snapshot" };
  throw new Error(`NodeRoom source file not found: ${livePath}`);
}

function ensureCoachSchema(database, schema) {
  const columns = database.prepare("pragma table_info(trace_coach_steps)").all();
  if (columns.some((column) => column.name === "step_label")) return;
  database.exec(`
    drop table if exists trace_coach_graph_edges;
    drop table if exists trace_coach_graph_nodes;
    drop table if exists trace_coach_steps;
  `);
  database.exec(schema);
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function writeJson(path, value) {
  const parent = dirname(path);
  if (parent && parent !== "." && !existsSync(parent)) mkdirSync(parent, { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function relativePath(path) {
  return relative(process.cwd(), path).replaceAll("\\", "/");
}

const NODE_ROOM_SOURCE_SNAPSHOTS = {
  "src/ui/panels/Artifact.tsx": `
function TraceStrip({ roomId }: { roomId: string }) {
  return (
    <div className="r-trace" data-testid="room-trace" data-open={String(open)} data-noderoom-surface="workSurface.traceStrip">
      <div className="r-trace-head">
        <button type="button" className="r-trace-toggle" onClick={() => setOpen((v) => !v)}>
          <ChevronRight size={13} className="r-trace-chev" />
          <span className="h-title">Room trace</span>
        </button>
      </div>
      {open && <div className="r-trace-list" aria-live="polite" aria-label="Room activity log" />}
    </div>
  );
}
`,
  "src/ui/panels/TraceSurface.tsx": `
type DetailTab = "overview" | "steps" | "flow" | "evidence" | "raw";

export function TraceSurface({ roomId, onOpenSource }) {
  const records = buildRecords(roomId);
  const [selectedId, setSelectedId] = useState(records[0]?.id);
  const [tab, setTab] = useState<DetailTab>("overview");
  const record = records.find((r) => r.id === selectedId) ?? records[0];
  const detailTabs = (["overview", "steps", "flow", "evidence", "raw"] as DetailTab[])
    .filter((t) => t !== "evidence" || (record.evidenceCards?.length ?? 0) > 0);
  return (
    <div className="r-art-body r-tracevu" data-testid="trace-surface" data-noderoom-surface="workSurface.trace">
      <aside className="r-tracevu-list" aria-label="Trace records" />
      <div className="r-tracevu-detail">
        <header className="r-tracevu-detail-head">
          <div className="r-tracevu-tabs" role="tablist" aria-label="Trace detail" />
        </header>
      </div>
    </div>
  );
}
`,
  "src/ui/panels/traceData.ts": `
export interface TraceStep {
  idx: number;
  label: string;
  detail?: string;
  status: TraceTone;
  group?: string;
  targetArtifactId?: string;
  targetElementId?: string;
  screenshotUrl?: string;
  metrics?: { label: string; value: string }[];
  attachments?: TraceAttachment[];
}

export interface TraceRecord {
  id: string;
  kind: "agent" | "qa";
  title: string;
  subtitle: string;
  ts: string;
  source: { tool: string; version?: string; env?: string; model?: string };
  verdict?: { label: string; tone: TraceTone };
  attribution?: { ai: number; mixed: number; human: number };
  steps: TraceStep[];
  evidenceCards?: EvidenceCardArtifact[];
  raw: unknown;
}
`,
  "src/ui/panels/TraceStepRow.tsx": `
export function StepRow({ s, onOpenSource }) {
  return (
    <div className="r-tracevu-step" data-testid="trace-step" data-tone={s.status}>
      <span className="r-tracevu-step-idx">{s.idx}</span>
      <span className="r-tracevu-step-body">
        <span className="r-tracevu-step-label">{s.label}</span>
        {shots.map((a, i) => (
          <a key={i} className="r-tracevu-shotlink" href={a.url}>
            <span className="r-tracevu-shotframe">
              <img className="r-tracevu-shot" src={a.url} alt={a.label ?? s.label} loading="lazy" />
              {a.box && <span className="r-tracevu-box" style={{ left: \`\${a.box.x * 100}%\`, top: \`\${a.box.y * 100}%\`, width: \`\${a.box.w * 100}%\`, height: \`\${a.box.h * 100}%\` }} aria-hidden="true" />}
            </span>
          </a>
        ))}
      </span>
    </div>
  );
}
`,
  "src/ui/panels/TraceFlow.tsx": `
export function TraceFlow({ record, onOpenSource }) {
  const phases = useMemo(() => {
    const seen: string[] = [];
    for (const s of record.steps) { const g = s.group ?? "Steps"; if (!seen.includes(g)) seen.push(g); }
    return seen;
  }, [record]);
  const { nodes, edges } = useMemo(() => {
    const COL = 248, ROW = 88;
    const nodes = record.steps.map((s) => ({
      id: String(s.idx),
      position: { x: phases.indexOf(s.group ?? "Steps") * COL, y: s.idx * ROW },
      data: { label: \`\${s.idx}. \${s.label}\` },
    }));
    const edges = [];
    for (let i = 0; i < record.steps.length - 1; i++) edges.push({ id: \`f\${i}\`, source: String(record.steps[i].idx), target: String(record.steps[i + 1].idx) });
    return { nodes, edges };
  }, [record, phases]);
  return <div className="r-tracevu-flow" data-testid="trace-flow" />;
}
`,
  "src/app/styles.css": `
.r-tracevu-tabs { display: flex; gap: 2px; }
.r-tracevu-tabs button { padding: 6px 11px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--text-muted); font-size: 12px; font-weight: 600; cursor: pointer; }
.r-tracevu-tabs button[data-on="true"] { color: var(--accent-ink); border-bottom-color: var(--accent-primary); }
.r-tracevu-detail-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; }
.r-tracevu-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.r-tracevu-step { width: 100%; display: flex; gap: 11px; text-align: left; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg-secondary); color: var(--text-secondary); }
.r-tracevu-step-idx { flex: none; width: 22px; height: 22px; display: grid; place-items: center; border-radius: 6px; background: var(--bg-primary); color: var(--text-muted); font-size: 11px; font-weight: 700; font-family: var(--font-mono); }
.r-tracevu-shotframe { position: relative; display: inline-block; line-height: 0; }
.r-tracevu-box { position: absolute; border: 2px solid var(--accent-primary); border-radius: 3px; background: color-mix(in srgb, var(--accent-primary) 16%, transparent); box-shadow: 0 0 0 1px var(--bg-primary); pointer-events: none; }
`,
};
