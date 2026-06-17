import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { captureCodebaseFromPlan, findFreePort } from "../src/capture/codebaseCapture.mjs";

if (isMain()) await main();

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourceRoot = resolve(options["source-root"] ?? process.env.NODETRACE_SOURCE_ROOT ?? "..");
  const captureRoot = resolve(options["capture-root"] ?? process.env.NODETRACE_CAPTURE_ROOT ?? "public/captures");
  const manifestPath = resolve(options.manifest ?? process.env.NODETRACE_REAL_CAPTURE_MANIFEST ?? `${captureRoot}/noderoom-real-capture-manifest.json`);
  const host = options.host ?? "127.0.0.1";
  const timeoutMs = Number(options["timeout-ms"] ?? 120_000);
  const codeCli = options["code-cli"] ?? process.env.NODETRACE_CODE_CLI ?? "code";
  const editorCapture = options["editor-capture"] ?? process.env.NODETRACE_EDITOR_CAPTURE ?? "code-browser";

  if (!existsSync(resolve(sourceRoot, "package.json"))) {
    console.error(`NodeRoom source root not found: ${sourceRoot}`);
    process.exit(1);
  }

  const nodeRoomPort = Number(options["node-room-port"] ?? await findFreePort(5179, host));
  const vscodePort = Number(options["vscode-port"] ?? await findFreePort(5199, host));
  const appUrl = options["node-room-url"];
  const plan = buildNodeRoomCapturePlan({
    sourceRoot,
    captureRoot,
    manifestPath,
    host,
    timeoutMs,
    codeCli,
    editorCapture,
    nodeRoomPort,
    vscodePort,
    appUrl,
  });

  const result = await captureCodebaseFromPlan(plan, { cwd: resolve(dirname(fileURLToPath(import.meta.url)), "..") });
  console.log(`nodetrace real capture: PASS ${result.steps.length} code-browser screenshots + ${result.steps.length} NodeRoom screenshots`);
  console.log(`wrote ${relativePath(result.manifestPath)}`);
}

export function buildNodeRoomCapturePlan({
  sourceRoot = "..",
  captureRoot = "public/captures",
  manifestPath = "public/captures/noderoom-real-capture-manifest.json",
  host = "127.0.0.1",
  timeoutMs = 120_000,
  codeCli = "code",
  editorCapture = "code-browser",
  nodeRoomPort = 5179,
  vscodePort = 5199,
  appUrl,
} = {}) {
  return {
    id: "noderoom-real-capture",
    generator: "nodetrace real NodeRoom capture",
    sourceRepo: "HomenShum/noderoom",
    sourceRoot,
    captureRoot,
    manifestPath,
    timeoutMs,
    editor: {
      mode: editorCapture,
      codeCli,
      host,
      port: vscodePort,
    },
    app: {
      name: "NodeRoom",
      url: appUrl,
      host,
      port: nodeRoomPort,
      startCommand: appUrl ? undefined : {
        command: "npm",
        args: ["run", "dev", "--", "--host", "{host}", "--port", "{port}", "--strictPort"],
      },
      startCwd: sourceRoot,
      setupActions: [
        { type: "goto", query: { mode: "memory" } },
        { type: "localStorage.set", key: "noderoom:tour:v1", value: "done" },
        { type: "click", testId: "start-demo-room", ifVisible: true, timeoutMs: 1500 },
        { type: "waitFor", testId: "artifact-panel" },
        { type: "click", testId: "trace-tab" },
        { type: "waitFor", testId: "trace-surface" },
      ],
    },
    steps: [
      {
        id: "coach-step-01-artifact-entry",
        source: {
          filePath: "src/ui/panels/Artifact.tsx",
          anchor: 'data-noderoom-surface="workSurface.traceStrip"',
          before: -8,
          after: 18,
        },
        ui: {
          selector: '[data-noderoom-surface="workSurface.traceStrip"]',
          actions: [{ type: "waitFor", testId: "room-trace" }],
          captureKind: "actual-noderoom-playwright",
        },
      },
      {
        id: "coach-step-02-detail-tabs",
        source: {
          filePath: "src/ui/panels/TraceSurface.tsx",
          anchor: "const detailTabs =",
          before: -4,
          after: 32,
        },
        ui: {
          selector: '[data-testid="trace-surface"] .r-tracevu-tabs',
          actions: [
            { type: "waitFor", testId: "trace-surface" },
            { type: "click", testId: "trace-tab-overview" },
          ],
          captureKind: "actual-noderoom-playwright",
        },
      },
      {
        id: "coach-step-03-trace-data",
        source: {
          filePath: "src/ui/panels/traceData.ts",
          anchor: "export interface TraceRecord",
          before: -18,
          after: 24,
        },
        ui: {
          selector: '[data-testid="trace-record"]',
          actions: [
            { type: "waitFor", testId: "trace-surface" },
            { type: "click", testId: "trace-tab-overview" },
          ],
          captureKind: "actual-noderoom-playwright",
        },
      },
      {
        id: "coach-step-04-step-row",
        source: {
          filePath: "src/ui/panels/TraceStepRow.tsx",
          anchor: "a.box &&",
          before: -16,
          after: 12,
        },
        ui: {
          selector: '[data-testid="trace-step"] .r-tracevu-shotframe',
          actions: [
            { type: "waitFor", testId: "trace-surface" },
            { type: "click", testId: "trace-record", hasText: "QA", ifAttributeNot: { name: "data-on", value: "true" } },
            { type: "click", testId: "trace-tab-steps" },
          ],
          waitForImage: true,
          captureKind: "actual-noderoom-playwright",
        },
      },
      {
        id: "coach-step-05-flow",
        source: {
          filePath: "src/ui/panels/TraceFlow.tsx",
          anchor: "const { nodes, edges }",
          before: -8,
          after: 34,
        },
        ui: {
          selector: '[data-testid="trace-flow"]',
          actions: [
            { type: "waitFor", testId: "trace-surface" },
            { type: "click", testId: "trace-record", hasText: "QA", ifAttributeNot: { name: "data-on", value: "true" } },
            { type: "click", testId: "trace-tab-flow" },
          ],
          captureKind: "actual-noderoom-playwright",
        },
      },
      {
        id: "coach-step-06-style",
        source: {
          filePath: "src/app/styles.css",
          anchor: ".r-tracevu-tabs",
          before: -12,
          after: 44,
        },
        ui: {
          selector: ".r-tracevu",
          actions: [
            { type: "waitFor", testId: "trace-surface" },
            { type: "click", testId: "trace-tab-overview" },
          ],
          captureKind: "actual-noderoom-playwright",
        },
      },
    ],
  };
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
      continue;
    }
    const next = args[index + 1];
    if (!next || next.startsWith("--")) parsed[rawKey] = "true";
    else {
      parsed[rawKey] = next;
      index += 1;
    }
  }
  return parsed;
}

function relativePath(path) {
  return relative(process.cwd(), path).replaceAll("\\", "/");
}

function isMain() {
  return process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
}
