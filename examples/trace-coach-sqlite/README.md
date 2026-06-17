# Trace Coach SQLite Example

This example seeds the NodeTrace sample app with a NodeRoom codebase trace. It
does not use fake e-commerce files, and it does not bind the walkthrough to
video timecodes. The first pass is an ordered, coding-agent-friendly onboarding
path through NodeRoom's trace tab implementation.

The script prefers a live NodeRoom checkout at `../` from this repo. Override it
when needed:

```bash
NODETRACE_SOURCE_ROOT=/path/to/noderoom npm run trace-coach:sqlite
```

If a live checkout is not present, the script falls back to packaged NodeRoom
source snapshots so the demo remains runnable from a standalone NodeTrace clone.

The seeded steps point at the NodeRoom trace surface:

- `src/ui/panels/Artifact.tsx`
- `src/ui/panels/TraceSurface.tsx`
- `src/ui/panels/traceData.ts`
- `src/ui/panels/TraceStepRow.tsx`
- `src/ui/panels/TraceFlow.tsx`
- `src/app/styles.css`

Run:

```bash
npm run trace-coach:sqlite
npm run dev
```

The script writes:

- `.nodetrace/trace-coach.sqlite`
- `public/nodetrace-state.json`
- `docs/eval/nodetrace-trace-coach-sqlite.json`

The demo dashboard then renders a NodeRoom-style Trace Coach surface with:

- a left trace-record list
- detail tabs for Overview, Steps, Flow, and Raw JSON
- ordered step labels, not video timestamps
- real NodeRoom code slices
- UI capture metadata with `data-noderoom-*` selectors, DOMRect, screenshot path, and bounding box
- Mermaid flow source for the active step

## Visual Proof

After running the command, the local demo should look like this NodeRoom-style
trace surface:

![NodeRoom-style Trace Coach tabs](../../docs/eval/nodetrace-trace-coach-sqlite.png)

## Why This Shape

The capture model is structural:

```text
NodeRoom source path + line range
NodeRoom UI selector + DOMRect
screenshotPath for a Playwright capture worker
Mermaid source for the active flow tab
```

That means a coding agent can adapt the example to another repo by changing
anchors and selectors, then using Playwright to populate real screenshot files.
The trace UI does not need raw IDE screenshots or video timestamps to display
the guided codebase trace.

## Coding-Agent Prompt

```text
Create a NodeTrace Trace Coach walkthrough for this repo. Base every step on
real files in the codebase, not invented examples. Follow the NodeRoom trace-tab
shape: record list, Overview, Steps, Flow, and Raw JSON. Use ordered step labels,
not video timestamps. For each step, provide codeBlock.filePath, startLine,
endLine, snippet, uiCapture.selector, uiCapture.rect, uiCapture.screenshotPath,
and diagram.source. Keep the first pass local and SQLite-backed. Run
npm run trace-coach:sqlite, npm run smoke, and npm run build.
```

## Adapting To Another Codebase

1. Pick the core linear onboarding path first: entry surface, data model, step
   renderer, flow/graph renderer, styling, and raw audit payload.
2. Add stable `data-*` selectors to target UI regions.
3. Use an AST/LSP/coding-agent reader to resolve source file ranges.
4. Use Playwright to compute `getBoundingClientRect()` and capture screenshots.
5. Store those values in SQLite and publish `NodeTraceState.coach`.
6. Keep free graph exploration behind the linear walkthrough so beginners are
   not dropped into a large graph first.
