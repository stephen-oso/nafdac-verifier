# NAFDAC Drug Verifier — Design Spec
**Date:** 2026-08-06
**Status:** Approved — ready for implementation planning

---

## Overview

Mobile-first web app for Nigerian pharmacists to verify drug legitimacy at the counter. The pharmacist types a drug name or NAFDAC registration number and gets an instant answer: VERIFIED, NOT FOUND, or MULTIPLE MATCHES.

**The problem it solves:** Counterfeit drugs kill people in Nigeria. Pharmacists have no fast, phone-friendly way to check whether a product is NAFDAC-registered at the point of sale. The NAFDAC Greenbook exists but is a desktop website with no API.

**Portfolio angle:** Real data from a real African regulatory body. LLM used at the ambiguity boundary — as a risk communicator, not a chatbot. Scraper as a skill demonstrator.

---

## Stack

```
Python scraper → SQLite (FTS5) → FastAPI → Claude Haiku → React (mobile-first)
                                  Railway                    Vercel
```

---

## Architecture & Data Flow

```
[Python scraper]
      │  runs once locally, output committed to repo
      ▼
[SQLite DB]
  ── drugs        (raw fields from NAFDAC Greenbook)
  ── drugs_fts    (FTS5 virtual table: drug_name, generic_name, manufacturer)
  ── meta         (scrape_date)

[FastAPI on Railway]  ← keep-alive ping every 10min via Railway cron

  GET /search?q=<str>   (≥3 chars)
    └─ FTS5 prefix search on drug_name + generic_name
    └─ Returns up to 5 {name, reg_number} suggestions
    └─ No Claude call

  POST /verify  { query: string }
    1. Detect input type:
       - Matches reg_number pattern (e.g. A4-XXXX) → exact lookup by reg_number
       - Otherwise → exact case-insensitive match on drug_name
    2. Exact hit → VERIFIED (return card, no Claude call)
    3. No exact hit → FTS5 ranked search, top 5 candidates
       - 1 candidate only → NOT_FOUND with that candidate as closest_match
         └─ Claude Haiku: risk assessment + pharmacist action
       - 2+ candidates, top score ≥2× second score → single best match
         └─ Claude Haiku: risk note ("closest match found, confirm details")
         └─ Return as MULTIPLE_MATCHES with one pre-highlighted entry
       - 2+ candidates roughly equal → MULTIPLE_MATCHES list
         └─ Claude Haiku: disambiguation guidance
       - 0 candidates → NOT_FOUND with empty closest_matches
         └─ Claude Haiku: risk assessment + pharmacist action
    4. If Claude unavailable → return result without summary (graceful degradation)

  MULTIPLE_MATCHES selection:
    └─ Resolved locally in frontend — no second API call
    └─ Candidates are fully included in the initial response

[React SPA on Vercel]
  Single screen
  Typeahead: ≥3 chars, 5 results, 300ms debounce, drug_name/generic_name only
  Reg number typed → no typeahead, submit directly
  Result card rendered per state
  Info icon → collapsible about panel
  Footer → scrape date + staleness warning if >90 days
```

**Key constraint:** Claude is only called on NOT_FOUND and MULTIPLE_MATCHES — never on VERIFIED. VERIFIED hits return instantly with zero LLM latency.

---

## Data Model

```sql
CREATE TABLE drugs (
    id                   INTEGER PRIMARY KEY,
    drug_name            TEXT NOT NULL,
    generic_name         TEXT,
    reg_number           TEXT UNIQUE NOT NULL,
    manufacturer         TEXT,
    country_of_origin    TEXT,
    dosage_form          TEXT,
    therapeutic_category TEXT,
    approval_date        TEXT
);

-- Content FTS5 table, synced via triggers at insert time
CREATE VIRTUAL TABLE drugs_fts USING fts5(
    drug_name,
    generic_name,
    manufacturer,
    content='drugs',
    content_rowid='id'
);

CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT
    -- scrape_date: ISO 8601 string stored here at scrape time
);
```

**Reg number detection:** Input matching `/^[A-Z0-9]+-\d+$/i` routes to exact `reg_number` lookup — skips FTS entirely.

**Scraper contract:** Populates all three tables. Stores today's date in `meta.scrape_date`. Missing Greenbook fields stored as NULL — no invented values.

**No deduplication logic beyond `UNIQUE` on `reg_number`.** Duplicate NAFDAC entries surface as MULTIPLE_MATCHES — visible to the pharmacist, not silently merged.

---

## API

### POST /verify

**Request:**
```json
{ "query": "amoxicillin" }
```

**Response — VERIFIED:**
```json
{
  "status": "VERIFIED",
  "drug": {
    "drug_name": "Amoxicillin 250mg Capsules",
    "generic_name": "Amoxicillin",
    "reg_number": "A4-0082",
    "manufacturer": "Emzor Pharmaceutical Industries",
    "country_of_origin": "Nigeria",
    "dosage_form": "Capsule",
    "therapeutic_category": "Antibiotic",
    "approval_date": "2019-03-14"
  },
  "summary": null
}
```

**Response — NOT_FOUND:**
```json
{
  "status": "NOT_FOUND",
  "drug": null,
  "closest_matches": [
    { "drug_name": "...", "reg_number": "...", "manufacturer": "..." }
  ],
  "summary": "This product was not found in the NAFDAC registry. The closest registered drug is X by Y. Key difference: the manufacturer on your package does not match any approved registrant. Recommend refusing this product and reporting to NAFDAC."
}
```

**Response — MULTIPLE_MATCHES:**
```json
{
  "status": "MULTIPLE_MATCHES",
  "drug": null,
  "candidates": [
    {
      "drug_name": "...",
      "reg_number": "...",
      "manufacturer": "...",
      "dosage_form": "...",
      "therapeutic_category": "..."
    }
  ],
  "summary": "Multiple registered products match this name. Select the correct strength and manufacturer below."
}
```

### GET /search?q=amox

```json
{
  "results": [
    { "drug_name": "Amoxicillin 250mg Capsules", "reg_number": "A4-0082" },
    { "drug_name": "Amoxicillin 500mg Capsules", "reg_number": "A4-0083" }
  ]
}
```

### GET /health

```json
{ "status": "ok", "scrape_date": "2026-08-06", "drug_count": 14823 }
```

Used by keep-alive ping. Surfaced in About panel.

**CORS:** Whitelist — Vercel production URL + `localhost:5173`. Wildcard explicitly not used.

---

## Frontend / UI

### Component Tree

```
App
 ├── Header          (app name + info icon)
 ├── AboutPanel      (collapsible, hidden by default)
 ├── SearchInput     (controlled input + submit button)
 │    └── TypeaheadDropdown  (conditional, ≥3 chars)
 ├── ResultCard      (conditional, renders after submit)
 │    ├── VerifiedCard
 │    ├── NotFoundCard
 │    └── MultipleMatchesCard  (tap row → expands inline to VerifiedCard view, no API call)
 └── Footer          (scrape date + staleness warning)
```

### Color System

| Token | Hex | Use |
|---|---|---|
| `--green` | `#008751` | VERIFIED badge, buttons, header accent |
| `--red` | `#CC0000` | NOT_FOUND badge, warning text |
| `--amber` | `#B45309` | MULTIPLE_MATCHES badge |
| `--bg` | `#FFFFFF` | Page background |
| `--surface` | `#F9FAFB` | Card background |
| `--text-primary` | `#111827` | Body text |
| `--text-muted` | `#6B7280` | Labels, secondary info |

Font: system sans-serif stack. No web font — fast on 3G.

### Result States

**VERIFIED**
```
┌─────────────────────────────────┐
│  ✓ VERIFIED                     │  ← green badge
│  Amoxicillin 250mg Capsules     │  ← drug_name, large bold
│─────────────────────────────────│
│  Manufacturer   Emzor Pharma    │
│  Reg. Number    A4-0082         │
│  Dosage Form    Capsule         │
│  Category       Antibiotic      │
│  Approved       14 Mar 2019     │
└─────────────────────────────────┘
No Claude summary — the card is the answer.
```

**NOT FOUND**
```
┌─────────────────────────────────┐
│  ✕ NOT FOUND — POSSIBLE         │
│    COUNTERFEIT                  │  ← red badge
│─────────────────────────────────│
│  [Claude risk assessment]       │
│  [or hardcoded fallback]        │
│─────────────────────────────────│
│  Closest matches in registry:   │
│  · Amoxicillin 500mg — A4-0083  │
└─────────────────────────────────┘
```

**MULTIPLE MATCHES**
```
┌─────────────────────────────────┐
│  ⚠ MULTIPLE MATCHES             │  ← amber badge
│  [Claude disambiguation text]   │
│─────────────────────────────────│
│  › Amoxicillin 250mg Capsules   │
│  › Amoxicillin 500mg Capsules   │
│  › Amoxicillin Syrup 125mg/5ml  │
└─────────────────────────────────┘
Tap row → expands inline to full VERIFIED card view. No second API call.
```

### Mobile Constraints
- Minimum tap target: 48px height on all interactive elements
- Input + button: full viewport width
- Cards: full width, generous padding
- Typeahead dropdown: overlays content, max-height 240px, scrollable

### About Panel (info icon, top-right)
One paragraph: what NAFDAC is, what this tool does, data source attribution, scrape date. Collapses back on tap outside.

### Footer
```
DB last updated: 6 Aug 2026                         ← always visible, muted
⚠ Data may be outdated — verify with NAFDAC        ← only if scrape_date > 90 days ago
```

---

## Error Handling

| Condition | Behavior |
|---|---|
| Claude down/timeout | Return result with `summary: null`. Card renders fully. Inline note: "AI summary unavailable." |
| NOT_FOUND + Claude down | Hardcoded fallback: "Do not dispense. Contact NAFDAC: +234 (0) 700-1-623322" |
| 0 FTS5 results | NOT_FOUND with empty closest_matches |
| Network timeout (8s) | "Connection timed out. Check your network and try again." |
| DB unavailable | "Service temporarily unavailable." full-screen |
| Empty input | Submit button disabled client-side |

Every error message tells the pharmacist what to do next — not just what went wrong.

**NAFDAC hotline (confirmed):** +234 (0) 700-1-623322
**NAFDAC contact page:** https://nafdac.gov.ng/about-nafdac/contact-nafdac/

> **Production upgrade notes (not built now):**
> - Auto-retry once on transient network errors — important on Nigerian 3G
> - Detect `navigator.onLine` to distinguish offline vs. timeout copy
> - Richer hardcoded risk copy for NOT_FOUND when Claude is unavailable
> - Reduce keep-alive ping to 5 min — current 10 min window overlaps with Railway's sleep timer
> - "Waking up" loading state for cold starts instead of triggering the timeout

---

## Deployment

### Backend — Railway

```
/backend
  main.py           FastAPI app
  requirements.txt

/data
  scrape.py         run locally, outputs drugs.db (not deployed to Railway)
  drugs.db          committed to repo

Railway config:
  Start command: uvicorn main:app --host 0.0.0.0 --port $PORT
  Keep-alive:    Railway cron → GET /health every 10 minutes
  Env vars:      ANTHROPIC_API_KEY
```

### Frontend — Vercel

```
/frontend
  src/
  public/
  .env.production   VITE_API_URL=https://<railway-app>.railway.app

Vercel config:
  Framework preset: Vite
  Build command:    npm run build
  Output dir:       dist
```

### Environment Variables

| Location | Key | Value |
|---|---|---|
| Railway | `ANTHROPIC_API_KEY` | Anthropic API key |
| Vercel | `VITE_API_URL` | Railway backend URL |

### Repo Layout

```
nafdac-verifier/
  backend/
  frontend/
  data/
    scrape.py       run locally to regenerate drugs.db
    drugs.db        committed — the scraped dataset
  docs/
    superpowers/
      specs/
        2026-08-06-nafdac-verifier-design.md
  README.md
```

**Scraper runs locally, never on Railway.** `drugs.db` is committed to the repo. Railway serves it read-only.

---

## What This Demonstrates (Portfolio Story)

1. **Scraper as a skill** — extracted real structured data from NAFDAC's HTML Greenbook with no public API
2. **LLM used correctly** — Claude called only at the ambiguity boundary (NOT_FOUND, MULTIPLE_MATCHES), not sprayed everywhere
3. **Right tool for each job** — FTS5 for deterministic matching, Haiku for risk communication
4. **African healthcare context** — genuinely underserved market, real regulatory data, real problem
5. **Mobile-first constraint** — system sans-serif, 48px targets, 8s timeout, 300ms debounce — every decision made for a pharmacist on a phone
