# NAFDAC Drug Verifier v2 — Design Spec
**Date:** 2026-08-10
**Status:** Approved — ready for implementation planning

---

## Overview

NAFDAC Verifier v2 expands the existing pharmacist tool into a dual-mode platform:
- **Pharmacist mode** — the existing experience, with power additions (expiry checker, physical inspection checklist, suspected fake reporting)
- **Community mode** — same backend, plain-language framing, consumer-safe defaults for patients buying drugs at open markets

**The problem it solves beyond v1:** A VERIFIED badge only means the drug name is registered. It does not mean the specific pack in hand is genuine, unexpired, or unaltered. V2 closes that gap with physical inspection guidance, expiry checking, and a reporting pipeline that goes directly to NAFDAC's SF alert inbox in WHO Rapid Alert System format.

**Portfolio angle:** Shows user research (two distinct audiences, same system), responsible AI framing (we tell users what verification *doesn't* guarantee), and real-world integration with NAFDAC's official reporting channel.

---

## What Changes vs V1

| Layer | V1 | V2 |
|---|---|---|
| Backend core | Unchanged | Unchanged |
| Backend additions | — | `reports` table + `POST /report` + Resend email |
| Frontend | Single pharmacist mode | Two-mode, redesigned component tree |
| Stats | — | Slim impact strip |
| Expiry | — | Inline checker on VERIFIED card |
| Checklist | — | Physical inspection on NOT_FOUND (+ VERIFIED in community mode) |
| Reporting | — | ReportForm → backend → sf.alert@nafdac.gov.ng |

---

## Architecture

```
[Unchanged: SQLite FTS5 + FastAPI + Claude Haiku]
        +
  [reports table]  ←  POST /report  →  Resend API  →  sf.alert@nafdac.gov.ng

[React frontend v2]
  ModeToggle (Pharmacist | Community)  — persisted in localStorage
  StatsStrip                           — static, collapsible, dismissed state in localStorage
  SearchInput + TypeaheadDropdown      — unchanged
  ResultCard
   ├── VerifiedCard    + ExpiryChecker
   ├── NotFoundCard    + PhysicalChecklist + ReportForm
   └── MultipleMatchesCard             — unchanged
  AboutPanel, Footer                   — minor copy updates
```

---

## Backend Additions

### Data Model

```sql
CREATE TABLE reports (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    drug_query    TEXT NOT NULL,
    closest_match TEXT,           -- top closest_match from the /verify response
    manufacturer  TEXT,
    batch_number  TEXT,
    expiry_date   TEXT,
    observation   TEXT,
    location      TEXT,
    created_at    TEXT NOT NULL   -- ISO 8601, WAT
);
```

### POST /report

**Request:**
```json
{
  "drug_query": "Amoxicillin 500mg",
  "closest_match": "Amoxicillin 500mg Capsules — Emzor — A4-0083",
  "manufacturer": "Emzor",
  "batch_number": "BN2024/0041",
  "expiry_date": "09/2025",
  "observation": "Blurry print, unusual smell, seal tampered",
  "location": "Lagos Island"
}
```

All fields except `drug_query` are optional. `closest_match` is populated automatically by the frontend from the `/verify` response — not entered by the user.

**Flow:**
1. Validate — `drug_query` must not be empty
2. Insert row into `reports` table
3. Call Resend API → send HTML email to `sf.alert@nafdac.gov.ng`
4. Return `{ "status": "received", "ref": "SF-2026-1047" }`

**Email failure handling:** If Resend call fails, report is still saved to DB and `{ "status": "received" }` is returned. Email is best-effort — the DB record is the source of truth.

**Ref number format:** `SF-{YEAR}-{report_id zero-padded to 4 digits}` — mirrors WHO substandard/falsified classification prefix.

### Email Format (HTML, Resend)

**Subject:** `[SF ALERT] Suspected Falsified Medicine — {drug_query} — {location} — Ref {ref}`

**Body (HTML):**

```
SUBSTANDARD/FALSIFIED MEDICINE ALERT
Submitted via NAFDAC Verifier
WHO Rapid Alert System Reference

Ref No.          SF-2026-1047
Date / Time      10 Aug 2026, 14:32 WAT
Registry Status  NOT FOUND in NAFDAC DB

PRODUCT INFORMATION
Product name     {drug_query}
Manufacturer     {manufacturer or "Not provided"}
Batch number     {batch_number or "Not provided"}
Expiry date      {expiry_date or "Not provided"}
Closest NAFDAC   {closest match from search, if available}
match

SUSPECTED ISSUE
"{observation or "No observation provided"}"

LOCATION         {location or "Not provided"}

Reporter: Anonymous (NAFDAC Verifier App)
Alternative reporting: Med Safety App (medsafety.io)
NAFDAC Hotline: 0800-162-3322 (toll-free)
SF Alert email: sf.alert@nafdac.gov.ng
```

### New Environment Variables (Railway)

| Key | Value |
|---|---|
| `RESEND_API_KEY` | Resend API key |
| `NAFDAC_REPORT_EMAIL` | `sf.alert@nafdac.gov.ng` |
| `FROM_EMAIL` | Verified sender address on Resend account |

---

## Frontend — Component Tree

```
App
 ├── Header          (app name + ModeToggle + info icon)
 ├── StatsStrip      (collapsible, dismissed state in localStorage)
 ├── AboutPanel      (collapsible, minor copy update)
 ├── SearchInput     (unchanged)
 │    └── TypeaheadDropdown  (unchanged)
 ├── ResultCard      (conditional, renders after submit)
 │    ├── VerifiedCard
 │    │    ├── ExpiryChecker
 │    │    └── PhysicalChecklist (community mode only, open by default)
 │    ├── NotFoundCard
 │    │    ├── PhysicalChecklist (collapsed in pharmacist, open in community)
 │    │    └── ReportForm
 │    └── MultipleMatchesCard  (unchanged)
 └── Footer          (minor copy update)
```

---

## Mode Toggle

- Lives in Header, right side, beside the info icon
- Two states: `Pharmacist` | `Community`
- Default: `Pharmacist`
- Persisted in `localStorage` key `nafdac_mode`
- No routing change, no URL difference, no backend change
- Mode prop passed down to ResultCard and children

---

## Stats Strip

- Appears below Header, above SearchInput
- Static — no API call, hardcoded copy with sources
- Green-tinted background (`#F0FDF4`), slim (48px height on mobile)
- Two stats on one line, wraps gracefully on small screens:
  > *1 in 10 medicines may be counterfeit (WHO) · ~169K child deaths/yr from fake drugs (Lancet, 2018)*
  > **Verify every drug. Every time.**
- Dismiss `[×]` button saves `nafdac_strip_dismissed=true` to `localStorage`
- Does not reappear after dismissal
- Community mode copy: *"Fake drugs are common in Nigeria. Always verify before you take."*

---

## Expiry Checker

- Inline component rendered below the drug details on VerifiedCard
- Two inputs: MM (2 digits) + YY (2 digits), 48px height, full-width row
- [CHECK] button — 48px height, full width on mobile
- Logic: purely client-side, compare entered month/year to today
- Results rendered inline below inputs:

| Result | Colour | Copy |
|---|---|---|
| VALID | Green | "Expires {MM}/{YY} — safe to dispense" |
| EXPIRES SOON | Amber | "Expires within 30 days — check with patient before dispensing" |
| EXPIRED | Red | "EXPIRED — do not dispense. Remove from stock immediately." |

- Community mode copy: EXPIRED → "DO NOT TAKE — this drug is expired and may be harmful"
- Inputs only accept digits. MM validated 01–12. Invalid input shows inline error.

---

## Physical Inspection Checklist

- Collapsible section on NotFoundCard
- Pharmacist mode: collapsed by default, tap `[+]` to expand
- Community mode: open by default, no collapse
- Also shown on VerifiedCard in Community mode (below ExpiryChecker) — because registration ≠ the specific pack is genuine

**Checklist items:**
1. Packaging seal intact?
2. Print sharp — no blurring or smudging?
3. Lot number matches expiry label?
4. Colour and smell normal for this drug?
5. No signs of heat or smoke damage?

Each item is a full-width tap target (48px min height) with a checkbox. No submission — purely a visual prompt.

Footer of checklist: *"If any box fails — do not dispense. Report below."*

---

## Report Form

- Appears below NotFoundCard (both modes)
- Pre-fills `drug_query` from the search that triggered NOT_FOUND
- Fields:

| Field | Required | Notes |
|---|---|---|
| Drug name | Yes | Pre-filled, editable |
| Manufacturer | No | As printed on pack |
| Batch number | No | From pack label |
| Expiry date | No | Pre-fills from ExpiryChecker if already entered |
| Observation | No | Free text, 280 char max |
| Location | No | City/area — no GPS, no personal data |

- All inputs: full-width, 48px height
- [SEND REPORT TO NAFDAC] button: full-width, green, 52px height
- On success: button replaced with confirmation banner
  - *"Report #SF-2026-1047 sent to NAFDAC. Reference this number if you follow up."*
- On network failure: *"Could not send right now. Call NAFDAC: 0800-162-3322"*
- No login. No email collected from reporter. Fully anonymous.

---

## Two-Mode Copy Differences

| Element | Pharmacist | Community |
|---|---|---|
| Search placeholder | "Drug name or NAFDAC reg number" | "Type the drug name on your pack" |
| VERIFIED badge | "✓ VERIFIED" | "✓ THIS DRUG IS REGISTERED" |
| VERIFIED subtext | — | "Registration doesn't guarantee this pack is genuine — check below" |
| NOT_FOUND badge | "✕ NOT FOUND — POSSIBLE COUNTERFEIT" | "⚠ WARNING — DO NOT TAKE THIS DRUG" |
| NOT_FOUND body | Claude risk assessment (technical) | "This drug was not found in the official NAFDAC database. It may be fake or harmful." |
| Checklist default | Collapsed | Open |
| NAFDAC hotline | NOT_FOUND card only | Every result card |
| Report button label | "Report to NAFDAC" | "Flag this drug as suspicious" |
| Stats strip copy | See Stats Strip section | "Fake drugs are common in Nigeria. Always verify before you take." |

---

## Mobile Constraints (All New Components)

- All tap targets: minimum 48px height
- All inputs: full viewport width
- Checklist items: full-width rows, checkbox left-aligned
- ReportForm: single-column, no side-by-side fields
- Stats strip: wraps to two lines gracefully, dismiss button 44px tap area
- ExpiryChecker: MM/YY inputs side by side (each ~40% width), CHECK button full-width below on small screens
- System sans-serif font stack throughout — no web fonts

---

## Error Handling Additions

| Condition | Behaviour |
|---|---|
| Resend API fails | Report saved to DB, success shown to user, email silently skipped |
| Report endpoint down | "Could not send right now. Call NAFDAC: 0800-162-3322" |
| Invalid MM/YY in expiry checker | Inline error below input, no result shown |
| MM out of 01–12 range | "Enter a valid month (01–12)" |
| Empty drug_query on report | Submit button disabled |

---

## Deployment Notes

No changes to Railway start command, DB path, or Vercel config.

New Railway env vars: `RESEND_API_KEY`, `NAFDAC_REPORT_EMAIL`, `FROM_EMAIL`

`requirements.txt` addition: `resend` (Resend Python SDK)

---

## What This Demonstrates (Portfolio Story — V2 Addition)

1. **Dual-audience design** — same data layer, two distinct UX modes based on user research
2. **Responsible framing** — explicitly tells users what the tool does *not* guarantee
3. **Real regulatory integration** — reports go to NAFDAC's actual SF alert inbox in WHO format
4. **Mobile-first discipline** — every new component designed for a pharmacist or patient on a phone
5. **Client-side logic** — expiry checker runs with zero API calls; fast on 3G
