# Design doc: Tax Companion

*Format follows gstack's `/office-hours` design doc: problem, premises, approaches, decision. Written before the rebuild; updated after.*

## Starting point

The repository was a polished UI prototype with nine screens of hard-coded data. It had a chat that matched keywords, an upload that faked progress bars, and tax figures typed in by hand. Those figures were wrong: the new-regime slab table summed to ₹1,74,000 against a taxable income it never derived. It looked like an AI product but contained no AI and no tax logic.

## Problem

CA firms in India prepare hundreds of salaried-individual returns between June and July. For each client, an article assistant collects 6–12 documents (Form 16, AIS/26AS, bank statements, investment and insurance proofs, home-loan certificates, broker P&L). They retype the numbers into a working sheet, reconcile against AIS, and pick the cheaper regime. A senior or partner then reviews.

The expensive parts are:

1. **Finding and transcribing numbers** across inconsistent document formats. This is mechanical, but it does not automate well with templates: every bank, employer and insurer has its own layout.
2. **Reconciling with AIS.** Mismatches here are the main cause of s.143(1)(a) adjustment notices, which cost the firm unbilled rework months later.
3. **Writing the client follow-up.** "Please send the FD certificate and your landlord's PAN" usually takes two or three rounds.

The judgement work (is this coaching fee deductible, is the old regime worth it) is a small share of the time. Firms bill for it, and partners will not hand it to a tool.

## Premises

1. **The LLM's job is reading, not deciding.** Value comes from turning heterogeneous documents into structured facts and from answering questions about the case. Tax arithmetic and thresholds belong in code that a partner can audit line by line.
2. **Every number needs a source a human can check in seconds.** In a regulated workflow, a tool that is right 97% of the time and gives no way to find the other 3% has negative value. Citations have to be verified by code, not merely requested from the model.
3. **The demo must run with one click and no key.** A portfolio reviewer will not configure an API key. Demo mode must exercise the real pipeline and say plainly what is scripted.
4. **Prove it with evals.** Claims like "the LLM handles new formats" need a labelled set and a baseline to compare against.

## Approaches considered

**A. Minimal.** Correct tested tax engine and shared state; keep the mocked AI. *Effort S.*
Fixes the correctness bug but leaves out the interesting part.

**B. AI vertical slice.** Tested engine, LLM extraction with verified citations, tool-using assistant with a figure check, eval harness, demo mode, case-study README. *Effort L.*

**C. B plus an FDE engagement pack.** Also includes the documents a forward-deployed engineer leaves with a customer: discovery notes, rollout plan with success metrics, runbook, and security/privacy review. *Effort XL.*

**Chosen: C**, with a provider-agnostic LLM interface. For an FDE role the deployment thinking is as much the deliverable as the code.

## Key decisions

| Decision | Alternative | Why |
|---|---|---|
| Fixed field catalogue as the extraction contract | Free-form extraction, then mapping | The schema is the interface between a probabilistic and a deterministic system. Fixed enums make outputs checkable and evals exact. |
| Verbatim quote, verified by substring match plus value check | Trust model citations / native citations API | Cheap, deterministic, and catches the dangerous failure (a plausible number with no source). The native citations feature can't be combined with structured outputs. |
| Facts are *proposed*, the CA accepts | Auto-apply above a confidence threshold | The CA carries professional liability. Bulk-accept for verified facts at ≥90% keeps it fast. |
| Reconciliation as code rules | Ask the model to "find issues" | Thresholds (₹1L rent → PAN, AIS tolerance) are statutory or firm policy. Rules re-run on every edit and clear themselves. The model still raises *semantic* ambiguities (the coaching fee). |
| Assistant gets tools, not the case dump | Put the whole case in the prompt | Keeps arithmetic in the engine (`compute_tax` with what-if overrides) and makes every answer traceable in the UI. |
| Post-hoc figure-grounding check on answers | Rely on the system prompt | Prompts are guidance, checks are guarantees. An untraced figure is shown to the user, not hidden. |
| Same handlers for Vercel and Vite dev | Separate Express server | One code path, no drift, key never in the browser. |
| Rules extractor kept as demo engine *and* baseline | Pre-recorded LLM outputs | Recorded outputs would look like live AI without being it. The baseline is honest and makes the eval meaningful. |

## Success criteria (product)

- Preparer time per standard salaried client: from about 60 min down to 20 min or less (measured in the pilot, see `fde/02-rollout-plan.md`).
- AIS-mismatch notices on pilot returns: 0.
- Partner overrides of extracted facts: under 5% of facts, trending down.
- Extraction recall on variant documents at least 90%, with citation-verified rate at least 98%. The release gate is the eval set, not anecdote.
