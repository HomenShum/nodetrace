# Porting NodeTrace

NodeTrace is designed for coding agents to install into an existing app without
adopting a specific agent runtime.

## Autopilot Install

```bash
npx github:HomenShum/nodetrace add --framework vite
npx github:HomenShum/nodetrace add --framework next
```

The unscoped `nodetrace` npm name is already occupied by an unrelated package.
After this repo is published under its scoped package, use:

```bash
npx @homenshum/nodetrace add
```

For a full no-skip Next App Router proof from this repo:

```bash
npm run installer:next:e2e
npm run agent:scale:smoke
npm run trace-coach:sqlite
```

It creates a throwaway Next target, runs the installer, initializes SQLite,
runs target smoke, and passes the target's real `next build`.
`agent:scale:smoke` creates a 125-step QA-agent trace fixture and proves the
public client state stays bounded and Builder-safe.
`trace-coach:sqlite` creates a NodeRoom codebase onboarding trace from the
NodeRoom trace-tab implementation. Use that pattern for another repo by
replacing the file anchors, stable UI selectors, DOMRects, generated IDE/source
captures, generated UI target captures, minimap graph JSON, and Mermaid source
with values captured from the target app. Keep the walkthrough ordered by step
label, not by video timecode.

The installer patches `package.json`, copies the trace UI, creates a Vite demo
entry at `nodetrace.html` or a Next App Router `/nodetrace` page, installs
dependencies, runs the no-key happy path, runs target smoke, runs build when
the target has a build script, and writes `.nodetrace/setup-receipt.json`.

## Copy

```text
src/trace/
db/schema.sql
scripts/init-sqlite.mjs, or your own adapter that writes the same state shape
```

## Add Surface Tags

Use `data-nodetrace-surface` on visible surfaces:

```tsx
<div data-nodetrace-surface="workSurface.evidenceCarousel" data-artifact-id={artifact.id}>
  ...
</div>
```

The click resolver also supports `data-noderoom-surface` so NodeRoom-style apps
can adopt it incrementally.

## Backend Contract

Write these records from your app runtime:

| Table | Purpose |
|---|---|
| `trace_sessions` | one run, job, workflow, render, or review session |
| `trace_surfaces` | opaque surface id registry |
| `trace_proofs` | source/evidence cards for business proof |
| `trace_events` | bounded runtime rows from agents, workers, tools, or schedulers |
| `trace_code_ownership` | builder-only ownership metadata |
| `trace_coach_steps` | codebase coach steps with step label, group, code range, UI selector, DOMRect, screenshot path, and diagram source |
| `trace_coach_graph_nodes` / `trace_coach_graph_edges` | flow graph metadata for the coach panel |

For visual codebase onboarding, publish `NodeTraceState.coach.steps[*].sourceView`
for the IDE/source slice and `mapCapture` for a codebase minimap. The bundled
Trace Coach example writes deterministic SVGs to `public/captures/`; teams that
run Understand Anything can replace the generated minimap payload with their
`.understand-anything/knowledge-graph.json` output.

Serve a `NodeTraceState` object to the client. Keep `codeOwnership` empty unless
the current viewer has server-verified builder access.

For 100+ step agents, keep the complete trace ledger in your database and serve
a bounded client window for the clicked surface. The bundled Trace Lens renders
the newest relevant rows first while the durable backend keeps the full audit
history.

## Security Rules

- Client-safe: opaque ids, labels, proof summaries, confidence, bounded trace rows.
- Server-only: file paths, query names, mutation names, test paths, tool secrets,
  raw prompts, cookies, tokens, private user data.
- `builderCapable` must be computed server-side.
- Never let a URL query param, local storage value, or client-only role toggle
  unlock code ownership.

## Builder Access Route

NodeTrace includes a runnable token-gated example route:

```bash
npm run happy-path
NODETRACE_BUILDER_TOKEN=replace-with-server-secret node examples/builder-access/server-route.mjs
```

Query it from trusted server-side code only:

```bash
curl -H "x-nodetrace-builder-token: $NODETRACE_BUILDER_TOKEN" \
  "http://127.0.0.1:PORT/api/nodetrace/code-ownership?surfaceId=workSurface.traceStrip"
```

The route returns code ownership only when the server-side token matches. The
client should receive only the gated response after your app's auth and policy
checks pass. The latest NodeRoom-compatible Builder shape includes
`componentRef`, `queryRef`, `mutationRef`, `skillRef`, and `testRef`;
`backendRef` remains available for non-Convex or mixed backends.

## Done Criteria

```bash
npm run happy-path
npm run smoke
npm run builder:smoke
npm run agent:scale:smoke
npm run trace-coach:sqlite
npm run installer:next:e2e
npm run build
```

Then add one target-app smoke that:

1. Inserts a session.
2. Inserts at least one surface.
3. Inserts at least one proof card.
4. Inserts at least one runtime trace row.
5. Opens the app and verifies Trace Lens can show Review mode without secrets.
