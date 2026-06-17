---
name: real-codebase-captures
description: Capture proof images from real IDE and running app sessions for codebase walkthroughs, trace UIs, onboarding demos, README media, and agent-verifiable UI evidence. Use when replacing generated screenshots, recompositions, mocked IDE views, synthetic UI callouts, or stale walkthrough assets with actual VS Code/Cursor/Codex-visible code captures and Playwright/browser captures from the live app.
---

# Real Codebase Captures

Use this skill when a walkthrough, trace panel, onboarding demo, or README needs proof screenshots tied to a real codebase and a live app.

## Rules

- Capture source code from a real editor session, such as VS Code desktop, VS Code web, Cursor, or another visible IDE. Open the exact file and line range before capturing.
- Capture product UI from the running app with browser automation. Prefer Playwright element screenshots from stable selectors.
- Measure DOMRects from the live DOM. Do not invent bounding boxes or reuse old coordinates.
- Store a manifest that links every step to its IDE image, running-app image, file path, line range, selector, DOMRect, capture kind, and generation time.
- Fail the task if the app is not running, the selector is missing, the editor did not open the expected file, or the screenshot is blank/cropped.
- Do not publish generated IDE recompositions, mocked UI images, synthetic app screenshots, or stale screenshots as proof captures.
- Generated diagrams, minimaps, and graphs are allowed only when backed by real graph data and labeled as generated diagrams, not screenshots.

## Capture Contract

Each walkthrough step should write data equivalent to:

```json
{
  "id": "step-id",
  "sourceView": {
    "captureKind": "actual-vscode-desktop",
    "filePath": "src/path/File.tsx",
    "startLine": 10,
    "endLine": 40,
    "imagePath": "captures/step-id-ide.png"
  },
  "uiCapture": {
    "captureKind": "actual-playwright",
    "selector": "[data-app-surface=\"surface.id\"]",
    "rect": { "x": 0, "y": 0, "width": 640, "height": 320 },
    "screenshotPath": "captures/step-id-ui.png"
  }
}
```

Use stable surface tags such as `data-nodetrace-surface`, `data-noderoom-surface`, `data-testid`, or app-owned selectors. If a selector is fragile, add a stable one in the source app before capturing.

## NodeTrace Proof

For the NodeTrace NodeRoom sample, run this sequence:

```bash
npm run understand:noderoom
npm run capture:noderoom:real
npm run trace-coach:sqlite
npm run smoke
npm run build
```

Expected outputs:

- `public/captures/noderoom-real-capture-manifest.json`
- `public/captures/*-ide.png`
- `public/captures/*-ui.png`
- `public/captures/*-minimap.svg`
- `docs/eval/nodetrace-trace-coach-sqlite.json`

`capture:noderoom:real` must start the latest local NodeRoom app, capture actual VS Code source slices, capture actual running NodeRoom UI elements, and write the manifest. `trace-coach:sqlite` should require that manifest by default. Only use `--allow-generated-captures` for private debugging, never for public docs or release proof.

## Verification

Before marking done:

- Inspect representative IDE and UI PNGs visually.
- Confirm screenshots contain no private chats, tokens, raw prompts, cookies, or unrelated personal workspace content.
- Confirm every manifest `captureKind` starts with `actual-`.
- Confirm every `sourceView.imagePath` and `uiCapture.screenshotPath` exists.
- Confirm each UI capture is from a currently runnable app and the DOMRect is nonzero.
- Run the repo smoke/build commands and commit the manifest with the PNG assets.
