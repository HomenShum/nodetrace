import { useEffect, useMemo, useState } from "react";
import { Activity, Database, FileSearch, GitBranch, KeyRound, ShieldCheck } from "lucide-react";
import { DEFAULT_SURFACES, TraceLensPanel, TraceLensProvider, type NodeTraceState } from "./trace";

const seedState: NodeTraceState = {
  generatedAt: "loading",
  session: {
    id: "loading",
    title: "NodeTrace local happy path",
    status: "loading",
    summary: "Loading public/nodetrace-state.json",
  },
  builderCapable: false,
  surfaces: DEFAULT_SURFACES,
  proofs: [],
  traces: [],
  codeOwnership: [],
};

export function DemoDashboard() {
  const [state, setState] = useState<NodeTraceState>(seedState);
  const latestTrace = state.traces.at(-1);

  useEffect(() => {
    fetch("./nodetrace-state.json", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : seedState))
      .then((nextState: NodeTraceState) => setState(nextState))
      .catch(() => setState(seedState));
  }, []);

  const statusCards = useMemo(
    () => [
      { detail: state.session.id, Icon: ShieldCheck, label: "Session", value: state.session.status },
      { detail: ".nodetrace/nodetrace.sqlite", Icon: Database, label: "Database", value: "SQLite" },
      { detail: "no model provider required", Icon: KeyRound, label: "Keys", value: "none" },
      { detail: latestTrace?.phase ?? "seed", Icon: Activity, label: "Trace rows", value: String(state.traces.length) },
    ],
    [latestTrace?.phase, state.session.id, state.session.status, state.traces.length],
  );

  return (
    <TraceLensProvider builderCapable={state.builderCapable}>
      <main className="shell">
        <aside className="rail">
          <div className="brand">
            <div className="mark">NT</div>
            <div>
              <strong>NodeTrace</strong>
              <span>portable trace kit</span>
            </div>
          </div>
          <nav>
            <button type="button" className="active">
              <FileSearch size={17} aria-hidden="true" /> Trace Lens
            </button>
            <button type="button">
              <Database size={17} aria-hidden="true" /> SQLite
            </button>
            <button type="button">
              <GitBranch size={17} aria-hidden="true" /> Porting
            </button>
          </nav>
          <p>Cmd/Ctrl-click a tagged surface to inspect proof, runtime trace, and gated ownership.</p>
        </aside>

        <section className="workspace">
          <header className="hero" data-nodetrace-surface="shell.statusStrip">
            <div>
              <p className="eyebrow">No agent lock-in</p>
              <h1>Trace Lens for any app</h1>
              <p>{state.session.summary}</p>
            </div>
            <div className="command">
              <code>npm run happy-path && npm run dev</code>
            </div>
          </header>

          <section className="statusGrid" aria-label="Happy path status">
            {statusCards.map(({ detail, Icon, label, value }) => (
              <article key={label} className="stat">
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </section>

          <section className="surfaceGrid" aria-label="Inspectable surfaces">
            {state.surfaces.map((surface) => (
              <article
                key={surface.id}
                className="surface"
                data-nodetrace-surface={surface.id}
                data-artifact-id={surface.id === "workSurface.evidenceCarousel" ? "seed-artifact" : undefined}
              >
                <span>{surface.proofAvailable ? "proof" : "context"}</span>
                <h2>{surface.label}</h2>
                <p>{surface.about}</p>
              </article>
            ))}
          </section>

          <section className="tracePreview" data-nodetrace-surface="copilot.agentOperationStream">
            <div>
              <p className="eyebrow">Runtime trace</p>
              <h2>Recent rows</h2>
            </div>
            <ol>
              {state.traces.slice(-4).reverse().map((trace) => (
                <li key={trace.id} data-element-id={trace.id}>
                  <span>{trace.phase}</span>
                  <strong>{trace.summary}</strong>
                  <em>{trace.actor} · {trace.durationMs}ms</em>
                </li>
              ))}
            </ol>
          </section>
        </section>
      </main>

      <TraceLensPanel state={state} />
    </TraceLensProvider>
  );
}
