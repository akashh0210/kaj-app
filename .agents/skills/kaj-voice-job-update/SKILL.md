---
name: kaj-voice-job-update
description: Turn a technician's Bengali, Hindi or English voice note into a visit update and bill lines. Use when building audio upload, recording, job closure or extra-work billing.
---

# Voice note to job update

Follow `kaj-guardrails` at all times.

## Output schema
```json
{
  "language": null,
  "site_or_client": null,
  "contract_no": null,
  "units_serviced": [{"type": null, "quantity": null}],
  "units_pending": [{"type": null, "quantity": null}],
  "extra_work": [{"item": null, "quantity": null}],
  "summary_english": null,
  "needs_review": []
}
```

## Input
- Technician records in the app with one large mic button (browser MediaRecorder, webm/ogg). Optional photo of the unit. No text fields to fill.
- After extraction, show a short summary card with Confirm and Re-record buttons only.

## Rules
- Send audio directly to Gemini 4 Hydrogen; do not transcribe separately first.
- Code matches `site_or_client` to an open visit. If zero or more than one visit matches, flag it and ask the owner to pick.
- Each `extra_work` item becomes a draft bill line priced from the rate card. If the item is not on the rate card, leave price null and ask the owner.
- A visit is marked done only after the owner or manager confirms.
- Vague notes ("kaaj hoye gechhe, sob thik ache") must come back flagged, not guessed.

## Test cases
1. "Greenview Society, Block C-te charte split AC service hoye gechhe, ekta-te gas top-up korlam. Baki duto porer din korbo." Expect 4 serviced, 2 pending, 1 gas top-up.
2. "Haan, oi site-e kaaj hoye gechhe, sob thik ache." Expect site null and flagged.
