# Porting NodeTrace

NodeTrace is designed for coding agents to copy into an existing app without
adopting a specific agent runtime.

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

Serve a `NodeTraceState` object to the client. Keep `codeOwnership` empty unless
the current viewer has server-verified builder access.

## Security Rules

- Client-safe: opaque ids, labels, proof summaries, confidence, bounded trace rows.
- Server-only: file paths, query names, mutation names, test paths, tool secrets,
  raw prompts, cookies, tokens, private user data.
- `builderCapable` must be computed server-side.
- Never let a URL query param, local storage value, or client-only role toggle
  unlock code ownership.

## Done Criteria

```bash
npm run happy-path
npm run smoke
npm run build
```

Then add one target-app smoke that:

1. Inserts a session.
2. Inserts at least one surface.
3. Inserts at least one proof card.
4. Inserts at least one runtime trace row.
5. Opens the app and verifies Trace Lens can show Review mode without secrets.
