---
name: kaj-contract-extraction
description: Turn an AMC contract (text, photo or PDF) into structured JSON, a visit schedule and a renewal reminder date. Use when building or changing contract upload, parsing or scheduling.
---

# Contract extraction

Follow `kaj-guardrails` at all times.

## Output schema
```json
{
  "provider_name": null,
  "contract_no": null,
  "client_name": null,
  "site_address": null,
  "equipment": [{"type": null, "capacity": null, "quantity": null}],
  "start_date": null,
  "end_date": null,
  "visit_frequency": null,
  "visit_schedule": [],
  "contract_value": null,
  "gst_extra": null,
  "payment_terms": null,
  "renewal_reminder_date": null,
  "extras_chargeable": null,
  "needs_review": []
}
```

## Rules
- `contract_no` is the reference code on the document (e.g. `SAS/2026/112`), never an ordinary word.
- Convert dates written in words ("1 June 2026") to YYYY-MM-DD.
- If only one date appears next to "contract period" or "start", use it as `start_date` and add to `needs_review`: "Only one date given; assumed as start date, please confirm."
- `visit_schedule` and `renewal_reminder_date` are computed by code, not the model:
  - Visits fall on the 1st of each relevant month from `start_date` (monthly = 12, quarterly = 4, half-yearly = 2).
  - `renewal_reminder_date` = `end_date` minus 30 days. If `end_date` is null, leave it null and flag it.
- `contract_value` is a number with no currency symbol or tax added.

## Model
Gemini 4 Hydrogen with structured JSON output. If more than two fields are flagged, retry once with Gemini 4 Carbon and keep whichever result has fewer flags.

## Test cases
1. Das Cooling Services, quarterly, 1 Apr 2026 to 31 Mar 2027, Rs 38,500 plus GST: 4 visits (Apr, Jul, Oct, Jan), renewal reminder 2027-03-01, nothing flagged.
2. Sen Air Solutions, monthly, only "1 June 2026", Rs 54,000 plus GST: start 2026-06-01 flagged, end date and renewal null and flagged.
