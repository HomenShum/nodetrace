import type { SurfaceMeta } from "./types";

export const DEFAULT_SURFACES: SurfaceMeta[] = [
  {
    id: "workSurface.traceStrip",
    label: "Trace strip",
    proofAvailable: true,
    about: "Runtime progress, tool calls, receipts, and verifier status.",
  },
  {
    id: "workSurface.evidenceCarousel",
    label: "Evidence",
    proofAvailable: true,
    about: "Source-backed evidence cards linked to visible artifacts or cells.",
  },
  {
    id: "copilot.agentOperationStream",
    label: "Agent operations",
    proofAvailable: true,
    about: "Bounded stream of agent, worker, tool, and scheduler events.",
  },
  {
    id: "shell.statusStrip",
    label: "Status",
    proofAvailable: true,
    about: "System health, credential state, run status, and review outcome.",
  },
  {
    id: "shell.progressSpine",
    label: "Progress",
    proofAvailable: false,
    about: "End-to-end workflow stages from intake to review.",
  },
];

export function surfaceMeta(surfaces: SurfaceMeta[], id: string | null | undefined): SurfaceMeta | null {
  if (!id) return null;
  return surfaces.find((surface) => surface.id === id) ?? null;
}
