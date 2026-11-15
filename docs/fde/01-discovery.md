# 01 · Discovery

*Hypothetical engagement, written the way a forward-deployed engineer would document a first week on site. The firm, people and numbers are illustrative. The method is the point.*

## Customer

A 12-person CA firm in Bengaluru: 2 partners, 3 qualified CAs, 7 article assistants. About 900 individual returns a year, roughly 70% of them salaried with modest other income. Peak load is 15 June to 31 July.

## How I'd run discovery (week 1)

| Day | Activity | Output |
|---|---|---|
| 1 | Shadow two articles preparing returns end to end; time each step | Process map with minutes per step |
| 2 | Collect 50 past client packs (redacted) across employers and banks | Raw material for a firm-specific eval set |
| 3 | Partner review session: what do they actually check, and what has caused notices? | Review checklist → reconciliation rules |
| 4 | IT and data walkthrough: where documents live, who can access what, current tools (Excel, a tax utility, WhatsApp/email) | Integration and security constraints |
| 5 | Playback: problem statement, proposed pilot, success metrics, and what we will *not* build | Signed-off pilot scope |

## Observed workflow (illustrative timings, per salaried client)

| Step | Minutes | Notes |
|---|---|---|
| Chase and collect documents | 15–30 (elapsed days) | 2–3 email/WhatsApp rounds typical |
| Transcribe into working sheet | 25–40 | Form 16 is fast; bank statements and receipts are slow |
| Reconcile with AIS/26AS | 10–20 | Skipped under time pressure, which then causes notices |
| Regime comparison | 5 | Excel template; errors when slabs change mid-year |
| Partner review | 10–15 | Mostly re-checking transcription |

**Where the time goes**: transcription and reconciliation account for about 60% of preparer time, and partners spend most of review re-checking transcription. That is the wedge: if partners trust the extracted numbers, both preparation and review get faster.

## What partners said would make them trust it (themes)

- "Show me where the number came from." This became verbatim quotes and verified citations.
- "I don't want it deciding whether something is deductible." This became model-raised *questions*, not auto-classification of edge cases.
- "Our notices come from AIS mismatches." This became deterministic AIS reconciliation rules.
- "Juniors will click accept on everything." This became bulk-accept limited to verified facts at ≥90%, with the working paper marked DRAFT until review is complete.

## Constraints discovered

- Client documents include PAN, Aadhaar fragments, bank account numbers: personal data under the **DPDP Act 2023**.
- Some clients send phone photos of receipts, so image input is needed (Claude vision handles this; the grounding check returns "unverifiable" and forces review).
- The firm uses an existing utility to file. **Export, don't replace**: the output is a working paper plus structured figures, not an ITR.
- Internet is reliable but not always fast. Extraction runs per document, in parallel, with visible status.

## Explicitly out of scope for the pilot

Filing, business/professional clients with books of account, capital-gains computation from raw contract notes, and anything that would make the tool the decision-maker.
