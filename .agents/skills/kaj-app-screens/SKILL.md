---
name: kaj-app-screens
description: Screen layout and UX rules for the KAJ web app (owner dashboard and technician screen). Use when building or changing any page, navigation, component or demo data.
---

# KAJ app screens

Mobile-first PWA. Follow `kaj-guardrails`. The promise is "no forms": people talk, snap or tap; the AI fills the rest; humans only confirm.

## Roles
- **Owner:** sees everything, approves money messages and edits.
- **Technician:** sees only today's visits and the record button.
Switch roles with a simple toggle for the demo (no real auth needed in the prototype).

## Owner screens
1. **Today (home):** four count cards: Visits due today, Unbilled extras, Overdue payments (Rs total), Renewals in next 30 days. Each card opens its list. A "Needs your review" strip at the top shows flagged items.
2. **Contracts:** list plus "Add contract" (upload photo/PDF, or paste text). Result screen shows extracted fields, flagged fields highlighted in amber, visit schedule, renewal date, and a link to the original file. Buttons: Confirm, Edit field.
3. **Bills and payments:** bill lines from voice notes, invoices with days overdue (computed by code), reminder drafts with Approve / Edit / Mark paid.
4. **Daily digest:** one card summarising today: visits done and missed, extras billed, money overdue, renewals due. Button: "Share digest on WhatsApp" (wa.me link to self).

## Technician screen
- List of today's visits (client, site, units).
- Tap a visit, then one big mic button and one camera button.
- After recording: summary card, Confirm or Re-record. Nothing to type.

## Every record
- Shows "Source" (file or voice note, time, who confirmed).
- Edits keep history in the audit log.

## Demo data
Seed one provider (Das Cooling Services) with 5 contracts, 8 visits, 3 invoices (one 36 days overdue), and one renewal due within 30 days, so every dashboard card has something real to show.
