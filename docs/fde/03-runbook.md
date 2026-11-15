# 03 · Operations runbook

## Deploy

1. Import the repo into Vercel. `vercel.json` sets the Vite build and SPA rewrites; `api/*.ts` become functions.
2. Environment variables (Production):
   - `ANTHROPIC_API_KEY`: required for live mode.
   - `ACCESS_TOKEN`: **set this for any public URL**. Live endpoints then require the `x-access-token` header.
   - `LLM_MODEL`: optional model override.
3. In the provider console, set a **monthly spend limit** for the key.
4. Smoke check after deploy:

   ```bash
   curl -s https://<host>/api/health
   ```

   Expect `"live": true` and the model name. Then open the app, upload a sample document, ask one question, and check that the "figures traced" badge is green.

Without a key the same deployment serves demo mode. This is the right setup for a public portfolio link.

## Health signals

| Signal | Where | Normal | Act when |
|---|---|---|---|
| `/api/health` | HTTP | 200, `live: true` | `live: false` → key missing or rotated |
| Function errors | Vercel logs (`console.error` in `server/handlers.ts`) | ~0 | Any 500: read the stack; handlers map known provider errors to 4xx/503 |
| 429 rate | Vercel logs / client errors | <1% of requests | Sustained → raise provider tier or stagger uploads |
| Extraction latency | `latencyMs` on each document | 5–25 s per document | >60 s → function timeout (maxDuration 60); split large PDFs |
| Untraced figures | Chat badge / agent eval | 0 | Any → capture the conversation and add it as an agent eval case |

## Common incidents

**"Live mode is not configured" (503).** The key isn't visible to the function. Check the env var is set for the right environment, then redeploy.

**401 "Access token required".** `ACCESS_TOKEN` is set but the browser isn't sending it. The client sends whatever is stored under `tax-companion:access-token` in localStorage. Set it via devtools for the pilot, or add a small settings field.

**Document stuck "extracting" / error "Request too large".** Body limit is 4 MB (Vercel ~4.5 MB). Ask for a smaller scan, or split the PDF. Long-term: upload to object storage and pass a reference.

**"The model declined to process this document".** The whole fallback chain refused. Inspect the document for unusual content. Process it manually and log it.

**A fact marked "not found" that looks right.** Usually an OCR or whitespace difference in the quote. Verify against the document and edit or accept. If it repeats for a document type, add that document to the eval set and adjust the normalisation in `checkGrounding`.

**Tax figure disputed by a partner.** Open Tax computation: every line has its section and inputs. If the engine is wrong, write a failing test in `compute.test.ts` first, then fix `engine/`. Never patch figures in the UI.

## Release checklist (each change)

- [ ] `npm run typecheck && npm run lint && npm test`
- [ ] `npm run smoke:live` (adapter wiring)
- [ ] For prompt, schema or model changes: `npm run evals -- --extractor anthropic` and `npm run evals -- --agent anthropic`, compared against the committed results; no forbidden hits
- [ ] Update `CHANGELOG.md`
- [ ] Deploy preview, run the smoke check, then promote

## Annual rule update (Budget)

1. New `engine/rules.ts` constants for the year (keep the previous year side by side once multi-year support lands).
2. A test per new slab boundary, rebate limit and cap, with hand-computed expectations.
3. Update field hints in `domain/fields.ts` if deduction eligibility changed, and re-run the extraction eval.
