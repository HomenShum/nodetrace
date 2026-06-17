# Coding Agent Notes

NodeTrace is a portable trace UI and SQLite setup. It is not tied to NodeAgent,
NodeRoom, Convex, or any model provider.

Before shipping changes, run:

```bash
npm run happy-path
npm run smoke
npm run build
```

Rules:

- Keep `src/trace` portable. Do not import app-specific stores or agent runtimes.
- Client state may include opaque surface ids, labels, proof cards, and bounded trace rows.
- Do not put file paths, query names, mutation names, secrets, or raw prompts in public client state.
- Builder mode must remain gated by a server-verified `builderCapable` flag.
- Support `data-nodetrace-surface` and the NodeRoom-compatible `data-noderoom-surface`.
- Keep the SQLite schema generic so any app can insert trace sessions, surfaces, proofs, and events.
