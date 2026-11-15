# Changelog

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
