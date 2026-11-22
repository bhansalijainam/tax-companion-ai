# Changelog

## Unreleased

### Security
- Dev toolchain majors: vite 5 → 8, vitest 3 → 5 (with `@vitest/coverage-v8` 5), `@vitejs/plugin-react-swc` 3 → 4. Clears the dev-only critical tinypool advisories (GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr) and the high vite advisory; `npm audit` now reports 0 high/critical including dev dependencies.

### Changed
- Vite 8 bundles with Rolldown: the vendor chunk split moved from object-form `manualChunks` (unsupported) to `build.rolldownOptions.output.codeSplitting.groups`, producing the same `react`, `ui` and `markdown` chunks.
- Config files use `import.meta.dirname` instead of `__dirname`.

## 0.2.0

### Design
- New "Ledger & Saffron" theme (Theme Factory, custom): ink-indigo, saffron, warm paper; Fraunces headings, Inter body, tabular numbers. Spec in `docs/design/THEME.md`.
- Light/dark toggle (follows the system by default).
- Automated contrast audit in a real browser: every visible text node on all 9 views passes WCAG AA in both themes.

### Added
- Hybrid extractor (regex first, LLM on demand) with per-document-type coverage anchors; opt-in via `EXTRACTION_STRATEGY=hybrid`. Routing is measured on every eval run: 9/14 documents need no LLM call.
- `npm run evals -- --extractor hybrid` and a cost-routing section on the Evals page.
- Demo/live path parity test, so both extractors produce identical fact shapes.
- Per-IP rate limit on paid endpoints (`RATE_LIMIT_PER_MIN`), Dependabot config, test coverage report.

### Security
- Provider error details are logged server-side only; clients get generic messages.
- Constant-time `ACCESS_TOKEN` comparison.
- zod 3 → 4 (GHSA-mrhx-c7xc-m3w5, memory exhaustion validating oversized arrays on untrusted input); `npm audit fix` for transitive advisories. Production dependencies: 0 high/critical.
- Dev server binds to localhost by default.

## 0.1.0

Rebuilt the UI prototype into a working applied-AI system.

### Added
- Deterministic FY 2024-25 tax engine (old vs new regime) with a line-by-line trace and 23 hand-verified tests.
- Field catalogue and case-file domain model: facts with provenance, review status and audit trail.
- Deterministic reconciliation rules: AIS vs documents (deposit interest, savings interest, TDS), landlord PAN above ₹1L rent, cash deposits, 80C over cap, conflicts between documents.
- Provider-agnostic `LLMProvider` interface with a Claude adapter (official SDK, structured outputs, strict tools, adaptive thinking, server-side refusal fallback) and a scripted adapter for demo mode.
- LLM document extraction with verbatim-quote citations, verified in code (grounding check, confidence cap).
- Rules-based extractor used both for demo mode and as the eval baseline.
- Tool-using assistant (6 read-only tools, bounded loop, what-if overrides) with a figure-grounding check on every answer and a visible tool trace.
- Server handlers shared by Vercel functions and Vite dev middleware; the API key stays server-side.
- Eval harness: labelled extraction set (template / variant / adversarial), agent eval, results page.
- Live-mode smoke test against a mock Messages API; CI workflow.
- Views: Overview, Documents, Review facts, Flags (with client-email draft), Tax computation, Assistant, Working paper, Evals, How it works.
- Docs: design doc, architecture review, eval method, FDE engagement pack.

### Removed
- Hard-coded mock data and incorrect tax figures; keyword-matched fake chat; simulated upload progress; Lovable template scaffolding.
