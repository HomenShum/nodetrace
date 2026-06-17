#!/usr/bin/env node

import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

let Database;
try {
  ({ default: Database } = await import("better-sqlite3"));
} catch {
  console.error("Missing dependency: run `npm install` before the Builder access server.");
  process.exit(1);
}

export function createBuilderAccessServer(options) {
  const dbPath = resolve(options.dbPath);
  const token = options.token;
  if (!token || token.length < 12) throw new Error("NODETRACE_BUILDER_TOKEN must be set to a non-trivial server-side token.");
  if (!existsSync(dbPath)) throw new Error(`Missing NodeTrace database at ${dbPath}. Run npm run happy-path first.`);
  const db = new Database(dbPath, { readonly: true });
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname !== "/api/nodetrace/code-ownership") {
      send(res, 404, { ok: false, error: "not_found" });
      return;
    }
    if (req.headers["x-nodetrace-builder-token"] !== token) {
      send(res, 401, { ok: false, error: "builder_token_required" });
      return;
    }
    const surfaceId = url.searchParams.get("surfaceId");
    if (!surfaceId) {
      send(res, 400, { ok: false, error: "surfaceId_required" });
      return;
    }
    const columns = ownershipSelectColumns(db);
    const row = db.prepare(`
      select ${columns}
      from trace_code_ownership
      where surface_id = ?
    `).get(surfaceId);
    if (!row) {
      send(res, 404, { ok: false, error: "ownership_not_found" });
      return;
    }
    send(res, 200, {
      ok: true,
      builderCapable: true,
      ownership: {
        surfaceId: row.surface_id,
        componentRef: row.component_ref,
        backendRef: row.backend_ref,
        queryRef: row.query_ref,
        mutationRef: row.mutation_ref,
        skillRef: row.skill_ref,
        testRef: row.test_ref,
        ownerLabel: row.owner_label,
        createdAt: row.created_at,
      },
    });
  });
  server.on("close", () => db.close());
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const dbPath = resolve(process.env.NODETRACE_DB_PATH ?? ".nodetrace/nodetrace.sqlite");
    const token = process.env.NODETRACE_BUILDER_TOKEN;
    const host = process.env.NODETRACE_BUILDER_HOST ?? "127.0.0.1";
    const port = Number(process.env.NODETRACE_BUILDER_PORT ?? 0);
    const server = createBuilderAccessServer({ dbPath, token });
    server.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      console.log(`nodetrace builder access server listening on http://${host}:${actualPort}`);
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function ownershipSelectColumns(db) {
  const existing = new Set(db.prepare("pragma table_info(trace_code_ownership)").all().map((row) => row.name));
  const optional = (name, fallback) => existing.has(name) ? name : `${fallback} as ${name}`;
  return [
    "surface_id",
    "component_ref",
    "backend_ref",
    optional("query_ref", "'server-only/query-ref'"),
    optional("mutation_ref", "'server-only/mutation-ref'"),
    optional("skill_ref", "'server-only/skill-ref'"),
    "test_ref",
    "owner_label",
    "created_at",
  ].join(", ");
}

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(`${JSON.stringify(body)}\n`);
}
