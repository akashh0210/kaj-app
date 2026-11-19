---
name: kaj-payment-reminder
description: Draft owner-approved payment and renewal reminders in English and Bengali, and track their status. Use when building overdue tracking, reminder drafts, approval buttons or WhatsApp sending.
---

# Payment and renewal reminders

Follow `kaj-guardrails` at all times.

## Flow
1. Code computes `days_overdue` from due date and today (IST). Never ask the model for this.
2. Gemini 4 Hydrogen drafts `message_english` and `message_bengali`, each under 60 words.
3. Status starts as `draft`. Only an owner tap on Approve sets `approved`, recording approver and time in the audit log.
4. Before opening WhatsApp, code rechecks: still unpaid, no open dispute.
5. On Approve, open `https://wa.me/<client_phone>?text=<url-encoded message>` in a new tab so the owner sends it from their own WhatsApp. Set status `opened_in_whatsapp`, then `sent` when the owner taps "Mark as sent". If no phone number is stored, show the message with a Copy button instead.
6. Status flow: `draft` → `approved` → `opened_in_whatsapp` → `sent`, or `paid` / `disputed` at any point. Show it on the dashboard.

## Draft rules
- Polite and short. Include client name, invoice number, amount and original due date.
- No threats, no legal language, no discounts, no new payment dates.
- Return an `owner_note` listing anything to check before sending.

## Reply handling
- "Will pay next Friday": propose a promise record with both candidate dates; owner confirms.
- Any dispute or partial-payment message: freeze reminders for that client and alert the owner. Never auto-reply.

## Test case
Greenview Housing Society, invoice DCS/INV/2026/118, Rs 19,250 plus GST, due 2026-10-15. On 2026-11-20, days overdue = 36.
