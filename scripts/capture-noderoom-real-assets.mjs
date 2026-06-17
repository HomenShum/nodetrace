import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Missing dependency: run `npm install` before `npm run capture:noderoom:real`.");
  process.exit(1);
}

const options = parseArgs(process.argv.slice(2));
const sourceRoot = resolve(options["source-root"] ?? process.env.NODETRACE_SOURCE_ROOT ?? "..");
const captureRoot = resolve(options["capture-root"] ?? process.env.NODETRACE_CAPTURE_ROOT ?? "public/captures");
const manifestPath = resolve(options.manifest ?? process.env.NODETRACE_REAL_CAPTURE_MANIFEST ?? `${captureRoot}/noderoom-real-capture-manifest.json`);
const host = options.host ?? "127.0.0.1";
const timeoutMs = Number(options["timeout-ms"] ?? 120_000);
const codeCli = options["code-cli"] ?? process.env.NODETRACE_CODE_CLI ?? "code";
const editorCapture = options["editor-capture"] ?? process.env.NODETRACE_EDITOR_CAPTURE ?? (process.platform === "win32" ? "desktop" : "web");
const vscodeUserDataDir = resolve(tmpdir(), "nodetrace-vscode-user-data");
const vscodeExtensionsDir = resolve(tmpdir(), "nodetrace-vscode-extensions");

if (!existsSync(resolve(sourceRoot, "package.json"))) {
  console.error(`NodeRoom source root not found: ${sourceRoot}`);
  process.exit(1);
}

mkdirSync(captureRoot, { recursive: true });
mkdirSync(dirname(manifestPath), { recursive: true });
const vscodeSourceRoot = prepareVsCodeSourceRoot(sourceRoot);

const childProcesses = [];
process.on("exit", () => {
  for (const child of childProcesses) killTree(child);
});

const nodeRoomPort = Number(options["node-room-port"] ?? await findFreePort(5179));
const vscodePort = Number(options["vscode-port"] ?? await findFreePort(5199));
const nodeRoomBaseUrl = options["node-room-url"] ?? await startNodeRoomDevServer({ host, port: nodeRoomPort, sourceRoot, timeoutMs });
const vscodeBaseUrl = editorCapture === "web"
  ? options["vscode-url"] ?? await startVsCodeWebServer({ host, port: vscodePort, sourceRoot: vscodeSourceRoot, codeCli, timeoutMs })
  : null;

const browser = await chromium.launch({ headless: true });
const steps = buildStepSpecs(sourceRoot);
try {
  if (editorCapture === "web") {
    const vscodePage = await browser.newPage({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 });
    await captureVsCodeWebSteps({ page: vscodePage, vscodeBaseUrl, steps, captureRoot, timeoutMs });
  } else if (editorCapture === "desktop") {
    await captureVsCodeDesktopSteps({ steps, captureRoot, sourceRoot: vscodeSourceRoot, codeCli, timeoutMs, userDataDir: vscodeUserDataDir, extensionsDir: vscodeExtensionsDir });
  } else {
    throw new Error(`Unsupported editor capture mode: ${editorCapture}. Use desktop or web.`);
  }

  const nodeRoomPage = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await captureNodeRoomSteps({ page: nodeRoomPage, nodeRoomBaseUrl, steps, captureRoot, timeoutMs });
} finally {
  await browser.close();
  for (const child of childProcesses.splice(0)) killTree(child);
}

const manifest = {
  generator: "nodetrace real NodeRoom capture",
  generatedAt: new Date().toISOString(),
  sourceRepo: "HomenShum/noderoom",
  sourceRoot: relativePath(sourceRoot),
  nodeRoomUrl: nodeRoomBaseUrl,
  vscodeUrl: vscodeBaseUrl ?? "desktop:code --goto",
  captureModel: `actual VS Code ${editorCapture} screenshots + actual running NodeRoom Playwright screenshots`,
  steps: steps.map((step) => ({
    id: step.id,
    sourceView: {
      captureKind: `actual-vscode-${editorCapture}`,
      filePath: step.filePath,
      startLine: step.startLine,
      endLine: step.endLine,
      imagePath: capturePath(`${step.id}-ide.png`),
    },
    uiCapture: {
      captureKind: "actual-noderoom-playwright",
      selector: step.uiSelector,
      rect: step.actualRect,
      screenshotPath: capturePath(`${step.id}-ui.png`),
    },
  })),
};
writeJson(manifestPath, manifest);
console.log(`nodetrace real capture: PASS ${steps.length} VS Code screenshots + ${steps.length} NodeRoom screenshots`);
console.log(`wrote ${relativePath(manifestPath)}`);

async function captureVsCodeWebSteps({ page, vscodeBaseUrl, steps, captureRoot, timeoutMs }) {
  await page.goto(vscodeBaseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.locator(".monaco-workbench").waitFor({ state: "visible", timeout: timeoutMs });
  await dismissVsCodeDialog(page);
  for (const step of steps) {
    await page.locator(".monaco-workbench").click({ position: { x: 320, y: 240 } }).catch(() => undefined);
    await openVsCodeFile(page, `${step.filePath}:${step.startLine}`, timeoutMs);
    await page.locator(".monaco-editor .view-lines").first().waitFor({ state: "visible", timeout: timeoutMs });
    await delay(450);
    await page.screenshot({ path: resolve(captureRoot, `${step.id}-ide.png`), fullPage: false });
  }
}

async function captureVsCodeDesktopSteps({ steps, captureRoot, sourceRoot, codeCli, timeoutMs, userDataDir, extensionsDir }) {
  if (process.platform !== "win32") throw new Error("VS Code desktop capture is currently implemented for Windows. Use --editor-capture=web on other platforms.");
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(extensionsDir, { recursive: true });
  for (const step of steps) {
    console.log(`capturing VS Code: ${step.id} ${step.filePath}:${step.startLine}`);
    const target = `${resolve(sourceRoot, step.filePath)}:${step.startLine}`;
    const titleHint = step.filePath.split("/").at(-1);
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        openVsCodeDesktopFile(codeCli, target, timeoutMs, userDataDir, extensionsDir);
        await delay(2500 + attempt * 700);
        captureVsCodeWindowPng(resolve(captureRoot, `${step.id}-ide.png`), titleHint, timeoutMs, userDataDir);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (!String(error instanceof Error ? error.message : error).includes("expected file title")) throw error;
      }
    }
    if (lastError) throw lastError;
  }
}

async function openVsCodeFile(page, fileWithLine, timeoutMs) {
  await runVsCodeCommand(page, "Go to File...", timeoutMs);
  await fillVsCodeQuickInput(page, fileWithLine, timeoutMs);
}

async function runVsCodeCommand(page, command, timeoutMs) {
  await page.keyboard.press("F1");
  await fillVsCodeQuickInput(page, command, timeoutMs);
}

async function fillVsCodeQuickInput(page, value, timeoutMs) {
  const input = page.locator(".quick-input-widget:visible input").first();
  await input.waitFor({ state: "visible", timeout: timeoutMs });
  await input.fill(value);
  await page.keyboard.press("Enter");
}

async function captureNodeRoomSteps({ page, nodeRoomBaseUrl, steps, captureRoot, timeoutMs }) {
  await enterDemoRoom(page, nodeRoomBaseUrl, timeoutMs);
  for (const step of steps) {
    console.log(`capturing NodeRoom: ${step.id} ${step.uiSelector}`);
    await prepareNodeRoomStep(page, step, timeoutMs);
    const locator = page.locator(step.uiSelector).first();
    await locator.scrollIntoViewIfNeeded({ timeout: timeoutMs }).catch(() => undefined);
    await locator.waitFor({ state: "visible", timeout: timeoutMs });
    if (step.waitForImage) await waitForLoadedImage(locator, timeoutMs);
    const rect = await locator.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    });
    if (rect.width < 20 || rect.height < 20) throw new Error(`capture target too small for ${step.id}: ${JSON.stringify(rect)}`);
    step.actualRect = rect;
    await locator.screenshot({ path: resolve(captureRoot, `${step.id}-ui.png`) });
  }
}

async function waitForLoadedImage(locator, timeoutMs) {
  const image = locator.locator("img").first();
  await image.waitFor({ state: "visible", timeout: timeoutMs });
  await image.evaluate(
    (img) =>
      new Promise((resolveImage, rejectImage) => {
        const ready = () => img.complete && img.naturalWidth > 20 && img.naturalHeight > 20;
        if (ready()) {
          resolveImage(true);
          return;
        }
        const timeout = setTimeout(() => rejectImage(new Error("image did not load")), 15000);
        img.addEventListener("load", () => {
          if (ready()) {
            clearTimeout(timeout);
            resolveImage(true);
          }
        }, { once: true });
        img.addEventListener("error", () => {
          clearTimeout(timeout);
          rejectImage(new Error("image failed to load"));
        }, { once: true });
      }),
  );
}

async function enterDemoRoom(page, baseUrl, timeoutMs) {
  const url = new URL(baseUrl);
  url.searchParams.set("mode", "memory");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.evaluate(() => {
    try {
      localStorage.setItem("noderoom:tour:v1", "done");
    } catch {
      /* ignore */
    }
  });
  const artifactPanel = page.getByTestId("artifact-panel");
  const insideRoom = await artifactPanel.waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false);
  if (!insideRoom) {
    await page.getByTestId("start-demo-room").waitFor({ state: "visible", timeout: timeoutMs });
    await page.getByTestId("start-demo-room").click();
  }
  await artifactPanel.waitFor({ state: "visible", timeout: timeoutMs });
  const traceTab = page.getByTestId("trace-tab");
  await traceTab.waitFor({ state: "visible", timeout: timeoutMs });
  await traceTab.click();
  await page.getByTestId("trace-surface").waitFor({ state: "visible", timeout: timeoutMs });
}

async function prepareNodeRoomStep(page, step, timeoutMs) {
  if (step.uiState === "strip") {
    const strip = page.getByTestId("room-trace");
    await strip.waitFor({ state: "visible", timeout: timeoutMs });
    return;
  }
  await page.getByTestId("trace-surface").waitFor({ state: "visible", timeout: timeoutMs });
  if (step.uiState === "steps" || step.uiState === "flow") {
    await selectQaTraceRecord(page, timeoutMs);
  }
  if (step.uiState === "steps") {
    await page.getByTestId("trace-tab-steps").click();
  } else if (step.uiState === "flow") {
    await page.getByTestId("trace-tab-flow").click();
  } else if (step.uiState === "overview") {
    await page.getByTestId("trace-tab-overview").click();
  }
}

async function selectQaTraceRecord(page, timeoutMs) {
  const qaRecord = page.getByTestId("trace-record").filter({ hasText: "QA" }).first();
  await qaRecord.waitFor({ state: "visible", timeout: timeoutMs });
  if ((await qaRecord.getAttribute("data-on")) !== "true") await qaRecord.click();
}

async function dismissVsCodeDialog(page) {
  for (const name of ["Yes, I trust the authors", "I Trust the Authors", "Mark Done", "Continue"]) {
    const button = page.getByRole("button", { name });
    if (await button.isVisible({ timeout: 700 }).catch(() => false)) {
      await button.click().catch(() => undefined);
    }
  }
}

async function startNodeRoomDevServer({ host, port, sourceRoot, timeoutMs }) {
  const child = spawnPortable("npm", ["run", "dev", "--", "--host", host, "--port", String(port), "--strictPort"], {
    cwd: sourceRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  childProcesses.push(child);
  child.stdout.on("data", (chunk) => process.stdout.write(`[noderoom] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[noderoom] ${chunk}`));
  const url = `http://${host}:${port}/`;
  await waitForHttp(url, timeoutMs, "NodeRoom dev server");
  return url;
}

async function startVsCodeWebServer({ host, port, sourceRoot, codeCli, timeoutMs }) {
  const child = spawnPortable(codeCli, [
    "serve-web",
    "--without-connection-token",
    "--accept-server-license-terms",
    "--disable-telemetry",
    "--host",
    host,
    "--port",
    String(port),
    "--default-folder",
    sourceRoot,
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  childProcesses.push(child);
  child.stdout.on("data", (chunk) => process.stdout.write(`[vscode] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[vscode] ${chunk}`));
  const url = `http://${host}:${port}/`;
  await waitForHttp(url, timeoutMs, "VS Code web server");
  return url;
}

function spawnPortable(command, args, options) {
  if (process.platform !== "win32") return spawn(command, args, options);
  return spawn("cmd.exe", ["/d", "/s", "/c", [command, ...args].map(quoteCmdArg).join(" ")], options);
}

function waitForExit(child, timeoutMs, label) {
  return new Promise((resolveWait, rejectWait) => {
    const chunks = [];
    child.stdout?.on("data", (chunk) => chunks.push(String(chunk)));
    child.stderr?.on("data", (chunk) => chunks.push(String(chunk)));
    const timer = setTimeout(() => {
      child.kill();
      rejectWait(new Error(`${label} timed out: ${chunks.join("").slice(-1000)}`));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      rejectWait(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolveWait();
      else rejectWait(new Error(`${label} failed with ${code}: ${chunks.join("").slice(-1000)}`));
    });
  });
}

function openVsCodeDesktopFile(codeCli, target, timeoutMs, userDataDir, extensionsDir) {
  const command = `
$ErrorActionPreference = 'Stop'
$Target = '${quotePowerShell(target)}'
$UserData = '${quotePowerShell(userDataDir)}'
$Extensions = '${quotePowerShell(extensionsDir)}'
& ${quotePowerShellCommand(codeCli)} --user-data-dir $UserData --extensions-dir $Extensions --disable-extensions --reuse-window --goto $Target
`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
    encoding: "utf8",
    timeout: timeoutMs,
  });
  if (result.status !== 0) {
    throw new Error(`VS Code goto failed: ${[result.stdout, result.stderr].join("\n").slice(-1200)}`);
  }
}

function captureVsCodeWindowPng(outputPath, titleHint, timeoutMs, userDataDir) {
  const script = `
$ErrorActionPreference = 'Stop'
$Out = '${quotePowerShell(outputPath)}'
$Title = '${quotePowerShell(titleHint)}'
$UserData = '${quotePowerShell(userDataDir)}'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Win32 {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
}
'@
$deadline = (Get-Date).AddMilliseconds(${Math.min(timeoutMs, 15_000)})
$handle = [IntPtr]::Zero
while ((Get-Date) -lt $deadline) {
  $codeProcessIds = @(Get-CimInstance Win32_Process -Filter "Name = 'Code.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*$UserData*" } |
    ForEach-Object { [int]$_.ProcessId })
  $candidate = Get-Process Code -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like "*$Title*" -and ($codeProcessIds.Count -eq 0 -or $codeProcessIds -contains $_.Id) } |
    Select-Object -First 1
  if ($candidate) { $handle = [IntPtr]$candidate.MainWindowHandle; break }
  Start-Sleep -Milliseconds 250
}
if ($handle -eq [IntPtr]::Zero) { throw "no VS Code window found for expected file title: $Title" }
[Win32]::ShowWindow($handle, 9) | Out-Null
[Win32]::SetForegroundWindow($handle) | Out-Null
$HWND_TOPMOST = [IntPtr]::new(-1)
$HWND_NOTOPMOST = [IntPtr]::new(-2)
$SWP_NOSIZE = 0x0001
$SWP_NOMOVE = 0x0002
$SWP_SHOWWINDOW = 0x0040
$flags = $SWP_NOSIZE -bor $SWP_NOMOVE -bor $SWP_SHOWWINDOW
[Win32]::SetWindowPos($handle, $HWND_TOPMOST, 0, 0, 0, 0, $flags) | Out-Null
Start-Sleep -Milliseconds 550
$rect = New-Object Win32+RECT
if (-not [Win32]::GetWindowRect($handle, [ref]$rect)) { throw "could not read VS Code window rect" }
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
if ($width -lt 400 -or $height -lt 300) { throw ("VS Code window rect too small: " + $width + "x" + $height) }
$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
$bitmap.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
[Win32]::SetWindowPos($handle, $HWND_NOTOPMOST, 0, 0, 0, 0, $flags) | Out-Null
$graphics.Dispose()
$bitmap.Dispose()
`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    encoding: "utf8",
    timeout: timeoutMs,
  });
  if (result.status !== 0) {
    throw new Error(`VS Code window capture failed: ${[result.stdout, result.stderr].join("\n").slice(-1200)}`);
  }
}

function prepareVsCodeSourceRoot(root) {
  if (process.platform !== "win32" || !/\s/.test(root)) return root;
  const linkPath = resolve(tmpdir(), "nodetrace-vscode-noderoom-source");
  mkdirSync(dirname(linkPath), { recursive: true });
  if (!existsSync(linkPath)) symlinkSync(root, linkPath, "junction");
  return linkPath;
}

function quoteCmdArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@-]+$/.test(text)) return text;
  return `"${text.replaceAll('"', '\\"')}"`;
}

function quotePowerShell(value) {
  return String(value).replaceAll("'", "''");
}

function quotePowerShellCommand(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_.:/\\-]+$/.test(text)) return text;
  return `'${quotePowerShell(text)}'`;
}

async function waitForHttp(url, timeoutMs, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      await delay(500);
    }
  }
  throw new Error(`${label} did not become reachable at ${url}`);
}

async function findFreePort(start) {
  for (let port = start; port < start + 100; port += 1) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found from ${start} to ${start + 99}`);
}

function isPortFree(port) {
  return new Promise((resolvePort) => {
    const server = net.createServer();
    server.once("error", () => resolvePort(false));
    server.once("listening", () => {
      server.close(() => resolvePort(true));
    });
    server.listen(port, host);
  });
}

function killTree(child) {
  if (!child?.pid || child.killed) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

function buildStepSpecs(root) {
  const specs = [
    {
      id: "coach-step-01-artifact-entry",
      filePath: "src/ui/panels/Artifact.tsx",
      anchor: 'data-noderoom-surface="workSurface.traceStrip"',
      before: -8,
      after: 18,
      uiSelector: '[data-noderoom-surface="workSurface.traceStrip"]',
      uiState: "strip",
    },
    {
      id: "coach-step-02-detail-tabs",
      filePath: "src/ui/panels/TraceSurface.tsx",
      anchor: "type DetailTab =",
      before: 0,
      after: 32,
      uiSelector: '[data-testid="trace-surface"] .r-tracevu-tabs',
      uiState: "overview",
    },
    {
      id: "coach-step-03-trace-data",
      filePath: "src/ui/panels/traceData.ts",
      anchor: "export interface TraceRecord",
      before: -18,
      after: 24,
      uiSelector: '[data-testid="trace-record"]',
      uiState: "overview",
    },
    {
      id: "coach-step-04-step-row",
      filePath: "src/ui/panels/TraceStepRow.tsx",
      anchor: "a.box &&",
      before: -16,
      after: 12,
      uiSelector: '[data-testid="trace-step"] .r-tracevu-shotframe',
      uiState: "steps",
      waitForImage: true,
    },
    {
      id: "coach-step-05-flow",
      filePath: "src/ui/panels/TraceFlow.tsx",
      anchor: "const { nodes, edges }",
      before: -8,
      after: 34,
      uiSelector: '[data-testid="trace-flow"]',
      uiState: "flow",
    },
    {
      id: "coach-step-06-style",
      filePath: "src/app/styles.css",
      anchor: ".r-tracevu-tabs",
      before: -12,
      after: 44,
      uiSelector: ".r-tracevu",
      uiState: "overview",
    },
  ];
  return specs.map((spec) => {
    const sourcePath = resolve(root, spec.filePath);
    if (!existsSync(sourcePath)) throw new Error(`NodeRoom source file not found: ${sourcePath}`);
    const lines = readFileSync(sourcePath, "utf8").split(/\r?\n/);
    const anchorIndex = lines.findIndex((line) => line.includes(spec.anchor));
    if (anchorIndex < 0) throw new Error(`anchor not found in ${spec.filePath}: ${spec.anchor}`);
    const start = Math.max(0, anchorIndex + spec.before);
    const end = Math.min(lines.length - 1, anchorIndex + spec.after);
    return {
      ...spec,
      startLine: start + 1,
      endLine: end + 1,
      actualRect: null,
    };
  });
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
    if (!next || next.startsWith("--")) {
      parsed[rawKey] = "true";
    } else {
      parsed[rawKey] = next;
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

function capturePath(name) {
  return `captures/${name}`;
}
