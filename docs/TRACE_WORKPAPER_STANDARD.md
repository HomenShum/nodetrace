# Trace Workpaper Standard

NodeTrace is the portable UI/database kit for trace workpapers. It is not tied
to NodeAgent, NodeRoom, Convex, or any model provider, but it should be able to
display NodeAgent-style trace receipts when an app has them.

## Standard

A trace row should help users answer:

```text
What did the user ask?
What did the agent see?
What did the agent do?
What changed?
Can I trust it?
```

NodeTrace keeps the public client state bounded and safe. Store raw private
payloads server-side; send the client opaque refs, summaries, statuses, hashes,
and proof cards.

## Optional Workpaper Fields

`RuntimeTraceRow` supports these optional fields:

- `traceId`
- `stepId`
- `inputRefs`
- `outputRefs`
- `evidenceRefs`
- `mutationRefs`
- `approvalRefs`
- `evalRef`
- `receiptHashes.argsHash`
- `receiptHashes.resultHash`
- `receiptHashes.payloadHash`
- `receiptHashes.contextPackHash`

The SQLite schema mirrors this with nullable columns on `trace_events` and
`trace_proofs`, so existing apps can keep inserting the old minimal rows.

## Mapping From NodeAgent

| NodeAgent workpaper | NodeTrace display |
|---|---|
| `traceId` | Session/run grouping and row drill-down key |
| `TraceStep.phase` | Runtime trace phase |
| `TraceStep.title` / `summary` | Row title and body |
| `TraceToolReceipt` hashes | Receipt hash chips |
| `EvidenceReceipt` | Business proof card |
| `MutationReceipt` | Mutation/diff row |
| `ApprovalReceipt` | Approval badge |
| Eval proof refs | Eval verdict/proof card |

## Coding-Agent Rule

When injecting NodeTrace into another app, do not invent private raw data for
the client. First add opaque refs and bounded rows. Then add a privileged
server route for Builder-only code ownership, raw payload inspection, or replay.
