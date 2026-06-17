# NodeTrace

Portable Trace Lens UI and SQLite setup for agent-native apps.

NodeTrace gives any coding agent a ready-to-port trace layer: tagged UI
surfaces, a Review/Builder Trace Lens, business proof cards, bounded runtime
trace rows, gated code ownership, and a local SQLite happy path. It is not bound
to NodeAgent's agent architecture. Bring your own agent, tools, queue, database,
or model provider.

## Happy Path

```bash
npm install
npm run happy-path
npm run dev
npm run smoke
```

The default path uses no API keys and no cloud account. `npm run happy-path`
creates:

- `.nodetrace/nodetrace.sqlite`
- `public/nodetrace-state.json`
- `docs/eval/nodetrace-happy-path.json`

Open the Vite URL and Cmd/Ctrl-click any tagged surface to open Trace Lens.

## What You Get

- `src/trace/TraceLensProvider.tsx`: global Cmd/Ctrl-click resolver.
- `src/trace/TraceLensPanel.tsx`: Review/Builder panel with the three trace regions.
- `src/trace/types.ts`: portable state contract.
- `src/trace/surfaces.ts`: client-safe opaque surface registry helpers.
- `db/schema.sql`: SQLite schema for sessions, surfaces, proofs, events, and gated ownership.
- `scripts/init-sqlite.mjs`: local database/state initializer.
- `docs/PORTING.md`: copy/adapt checklist for coding agents.

## Trace Contract

NodeTrace follows the same safety shape as the NodeRoom Trace Lens:

- The client only sees opaque surface ids and user-facing labels.
- `Review` is the default mode.
- `Builder` is visible but only reveals code ownership when `builderCapable` is server verified.
- `Business proof` shows source/evidence cards and confidence.
- `Runtime trace` shows bounded frame/tool/run events.
- `Code ownership` stays locked until a privileged server route supplies it.

Use either attribute on clickable surfaces:

```tsx
<section data-nodetrace-surface="workSurface.traceStrip">
  ...
</section>

// NodeRoom compatibility:
<section data-noderoom-surface="workSurface.traceStrip">
  ...
</section>
```

## Port Into Another App

1. Copy `src/trace`, `db/schema.sql`, and `docs/PORTING.md`.
2. Tag your visible surfaces with `data-nodetrace-surface`.
3. Insert trace rows and proof cards from your app runtime.
4. Serve `NodeTraceState` to the client from your backend.
5. Keep code ownership behind a privileged server route.
6. Run the equivalent of `npm run happy-path` in the target repo.

NodeTrace provides the setup needed for the UI and database path. It does not
choose your agent loop, model, tool runtime, queue, auth, or cloud provider.
