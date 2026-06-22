# Coding Agent Notes

NodeTrace is a portable trace UI and SQLite setup. It is not tied to NodeAgent,
NodeRoom, Convex, or any model provider.

Before shipping changes, run:

```bash
npm run happy-path
npm run smoke
npm run build
```

When changing the NodeRoom Trace Coach sample, also run the full local proof:

```bash
npm run understand:noderoom
npm run capture:plan:smoke
npm run capture:noderoom:real
npm run trace-coach:sqlite
```

`understand:noderoom` must produce
`docs/eval/nodetrace-understand-anything-noderoom.json` and refresh
`public/captures/noderoom-trace-knowledge-graph.json` from Understand-Anything
deterministic scripts, not a hand-modeled graph.
`capture:noderoom:real` must start the latest local NodeRoom app and wire
actual code-browser source screenshots from real NodeRoom files plus actual running NodeRoom screenshots into
`public/captures/noderoom-real-capture-manifest.json`. Do not replace those
assets with generated source recompositions, mocked UI images, or stale captures.
`capture:plan:smoke` must prove the reusable `nodetrace capture --plan` CLI can
validate the public capture plan before the NodeRoom preset runs.

Rules:

- Keep `src/trace` portable. Do not import app-specific stores or agent runtimes.
- Client state may include opaque surface ids, labels, proof cards, and bounded trace rows.
- Do not put file paths, query names, mutation names, secrets, or raw prompts in public client state.
- Builder mode must remain gated by a server-verified `builderCapable` flag.
- Support `data-nodetrace-surface` and the NodeRoom-compatible `data-noderoom-surface`.
- Keep the SQLite schema generic so any app can insert trace sessions, surfaces, proofs, and events.
- Keep NodeAgent-style workpaper fields optional and portable: `traceId`, `stepId`, refs, and receipt hashes are useful, but NodeTrace must not require a specific agent runtime.
- Keep `bin/nodetrace.mjs add` fully automatic: copy files, patch package scripts, install deps, run happy path, run smoke, run build when available, and write `.nodetrace/setup-receipt.json`.
- Keep Trace Coach instructions coding-agent friendly: explicit commands, expected output files, no hidden API keys, and a visual result a new project can compare against.
- Keep real capture proof mandatory by default. Only use generated source/UI stand-ins with an explicit `--allow-generated-captures` fallback for local debugging, never for public docs or release proof.
- Keep real codebase capture reusable through `nodetrace capture --plan`, `nodetrace-capture`, and `nodetrace-mcp`; do not bury source/app capture logic in a repo-specific script.
