#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { captureCodebaseFromPlan, loadCapturePlan, normalizeCapturePlan } from "../src/capture/codebaseCapture.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")).version;

const server = new McpServer(
  { name: "nodetrace-capture", version },
  {
    instructions:
      "Use capture_codebase with a checked-in capture plan. It captures actual source screenshots from real files and actual running-app screenshots, then writes a manifest for trace UI adoption.",
  },
);

server.registerTool(
  "validate_capture_plan",
  {
    title: "Validate Capture Plan",
    description: "Validate a NodeTrace capture plan without opening VS Code or the target app.",
    inputSchema: {
      planPath: z.string().describe("Path to a NodeTrace capture plan JSON file."),
      cwd: z.string().optional().describe("Workspace directory used to resolve planPath."),
    },
  },
  async ({ planPath, cwd }) => {
    const absolutePlanPath = resolve(cwd ?? process.cwd(), planPath);
    const plan = loadCapturePlan(absolutePlanPath);
    const normalized = normalizeCapturePlan(plan, { cwd: cwd ?? process.cwd(), planPath: absolutePlanPath });
    const output = {
      ok: true,
      steps: normalized.steps.length,
      manifestPath: normalized.manifestPath,
      captureRoot: normalized.captureRoot,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  },
);

server.registerTool(
  "capture_codebase",
  {
    title: "Capture Codebase",
    description: "Run a NodeTrace capture plan to produce real source screenshots, real running-app screenshots, and a manifest.",
    inputSchema: {
      planPath: z.string().describe("Path to a NodeTrace capture plan JSON file."),
      cwd: z.string().optional().describe("Workspace directory used to resolve planPath."),
    },
  },
  async ({ planPath, cwd }) => {
    const absolutePlanPath = resolve(cwd ?? process.cwd(), planPath);
    const result = await captureCodebaseFromPlan(loadCapturePlan(absolutePlanPath), { cwd: cwd ?? process.cwd(), planPath: absolutePlanPath });
    const output = {
      ok: true,
      steps: result.steps.length,
      manifestPath: result.manifestPath,
      captureRoot: result.captureRoot,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  },
);

await server.connect(new StdioServerTransport());
