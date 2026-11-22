# 04 · Security and privacy review

*Threat-model style review (STRIDE-lite) of the demo architecture, and the changes needed for a production pilot.*

## Data handled

PAN, names, employer, salary, bank account fragments, rent and landlord details, insurance and family members' ages, investment holdings. This is **personal data** under India's Digital Personal Data Protection Act 2023. The CA firm is the data fiduciary; the tool vendor and the LLM provider are processors.

## Current design (demo)

| Property | Status |
|---|---|
| API key exposure | Server-side only (Vercel function / Vite middleware); never bundled. `.env*.local` is git-ignored. |
| Server persistence | None. Handlers are stateless; nothing is written server-side. |
| Client persistence | Browser localStorage (text and facts; binary uploads are not stored). Fine for a demo; **not acceptable** for real client data on shared machines. |
| Transport | HTTPS (Vercel). |
| AuthN/AuthZ | Optional shared `ACCESS_TOKEN` for live endpoints. Not per-user. |
| Input limits | 4 MB body, 400 KB text, 4,000-character chat message, 40-turn history; zod 4 validation on every request. |
| Rate limiting | Per-IP sliding window on `/api/extract` and `/api/chat` (`RATE_LIMIT_PER_MIN`, default 30). Per instance only: serverless instances don't share memory, so add the platform firewall or a shared store (e.g. Redis) for public deployments. |
| Error hygiene | Clients receive generic error messages; provider detail goes to server logs only. |
| Dependencies | Dependabot weekly; `npm audit` (including dev dependencies) reports 0 high/critical advisories after the vite 8 / vitest 5 upgrade. |
| Model tool access | Six read-only tools over the case in the request. No network, file system or write tools. What-if overrides are allow-listed to engine inputs (AIS data can't be overridden). |
| Output control | Structured outputs for extraction; zod re-validation; citation grounding; figure grounding on answers. |
| Test data | Fully synthetic. |

## Threats and mitigations

| Threat | Vector | Mitigation (now) | Production addition |
|---|---|---|---|
| Prompt injection via client document | Text in a statement instructs the model | Prompt treats documents as data; read-only tools; schema-bound output; grounding; adversarial eval case | Expand the adversarial split (hidden text, white-on-white PDF layers) |
| Hallucinated figures reaching a return | Model invents a value | Citation check, confidence cap, CA acceptance, figure check on chat | Partner sampling of accepted facts |
| Key abuse on a public demo | Anyone calls `/api/*` | `ACCESS_TOKEN` (constant-time); per-IP rate limit; provider spend limit | Per-user auth; shared-store rate limiting |
| Data leakage via logs | Request bodies logged | Handlers log only unexpected errors, not bodies | Structured logs with PII redaction; log retention policy |
| Cross-client data mixing | Shared browser | Single case per browser; Reset demo | Server-side tenant/case isolation, RBAC, SSO |
| Tampering with the audit trail | Client-side state | Audit is informational in the demo | Append-only server audit log, signed working papers |
| Provider retention | Documents sent to the LLM API | Minimum necessary: one document per call; chat strips binaries | Data-processing agreement with the provider; check retention and zero-data-retention eligibility for the chosen model; disclose in the firm's privacy notice |
| Repudiation of sign-off | "I didn't approve that" | Audit events attribute actions to CA vs AI vs system | Per-user identity on every event |

## DPDP checklist for the pilot firm

- [ ] Purpose limitation: data used only for preparing this client's return; stated in the engagement letter
- [ ] Consent / legitimate use recorded in the engagement letter, covering processors (vendor, LLM provider)
- [ ] Data minimisation: Aadhaar numbers masked before upload where possible; PAN masking in UI exports considered
- [ ] Retention: case data deleted N months after filing (firm policy), including provider-side if applicable
- [ ] Breach procedure: who notifies the Data Protection Board and the client, and within what time
- [ ] Processor agreements in place; data-transfer location documented

## Residual risk accepted for the demo

Browser-local storage and a shared access token. Both are acceptable **only** because all data is synthetic. They are the first two items in the production backlog (`02-rollout-plan.md`).
