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
  traceId?: string;
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

export interface TraceWorkpaperRef {
  refId: string;
  kind: string;
  label?: string;
  uri?: string;
  hash?: string;
  redacted?: boolean;
}

export interface RuntimeTraceRow {
  id: string;
  traceId?: string;
  stepId?: string;
  surfaceId: string;
  artifactId?: string;
  elementId?: string;
  phase: string;
  actor: string;
  status: "ok" | "running" | "blocked" | "error" | "ready";
  summary: string;
  durationMs: number;
  createdAt?: string;
  inputRefs?: TraceWorkpaperRef[];
  outputRefs?: TraceWorkpaperRef[];
  evidenceRefs?: TraceWorkpaperRef[];
  mutationRefs?: TraceWorkpaperRef[];
  approvalRefs?: TraceWorkpaperRef[];
  evalRef?: TraceWorkpaperRef;
  receiptHashes?: {
    argsHash?: string;
    resultHash?: string;
    payloadHash?: string;
    contextPackHash?: string;
  };
}

export interface CodeOwnershipReceipt {
  id: string;
  surfaceId: string;
  ownerLabel: string;
  componentRef: string;
  backendRef: string;
  queryRef: string;
  mutationRef: string;
  skillRef: string;
  testRef: string;
}

export interface TraceCoachRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TraceCoachStep {
  id: string;
  order: number;
  stepLabel: string;
  group?: string;
  title: string;
  narrative: string;
  surfaceId: string;
  sourceView: {
    imagePath: string;
    repositoryRoot: string;
    activeFile: string;
    folderTree: string[];
    highlightStartLine: number;
    highlightEndLine: number;
  };
  codeBlock: {
    filePath: string;
    startLine: number;
    endLine: number;
    snippet: string;
  };
  uiCapture: {
    selector: string;
    rect: TraceCoachRect;
    screenshotPath: string;
    alt: string;
  };
  mapCapture: {
    imagePath: string;
    graphPath: string;
    model: string;
  };
  diagram: {
    kind: "mermaid" | "sequence" | "graph";
    nodeId: string;
    source: string;
  };
}

export interface TraceCoachGraphNode {
  id: string;
  label: string;
  kind: "schema" | "query" | "mutation" | "component" | "effect" | "runtime";
  filePath?: string;
  layer?: string;
  x?: number;
  y?: number;
  summary?: string;
}

export interface TraceCoachGraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface TraceCoachState {
  mode: "campaign" | "sandbox";
  activeStepId: string;
  sourceRepo: string;
  sourceMode: "live" | "snapshot";
  steps: TraceCoachStep[];
  graphNodes: TraceCoachGraphNode[];
  graphEdges: TraceCoachGraphEdge[];
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
  coach?: TraceCoachState;
}

export interface TraceLensState {
  open: boolean;
  hit: SurfaceHit | null;
  mode: LensMode;
  builderCapable: boolean;
}
