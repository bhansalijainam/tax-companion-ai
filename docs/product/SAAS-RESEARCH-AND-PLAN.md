# CA-firm SaaS: market research and feature plan

Status: M2 (0.4.0) and M3 (0.5.0) shipped; M4+ proposed · Researched 28 Nov 2026 · Method: ECC `market-research`, `competitive-platform-analysis`, `product-lens` (ICE)

Labels used below: **[Fact]** is sourced, **[Inference]** is my reading of the facts, **[Rec]** is a recommendation. Vendor pages are treated as claims, not proof.

---

## 1. The idea, restated

A CA (Chartered Accountant) running a small practice logs in and sees every client on one dashboard. For each client:

1. **Checklist.** Which required documents are in and which are missing.
2. **Prep.** The LLM reads what was submitted and gets the return ready to file.
3. **Chase.** One click sends a WhatsApp or email reminder. The client uploads through a link.
4. **Isolation.** Each client's data is stored separately and never mixed.
5. **Intelligence.** A team of agents reads official tax news and suggests per-client actions based on income, investments and tax slab.
6. **Pipeline.** Prospects are tracked with email and WhatsApp follow-ups until they become clients.

## 2. Executive summary

- **[Fact] The market is large and fragmented.** ICAI counts about 1,00,138 registered CA firms (Oct 2025). About 68,000 are proprietary firms and only 2,129 have six or more partners. About 1.6 lakh members hold a Certificate of Practice. For AY 2025-26, 8.80 crore ITRs were filed by 4 Feb 2026.
- **[Fact] WhatsApp document chasing is already crowded.** Turia (native WhatsApp Business API, launched Mar 2026), Suvit Chat, Vyapar TaxOne, ChaseDocs and ERPCA all sell it. Zoho Practice sells general practice management at ₹400 per extra user per month.
- **[Fact] The tax law itself changed.** The Income-tax Act, 2025 came into force on 1 Apr 2026. Tax Year 2026-27 is the first year under it, so the July 2027 filing season is the first one under the new Act. Section numbers and structure change (47 chapters become 23); rates are said to be unchanged.
- **[Fact] Two compliance clocks apply.** Most DPDP Rules obligations (consent, security, breach notice) bind around May 2027, with penalties up to ₹250 crore. WhatsApp has banned general-purpose AI chatbots since 15 Jan 2026; business notifications and support bots remain allowed.
- **[Inference] Chasing and CRM are not the reason a firm switches.** Competitors already do them. The opening is the part nobody does well: **grounded AI prep plus "what this law change means for each of my clients"**, at the exact moment every CA has to relearn section numbers. Our repo already has the hard parts: grounded extraction, a deterministic engine, evals, and firm isolation.
- **[Rec] Build the AI wedge first and treat WhatsApp and CRM as thin integrations.** Order: checklist → upload portal → reminders → tax-intelligence agents → prep-ready export → leads.

## 3. Key findings

### 3.1 Competitors (pruned set)

| Tier | Player | What it does | What it lacks for this idea |
|---|---|---|---|
| Direct | **Turia** | Practice management with native WhatsApp API, GST/TDS reminders, shared inbox | No evidence of AI return prep or per-client tax intelligence |
| Direct | **Suvit / Suvit Chat** | WhatsApp document collection, Excel→Tally mapping, claims 80% time saved (self-reported) | Bookkeeping-first; not ITR prep reasoning |
| Direct | **ChaseDocs** | Branded WhatsApp upload link; AI validates and files to Drive | Collection only; no Capterra ratings yet |
| Direct | **Vyapar TaxOne PMS**, **ERPCA** | PMS with WhatsApp (ERPCA as a paid add-on since 2023) | Workflow tools; no AI analysis claims found |
| Adjacent | **Zoho Practice** | General practice management; extra users ₹400/user/month (annual) | No WhatsApp document collection found; not India-tax aware |
| Adjacent | **Clear (ClearTax) for tax experts** | Filing software; TaxCloud basic plan covers 10 clients, ITR-1 to ITR-6; claims AI recon | Filing engine, not client chasing or advisory |
| Adjacent | Desktop filing tools (Winman, Saral, Genius, Computax) | Return computation and e-filing | Not researched in depth this round; they are where the final return gets filed, so **export to them, don't replace them** |
| Aspirational | **TaxDome** (US) | Client portal, intake-to-payment; pricing reports conflict ($58/mo tier vs "under $1/client/mo from 150 clients") | Not India-specific |

**[Inference]** Every direct competitor sells *workflow*. None of them, from public evidence, sells *judgement*: why this number, from which line of which document, and what it means for this client after this circular.

### 3.2 WhatsApp
- **[Fact]** Billing is per delivered message, by category and country. India utility messages cost about ₹0.115 (Meta's card as reported) to ₹0.145 (one BSP's figure, may include markup). Total cost is Meta's charge plus BSP fee plus 18% GST.
- **[Fact]** General-purpose AI assistants are banned on the Business API. Support, notification and sales bots are allowed, and Meta decides what counts as "general-purpose".
- **[Inference]** Cost is negligible: 10 clients × 6 reminders ≈ ₹10 a season. The real constraints are **opt-in capture, template approval, and staying a task-specific bot**: "upload your Form 16" is fine, "ask me any tax question" is risky.

### 3.3 Data protection and professional duty
- **[Fact]** DPDP Rules were notified around 13–14 Nov 2025. The core fiduciary duties (notice, consent, security safeguards, breach reporting, processor contracts) bind about 18 months later, around May 2027.
- **[Fact]** No binding ICAI rulebook on AI tools was found. The Code of Ethics' confidentiality principle applies, and commentary says vendors need data-processing agreements and clients should be told about AI use. *These are secondary sources; verify against the Code itself.*
- **[Inference]** "Never mix client data" is both a legal requirement and a selling point. Storing it in each client's own Google Drive is *less* safe and harder to audit than firm-owned storage scoped per client. Make GDrive an export target, not the system of record.

## 4. Implications for the design

These are the decisions that come out of the research:

1. **Two separate knowledge stores, never merged.**
   - *Public corpus*: official sources only (CBDT press releases, circulars, notifications, the Act). It is shared across all firms, chunked, embedded and cited.
   - *Client profile*: structured facts already in the case file (income heads, deductions, slab, regime). It stays in Postgres and is scoped by firm and client.
   - A recommendation is a **query-time join** ("which of my clients does circular X affect?"). Client PII is never embedded into a shared vector index. This is how "data is never mixed" can be proved, not just promised.
2. **Recommendations are drafts.** Agents propose and the CA approves; nothing advisory goes to a client automatically. Each draft cites the circular paragraph and the client fact it depends on, reusing the grounding checks we already run on extraction and chat.
3. **Upload by link, chase by WhatsApp.** The WhatsApp message carries a magic link to a per-client upload page. Documents don't need to travel through WhatsApp media, which avoids 24-hour-window rules and keeps files in our storage.
4. **Multi-year rules engine.** We need FY 2025-26 (1961 Act, filing now through revised returns) and Tax Year 2026-27 (2025 Act, filing July 2027). Rules become versioned data with a section map from old to new numbering. That map is itself a feature CAs will want.
5. **Export, don't e-file (yet).** Direct e-filing needs ERI registration with the department. For now, produce a prep pack (computation, ITR form choice, schedule values, evidence trail) that a CA keys into, or imports into, their filing tool.

## 5. Feature plan

ICE = Impact × Confidence × Ease, each scored 1–10. Lower effort means a higher Ease score.

| # | Milestone | What ships | Reuses | I | C | E | ICE |
|---|---|---|---|---|---|---|---|
| ✅ M1 | Practice workspace | Firms, roles, clients, cases, audit, isolation | — | | | | done |
| ✅ **M2** | **Client roster + document checklist** | Client profile (salaried / capital gains / rental / business / NRI). Required-document rules per profile. Dashboard matrix of clients × documents (received, missing, extracted, issues). "Ready %" per client | `DocKind`, `caseSummary`, flags | 9 | 9 | 8 | **648** |
| ✅ **M3** | **Client upload portal** | Per-client expiring magic link (no client login). Private Blob storage keyed `firm/client/…`. Auto-extraction on arrival. Status flips on the dashboard | Hybrid extractor, deferred Task 7 | 9 | 8 | 7 | **504** |
| **M4** | **Reminders (email → WhatsApp)** | One-click and scheduled nudges listing exactly what's missing. Opt-in capture. Message log in the audit trail. Email via a transactional provider first, then WhatsApp utility templates via Cloud API or a BSP | Flags' `question` field, audit | 8 | 7 | 6 | **336** |
| **M5** | **Tax-intelligence agents** | Ingest official sources on a schedule → classify relevance → embed (pgvector in the same Postgres) → impact agent matches against client profiles → cited draft recommendations in a CA inbox → approve, then share. A daily digest. Evals for citation accuracy and "no claim without a source" | Agent loop, grounding, evals harness | 9 | 6 | 5 | **270** |
| **M6** | **Prep-ready pack + new-Act rules** | FY 2025-26 and TY 2026-27 rule sets, old→new section map, ITR form selection, exportable computation and schedules (PDF + JSON) | Engine, trace lines | 8 | 7 | 5 | **280** |
| **M7** | **Leads pipeline** | Lead capture (form link) → stages → follow-up templates over email and WhatsApp → convert a lead to a client in one click | M4 messaging | 6 | 8 | 7 | **336** |
| M8 | Correction → eval flywheel | CA edits become regression cases | Eval harness | 7 | 8 | 7 | 392 *(portfolio value, invisible to buyers)* |

**[Rec] Build order: M2 → M3 → M4 → M5 → M6 → M7, with M8 in parallel.**
- M4 scores the same as M7, but M7 depends on M4's messaging.
- M5 comes before M6 despite a slightly lower ICE because it is the differentiator and the strongest portfolio story ("multi-agent RAG with evals and human approval"). M6 then becomes urgent before July 2027.

### Milestone detail for the first three (the next ~3 PRs)

**M2: roster and checklist.**
- `client_profiles` stores income sources and flags (has rental, has capital gains, NRI, senior parents).
- `requirements(profile) → DocKind[]` is a pure, tested function, e.g. capital gains ⇒ broker P&L plus AIS.
- The dashboard shows a client × document grid, filters (missing docs / issues / ready), and a per-client "what's missing" list that M4 reuses verbatim.

**M3: upload portal.**
- `upload_links` holds a token hash, client, expiry, and is single-firm.
- `/u/:token` is a public page. Uploads go straight to private Blob, and the server checks the token, client scope, size and MIME type.
- Each upload creates a `CaseDocument` and runs the hybrid extractor. The audit log records `client.uploaded`.
- Tests include "a token for client A can't write to client B" (the same pattern as the firm-isolation test).

**M4: reminders.**
- `MessageChannel` interface (`email`, `whatsapp`), the same adapter pattern as `LLMProvider`.
- Tables: `outbound_messages` (status, provider id, cost) and `contact_consents`.
- Scheduled nudges run every N days until the checklist is complete, with a quiet-hours rule.
- WhatsApp stays strictly task-specific (missing-document templates), in line with Meta's policy.

## 6. Market sizing (estimates, assumptions explicit)

- **Top-down:** ~1,00,000 CA firms × an assumed ₹12k–24k per year for a tax-season tool ≈ ₹120–240 crore a year if *every* firm bought. Not a forecast, just the ceiling.
- **Bottom-up:** assume we target proprietary and small partnership firms (~95k). Then:
  - At 1% adoption in 3 years, ~950 firms × ₹18k per year ≈ **₹1.7 crore ARR**.
  - At 3%, ≈ ₹5 crore.

  *Assumptions: price ₹1,500 per firm per month; adoption rates are guesses and unvalidated.*
- **[Inference]** This is a fine micro-SaaS or portfolio wedge, not a venture-scale market on its own. Venture scale would need GST/TDS workflows or a B2C channel.

## 7. Risks and counterarguments

| Risk | Why it matters | Mitigation |
|---|---|---|
| Crowded workflow market | Turia, Suvit and others already own "WhatsApp chasing" | Lead with AI prep and law-change impact; keep chasing thin |
| Wrong AI advice | Professional liability for the CA | Drafts only, citations required, CA approval, eval gate on citation accuracy |
| WhatsApp policy | Meta decides what "general-purpose" means; templates can be rejected | Task-specific templates; email fallback; never a free-form tax Q&A bot on WhatsApp |
| DPDP (May 2027) | Consent, breach notice, processor contracts | Consent capture in M4; DPA template; data-retention and delete-on-request built in |
| Seasonality | Usage spikes June to September | Year-round value from M5 digests, advance-tax reminders, leads |
| Price sensitivity of small CAs | Zoho is ₹400/user; desktop tools are entrenched | Per-firm pricing; export into their filing tool instead of replacing it |
| **Contrarian view** | Small CAs may be happy with WhatsApp plus Excel; the pain may not be worth paying for | Validate with the CAs you know *before* M5 (questions below) |

## 8. Validation before building M5 (you said you know CAs)

Ask 3–5 practising CAs:

1. Last season, how many hours went to chasing documents versus preparing returns?
2. What do you use today for chasing? Would you switch for that alone?
3. When a circular drops, how do you work out which clients it affects? How long does it take?
4. Would you trust AI-drafted client recommendations if each one cited the circular and the client's figures and you approved it?
5. What would you pay per month for checklist + portal + reminders? And with the intelligence agents?

If answers to 3 and 4 are lukewarm, demote M5 and push M6 (new-Act prep) up.

## 9. Sources

- ICAI firm and member counts: [The Finance Story](https://thefinancestory.com/mid-sized-indian-ca-firms-employing-20-percent-audit-workforce), [Careers360 ICAI report 2025](https://finance.careers360.com/articles/icai-student-and-member-report-2025), [Juris Hour](https://www.jurishour.in/columns/india-has-around-4-23-lakh-active-ca/)
- ITR counts: [Free Press Journal (8.80 cr, AY 2025-26)](https://www.freepressjournal.in/business/880-crore-itrs-filed-but-2464-lakh-still-pending-refund-wait-raises-big-questions)
- Income-tax Act 2025: [CBDT press release](https://www.incometaxindia.gov.in/documents/d/guest/press-release-income-tax-act-2025-comes-into-force-from-01-april-2026-pdf), [CBDT salient features](https://www.incometaxindia.gov.in/documents/d/guest/english-salient-features-of-new-income-tax-act-pdf), [Business Today](https://www.businesstoday.in/personal-finance/tax/story/income-tax-act-2025-comes-into-force-from-april-1-marks-major-tax-reform-cbdt-523616-2026-04-01)
- Competitors: [Turia launch](https://indiacsr.in/turia-launches-whatsapp-automation-software-for-ca/), [Suvit Chat](https://suvit.io/suvit-chat), [ChaseDocs on Capterra](https://www.capterra.in/software/1114098/ChaseDocs), [ERPCA WhatsApp](https://business-standard.com/content/press-releases-ani/erpca-practice-management-software-adds-whatsapp-integration-for-improved-client-communication-123071900674_1.html), [Vyapar TaxOne](https://taxone.vyapar.com/post/ca-firm-workflows-with-Vyapar), [Zoho Practice pricing](https://www.zoho.com/practice/pricing), [TaxDome on Capterra](https://www.capterra.in/software/186749/taxdome), [Clear for tax experts](https://cleartax.in/tax-experts), [ICAI AI use cases](https://ai.icai.org/usecases_details.php?id=265)
- WhatsApp pricing and policy: [Meta pricing docs](https://developers.facebook.com/docs/whatsapp/pricing), [Free Press Journal on India rates](https://www.freepressjournal.in/tech/how-much-does-india-have-to-pay-for-whatsapp-messages-from-october-1), [AiSensy Oct 2026 update](https://m.aisensy.com/blog/whatsapp-pricing-update-october-2026/), [MyOperator](https://myoperator.com/blog/whatsapp-business-api-pricing-india-2026), [TechCrunch on chatbot ban](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform), [respond.io policy explainer](https://respond.io/blog/whatsapp-ai-chatbot-policy)
- DPDP: [PIB](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf), [Taxmann timeline](https://www.taxmann.com/post/blog/analysis-indias-dpdp-act-and-rules/), [Bar & Bench](https://www.barandbench.com/law-firms/view-point/digital-personal-data-protection-rules-2025-a-practical-roadmap-for-data-fiduciaries-preparing-for-a-new-compliance-era)
- AI and confidentiality: [ICAI Journal on cybersecurity](https://cajournal.icai.org/article-details/securing-the-trust-quotient-a-cybersecurity-and-data-protection-framework-for-modern-ca-practices), [ICAEW (UK comparator)](https://www.icaew.com/regulation/regulatory-news/regulatory-news-2026-11/ai-and-client-data-complying-with-the-principle-of-confidentiality)

**Stale or weak data flagged:**
- WhatsApp India utility rate: sources disagree (₹0.115 vs ₹0.145).
- TaxDome pricing: sources conflict.
- Winman, Saral, Genius: not researched.
- ICAI AI guidance: from secondary sources only.
- DPDP phase dates: confirm against the Gazette.
