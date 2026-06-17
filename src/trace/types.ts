export type LensMode = "review" | "builder";

export interface SurfaceMeta {
  id: string;
  label: string;
  proofAvailable: boolean;
  about: string;
}

export interface SurfaceHit {
  surfaceId: string;
  artifactId?: string;
  elementId?: string;
  targetRef?: string;
}

export interface TraceProof {
  id: string;
  surfaceId: string;
  artifactId?: string;
  elementId?: string;
  title: string;
  status: "verified" | "needs_review" | "missing" | "ready";
  confidence: number;
  sourceLabel: string;
  sourceUrl?: string;
  detail: string;
}

export interface RuntimeTraceRow {
  id: string;
  surfaceId: string;
  artifactId?: string;
  elementId?: string;
  phase: string;
  actor: string;
  status: "ok" | "running" | "blocked" | "error" | "ready";
  summary: string;
  durationMs: number;
  createdAt: string;
}

export interface CodeOwnershipReceipt {
  id: string;
  surfaceId: string;
  ownerLabel: string;
  componentRef: string;
  backendRef: string;
  testRef: string;
}

export interface NodeTraceState {
  generatedAt: string;
  session: {
    id: string;
    title: string;
    status: string;
    summary: string;
  };
  builderCapable: boolean;
  surfaces: SurfaceMeta[];
  proofs: TraceProof[];
  traces: RuntimeTraceRow[];
  codeOwnership: CodeOwnershipReceipt[];
}

export interface TraceLensState {
  open: boolean;
  hit: SurfaceHit | null;
  mode: LensMode;
  builderCapable: boolean;
}
