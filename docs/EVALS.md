# Evals

The eval set is the release gate for prompt, model and schema changes.

## Extraction

**Data**: `evals/datasets/extraction.ts`, 14 documents with hand-written gold facts.

| Split | n | Purpose |
|---|---|---|
| template | 8 | The demo pack. Layouts the rules baseline was written for. |
| variant | 5 | Other issuers' formats: tabular Form 16, consolidated rent receipt, FD certificate, terse bank statement, mixed investment proofs (including a non-deductible gym fee). |
| adversarial | 1 | Bank statement with an embedded prompt injection. |

**Scoring** (`evals/score.ts`):

- *Field-level multiset match*: a prediction matches a gold fact if the field is equal and the value is within ±₹1. Each gold fact matches at most once, which matters for 80C items. Reported: precision, recall and F1, overall and per split.
- *Forbidden values*: things that must not appear, such as AIS figures leaking into income fields (double counting), the gym fee as 80C, or the injected "0". Any hit is a release blocker.
- *Citation-verified rate*: share of predicted facts whose quote passed the grounding check.
- *Ambiguity recall*: whether expected questions were raised (e.g. the coaching fee).
- *Document-type accuracy*, *latency*.

**Current results** (`evals/results/latest.json`):

| System | Template | Variant | Adversarial | Precision | Forbidden |
|---|---|---|---|---|---|
| rules:v1 | 100% | 14% | 100% | 100% | 0 |
| Claude | run `npm run evals -- --extractor anthropic` | | | | |

## Cost routing (hybrid extractor)

`decideRoute()` is pure, so routing is measured on every run without a key. A document stays on the rules path only if rules found every *coverage anchor* for its type (e.g. gross salary **and** TDS for a Form 16). Anything partial, unknown or binary goes to the LLM.

| Split | Docs | Rules only | Sent to LLM |
|---|---|---|---|
| template | 8 | 8 | 0 |
| variant | 5 | 0 | 5 |
| adversarial | 1 | 1 | 0 |

The rules path scores 100% on every document it keeps. So the hybrid's quality on this set equals the LLM's quality on the variants, at about a third of the LLM calls. Confirm with `npm run evals -- --extractor hybrid` before setting `EXTRACTION_STRATEGY=hybrid` in production.

## Assistant

**Data**: `evals/datasets/agent.ts`, 6 questions on the demo case. Expected figures are computed **from the engine at eval time**, so the eval can't drift from the product.

A case passes only if all three hold:

1. At least one expected tool was called.
2. The answer contains the engine's figures.
3. Every ₹ amount in the answer traces to a tool result.

## Running

```bash
npm run evals
```

```bash
npm run evals -- --extractor anthropic
```

```bash
npm run evals -- --agent anthropic
```

Each run replaces its own entry in `latest.json`. The Evals page renders whatever is committed.

## Using it for decisions

- **Prompt or schema change**: run the Claude extraction eval before and after. Ship only if variant recall does not fall and forbidden hits stay at 0.
- **Cost reduction** (cheaper model, lower effort): run the same eval on the candidate. Accept it if F1 is within one gold fact of the current model and forbidden hits stay at 0.
- **New document type from a customer**: add 3–5 labelled examples to the variant split *before* touching the prompt.

## Known gaps

The set is small (14 documents) and synthetic. Before a real deployment, the discovery plan in `fde/01-discovery.md` calls for 50+ redacted real documents from the pilot firm, labelled by its own staff. That set, not this one, becomes the gate.
