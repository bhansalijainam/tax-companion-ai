# Architecture and engineering review

*Structured after gstack's `/plan-eng-review`: scope, data flow, failure modes, test coverage, trade-offs.*

## Scope

In: FY 2024-25 individual resident below 60. Heads: salary, one or more house properties, other sources, listed-equity capital gains, simple business profit. Chapter VI-A: 80C, 80CCD(1B), 80D, 80TTA, 80E, 80G. Regime comparison, AIS reconciliation, client follow-ups, working paper.

Out: filing, multi-year loss carry-forward, senior/super-senior slabs, foreign assets, F&O/intraday, multi-user auth and persistence. The last is browser-local in this demo; production needs a backend store, covered in `fde/04-security-privacy.md`.

## Data flow

```
Browser (React)                                     Server (Vercel fn / Vite middleware)
───────────────                                     ────────────────────────────────────
CaseProvider (useReducer, localStorage)
  │ upload ──► extractDocument(doc, mode)
  │              live ─────────── POST /api/extract ─► LLMExtractor(AnthropicProvider)
  │              demo ─► RulesExtractor                      │ structured output (JSON schema)
  │                                                          ▼
  │ ◄───────────── ExtractorRun {output, extractor, latency, usage}
  │ applyExtraction → finalizeExtraction (grounding check, confidence cap) → Facts + model Flags
  │
  │ derived on every render: buildInputs(facts) → compareRegimes() ; ruleFlags() + qualityFlags()
  │
  │ chat ──► askAssistant(case, history, msg, mode)
  │            live ──────────── POST /api/chat ─► runAgent(AnthropicProvider, case, ...)
  │            demo ─► runAgent(ScriptedProvider, ...)       │ ≤6 steps, tools read the case
  │ ◄──────────── AgentResult {answer, steps[], grounding, usage}
```

All state lives in the browser, and the server is stateless. The server receives only what one request needs: one document, or the case file without binary payloads.

## Module boundaries

- `engine` depends on nothing. `domain` depends on `engine`. `ai` depends on `domain` and `engine`. UI depends on all of them.
- Shared modules use relative imports so the serverless bundler can resolve them without path aliases.
- `tsconfig.core.json` type-checks engine, domain, ai, server and evals under `strict`. The UI keeps the template's looser config.

## Failure modes

| Failure | Detection | Handling |
|---|---|---|
| Model invents a number with a plausible quote | Quote not in document, or value not in quote | `grounded=false`, confidence capped at 0.5, high-priority flag, excluded from bulk-accept |
| Model misclassifies a fact (e.g. AIS interest as income) | Prompt rule plus `recon.*` fields; eval `forbidden` checks | Reconciliation conflicts surface it; eval tracks regressions |
| Same value from two documents (rent in Form 16 and bank) | `single` aggregation for fields that can't be summed | Equal values merge; differing values raise a conflict flag |
| Prompt injection inside a document | Adversarial eval case | Prompt treats documents as data; tools are read-only; output is schema-bound; injected value is a `forbidden` check |
| Assistant states a figure not from tools | `checkAnswerGrounding` | UI shows "untraced: ₹X"; eval counts it as a failure |
| Assistant loops on tools | Step counter | Stops at 6 steps with an explicit message |
| Tool throws (bad override field) | try/catch per tool | Error returned as `tool_result` with `is_error`, so the model can recover |
| Provider 429/5xx/network | Typed SDK errors → `LLMError(kind, retryable)` | Mapped to 429/503 with `retryable`; the SDK retries twice first |
| Safety classifier declines | `stop_reason: refusal` | Server-side fallback (`fallbacks: "default"`); if the whole chain refuses, surfaced as an error |
| Truncated output | `stop_reason: max_tokens` | Treated as retryable error; never parsed partially |
| Oversized upload | Body-size check (4 MB) | 400 before any model call |
| Public deployment abuse | Optional `ACCESS_TOKEN` header (constant-time compare); per-IP rate limit | 401 / 429; plus provider-side spend limits (runbook) |
| Provider error detail leaking to clients | `LLMError.detail` | Logged server-side; client gets a generic message |
| Rules silently missing a field (hybrid mode) | Coverage anchors per document type | Any missing anchor routes the document to the LLM |
| No API in static hosting | `/api/health` fails or returns non-JSON | Falls back to demo mode automatically |

## Model usage

- **Extraction**: one call per document, `output_config.format` JSON schema, adaptive thinking at `medium` effort. The system prompt is static, so it is cached across documents.
- **Assistant**: manual tool loop, kept provider-agnostic on purpose rather than using the SDK tool runner. Strict tool schemas. `tool_choice` stays `auto` because forced tool choice is rejected on current models. Native assistant content (including thinking blocks) is echoed back unchanged within a turn.
- **Refusals**: `server-side-fallback-2026-07-01` with `fallbacks: "default"`.
- **Cost routing**: `EXTRACTION_STRATEGY=hybrid` runs rules first and calls the model only when coverage anchors are missing. That is 5 of 14 documents on the eval set.
- **Model**: `claude-opus-5-5` by default, `LLM_MODEL` to override. Moving extraction to a cheaper model is a cost lever. It should be decided by the eval (see `EVALS.md`), not assumed.

## Test coverage

| Area | Tests | What a regression would look like |
|---|---|---|
| Slab maths, rebate, marginal relief, surcharge relief | `engine/compute.test.ts` (23) | Wrong tax near ₹7L / ₹50L boundaries |
| HRA, HP loss caps, 80TTA, 80C cap, special-rate gains, shortfall | same | Over-claimed exemptions |
| Rules extraction, kind detection, amount parsing | `extraction.test.ts` | Baseline drift |
| Grounding: verbatim, whitespace, paraphrase, wrong value, binary | same | Hallucinations passing as verified |
| JSON schema is structured-output compatible | same | 400s from the API after a schema edit |
| Sample-case flags appear and clear | `agent.test.ts` | Reconciliation silently broken |
| What-if overrides, override allow-list | same | Agent able to tamper with AIS data |
| Scripted agent: 7 intents, all figures grounded | same | Tool contract changes breaking the demo |
| Loop: step limit, tool error recovery | same | Runaway loops / crashes |
| Live wiring: request shape, thinking echo, strict tools, error mapping | `npm run smoke:live` | Adapter broken by SDK upgrade |

## Trade-offs worth discussing in review

- **Browser-local state.** This keeps the demo deployable with no database. Production needs server persistence with tenant isolation; that is the first item in the rollout plan.
- **The case file is sent with each chat turn.** Simple and stateless, and fine at this size (~30 KB). At firm scale, store it server-side and send an ID.
- **Substring grounding** is strict about OCR noise. For scanned PDFs the check returns `null` (unverifiable) rather than `false`. A production version would run OCR and use fuzzy matching with a threshold tuned on the eval set.
- **The scripted provider passes its own eval by construction.** Its row validates the harness and tools, not language quality. This is stated on the Evals page.
