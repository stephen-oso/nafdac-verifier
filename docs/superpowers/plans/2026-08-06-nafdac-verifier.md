# NAFDAC Drug Verifier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first drug verification web app that lets Nigerian pharmacists check whether a product is NAFDAC-registered by typing a drug name or registration number.

**Architecture:** Python scraper populates a SQLite DB (committed to the repo) with NAFDAC Greenbook data. A FastAPI backend serves three endpoints — POST /verify (FTS5 lookup + Claude Haiku risk summary on ambiguous results), GET /search (typeahead), GET /health (keep-alive target). A React SPA on Vercel calls the Railway-hosted API.

**Tech Stack:** Python 3.11+, FastAPI 0.111+, Pydantic v2, SQLite FTS5, anthropic SDK 0.28+, requests 2.31+, BeautifulSoup4 4.12+, pytest 8.2+, httpx 0.27+, React 18+, Vite 5+, plain CSS custom properties (no component library)

## Global Constraints

- Claude model: `claude-haiku-4-5-20251001` — do not substitute
- Claude called ONLY on NOT_FOUND and MULTIPLE_MATCHES — never on VERIFIED
- FTS5 dominance rule: top result is dominant if `abs(top_rank) / abs(second_rank) >= 2.0`
- Single FTS5 candidate → NOT_FOUND (not MULTIPLE_MATCHES)
- Typeahead: minimum 3 chars, max 5 results, 300ms debounce (client-side)
- Mobile tap targets: minimum 48px height on all interactive elements
- Font: system sans-serif stack — no web font imports
- CORS: explicit whitelist only — no wildcard
- NAFDAC hotline hardcoded as `+234 (0) 700-1-623322`
- DB path env var: `DB_PATH`, default `../data/drugs.db` (relative to backend/)
- All NULL fields stored as `null` in JSON responses — never omitted

---

## File Map

```
nafdac-verifier/
  backend/
    main.py                   FastAPI app, CORS config, router mounts
    db.py                     SQLite connection, all query functions
    models.py                 Pydantic request/response models
    claude_client.py          Anthropic async client, three prompt functions
    routers/
      __init__.py
      verify.py               POST /verify — full verification pipeline
      search.py               GET /search — typeahead
      health.py               GET /health — keep-alive target
    tests/
      conftest.py             Shared test DB fixture
      test_db.py              FTS5 query unit tests
      test_verify.py          POST /verify integration tests
      test_search.py          GET /search integration tests
      test_health.py          GET /health integration tests
    requirements.txt

  data/
    scrape.py                 One-shot NAFDAC Greenbook scraper (run locally)
    drugs.db                  Committed output of scrape.py

  frontend/
    index.html
    vite.config.js
    package.json
    src/
      main.jsx                React root mount
      App.jsx                 Root state, layout orchestration
      api.js                  Fetch wrappers for all three endpoints
      index.css               CSS custom properties + global resets
      components/
        Header.jsx            App name + info icon button
        AboutPanel.jsx        Collapsible about panel
        SearchInput.jsx       Controlled input + Verify button
        TypeaheadDropdown.jsx Suggestion list, fires on ≥3 chars
        ResultCard.jsx        Routes to correct card by status
        VerifiedCard.jsx      VERIFIED state — green badge + data grid
        NotFoundCard.jsx      NOT_FOUND state — red badge + summary + closest
        MultipleMatchesCard.jsx MULTIPLE_MATCHES — amber badge + selectable list
        Footer.jsx            Scrape date + conditional staleness warning

  .gitignore
  README.md (placeholder — not built in this plan)
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `.gitignore`
- Create: `backend/requirements.txt`
- Create: `backend/routers/__init__.py`
- Create: `backend/tests/__init__.py` (empty)
- Create: `frontend/` (via Vite CLI)

- [ ] **Step 1: Create .gitignore**

```
# Python
__pycache__/
*.py[cod]
.venv/
*.egg-info/
.env

# SQLite (never ignore drugs.db — it's committed)
*.db-shm
*.db-wal

# Node
node_modules/
dist/
.env.local
.env.production

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 2: Create backend/requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
pydantic==2.7.1
anthropic==0.28.0
requests==2.31.0
beautifulsoup4==4.12.3
httpx==0.27.0
pytest==8.2.2
pytest-asyncio==0.23.7
```

- [ ] **Step 3: Create backend/routers/__init__.py and backend/tests/__init__.py**

Both files are empty. Just `touch` them.

- [ ] **Step 4: Scaffold the frontend with Vite**

Run from `nafdac-verifier/`:
```bash
npm create vite@latest frontend -- --template react
cd frontend && npm install
```

- [ ] **Step 5: Verify Vite works**

```bash
cd frontend && npm run dev
```
Open `http://localhost:5173`. You should see the default Vite + React page. Ctrl-C to stop.

- [ ] **Step 6: Commit**

```bash
git add .gitignore backend/requirements.txt backend/routers/__init__.py backend/tests/__init__.py frontend/
git commit -m "chore: project scaffold — backend requirements, frontend Vite setup"
```

---

### Task 2: Database Schema & Connection Module

**Files:**
- Create: `backend/db.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_db.py`

**Interfaces:**
- Produces:
  - `db.exact_match(query: str) -> dict | None`
  - `db.fts_search(query: str, limit: int = 5) -> list[dict]`
  - `db.prefix_search(query: str, limit: int = 5) -> list[dict]`
  - `db.get_meta() -> dict`  (keys: `scrape_date: str | None`, `drug_count: int`)

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/conftest.py`:
```python
import sqlite3
import pytest
import os

SCHEMA = """
CREATE TABLE drugs (
    id INTEGER PRIMARY KEY,
    drug_name TEXT NOT NULL,
    generic_name TEXT,
    reg_number TEXT UNIQUE NOT NULL,
    manufacturer TEXT,
    country_of_origin TEXT,
    dosage_form TEXT,
    therapeutic_category TEXT,
    approval_date TEXT
);
CREATE VIRTUAL TABLE drugs_fts USING fts5(
    drug_name, generic_name, manufacturer,
    content='drugs', content_rowid='id'
);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
"""

SEED = """
INSERT INTO drugs VALUES (1,'Amoxicillin 250mg Capsules','Amoxicillin','A4-0082','Emzor Pharma','Nigeria','Capsule','Antibiotic','2019-03-14');
INSERT INTO drugs VALUES (2,'Amoxicillin 500mg Capsules','Amoxicillin','A4-0083','May and Baker','Nigeria','Capsule','Antibiotic','2020-01-10');
INSERT INTO drugs VALUES (3,'Cotrimoxazole 480mg Tablets','Cotrimoxazole','B4-0044','GlaxoSmithKline Nigeria','Nigeria','Tablet','Antibiotic','2018-06-22');
INSERT INTO drugs_fts(rowid, drug_name, generic_name, manufacturer)
    SELECT id, drug_name, generic_name, manufacturer FROM drugs;
INSERT INTO meta VALUES ('scrape_date', '2026-08-06');
"""

@pytest.fixture
def test_db(tmp_path, monkeypatch):
    db_path = str(tmp_path / "test.db")
    monkeypatch.setenv("DB_PATH", db_path)
    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA + SEED)
    conn.close()
    return db_path
```

Create `backend/tests/test_db.py`:
```python
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import db

def test_exact_match_by_drug_name(test_db):
    row = db.exact_match("Amoxicillin 250mg Capsules")
    assert row is not None
    assert row["reg_number"] == "A4-0082"

def test_exact_match_case_insensitive(test_db):
    row = db.exact_match("amoxicillin 250mg capsules")
    assert row is not None

def test_exact_match_by_reg_number(test_db):
    row = db.exact_match("A4-0082")
    assert row is not None
    assert row["drug_name"] == "Amoxicillin 250mg Capsules"

def test_exact_match_reg_number_case_insensitive(test_db):
    row = db.exact_match("a4-0082")
    assert row is not None

def test_exact_match_returns_none_on_miss(test_db):
    row = db.exact_match("FakeDrug 999mg")
    assert row is None

def test_fts_search_returns_ranked_results(test_db):
    results = db.fts_search("amoxicillin")
    assert len(results) >= 2
    assert all("fts_rank" in r for r in results)

def test_fts_search_limit(test_db):
    results = db.fts_search("amoxicillin", limit=1)
    assert len(results) == 1

def test_fts_search_returns_empty_on_no_match(test_db):
    results = db.fts_search("zzznomatchzzz")
    assert results == []

def test_prefix_search_returns_suggestions(test_db):
    results = db.prefix_search("amox")
    assert len(results) >= 1
    assert all("drug_name" in r and "reg_number" in r for r in results)

def test_prefix_search_limit(test_db):
    results = db.prefix_search("amox", limit=1)
    assert len(results) == 1

def test_get_meta_returns_date_and_count(test_db):
    meta = db.get_meta()
    assert meta["scrape_date"] == "2026-08-06"
    assert meta["drug_count"] == 3
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_db.py -v
```
Expected: `ModuleNotFoundError: No module named 'db'`

- [ ] **Step 3: Implement backend/db.py**

```python
import sqlite3
import re
import os
from contextlib import contextmanager

_REG_PATTERN = re.compile(r'^[A-Z0-9]+-\d+$', re.IGNORECASE)

def _db_path() -> str:
    return os.getenv("DB_PATH", "../data/drugs.db")

@contextmanager
def _connect():
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def exact_match(query: str) -> dict | None:
    with _connect() as conn:
        if _REG_PATTERN.match(query):
            row = conn.execute(
                "SELECT * FROM drugs WHERE LOWER(reg_number) = LOWER(?)",
                (query,)
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM drugs WHERE LOWER(drug_name) = LOWER(?)",
                (query,)
            ).fetchone()
    return dict(row) if row else None

def fts_search(query: str, limit: int = 5) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT d.*, drugs_fts.rank AS fts_rank
            FROM drugs_fts
            JOIN drugs d ON drugs_fts.rowid = d.id
            WHERE drugs_fts MATCH ?
            ORDER BY drugs_fts.rank
            LIMIT ?
            """,
            (query, limit)
        ).fetchall()
    return [dict(r) for r in rows]

def prefix_search(query: str, limit: int = 5) -> list[dict]:
    fts_query = f"{query}*"
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT d.drug_name, d.reg_number
            FROM drugs_fts
            JOIN drugs d ON drugs_fts.rowid = d.id
            WHERE drugs_fts MATCH ?
            ORDER BY drugs_fts.rank
            LIMIT ?
            """,
            (fts_query, limit)
        ).fetchall()
    return [dict(r) for r in rows]

def get_meta() -> dict:
    with _connect() as conn:
        row = conn.execute(
            "SELECT value FROM meta WHERE key = 'scrape_date'"
        ).fetchone()
        count = conn.execute("SELECT COUNT(*) FROM drugs").fetchone()[0]
    return {
        "scrape_date": row[0] if row else None,
        "drug_count": count
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_db.py -v
```
Expected: all 11 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/db.py backend/tests/conftest.py backend/tests/test_db.py
git commit -m "feat: database connection module with FTS5 query functions"
```

---

### Task 3: NAFDAC Greenbook Scraper

**Files:**
- Create: `data/scrape.py`

**Note:** The NAFDAC Greenbook at nafdac.gov.ng is a paginated HTML table. Before running the scraper, open your browser's DevTools → Network tab and visit the Greenbook page to find the actual table URL and column order. The scraper below assumes a standard table structure — update `COLUMN_MAP` to match the real column indices before running.

- [ ] **Step 1: Inspect the NAFDAC Greenbook HTML**

Open `https://nafdac.gov.ng/resources/check-nafdac-registered-products/` in a browser. View source and identify:
1. The URL pattern for each page (look for pagination links)
2. The `<table>` column order — note the index (0-based) for each field

- [ ] **Step 2: Create data/scrape.py**

```python
#!/usr/bin/env python3
"""
One-shot NAFDAC Greenbook scraper.
Run from the repo root: python data/scrape.py
Outputs: data/drugs.db
"""
import sqlite3
import requests
import time
import os
from datetime import date
from bs4 import BeautifulSoup

# ── UPDATE THESE AFTER INSPECTING THE ACTUAL PAGE ──────────────────────────
BASE_URL = "https://nafdac.gov.ng/resources/check-nafdac-registered-products/"
# Map field name → column index in the HTML table (0-based)
COLUMN_MAP = {
    "drug_name": 1,
    "reg_number": 2,
    "manufacturer": 3,
    "country_of_origin": 4,
    "dosage_form": 5,
    "therapeutic_category": 6,
    "approval_date": 7,
    "generic_name": None,   # Set to index if column exists, else None
}
# Selector for pagination "next page" link
NEXT_PAGE_SELECTOR = "a[rel='next']"
# ───────────────────────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS drugs (
    id INTEGER PRIMARY KEY,
    drug_name TEXT NOT NULL,
    generic_name TEXT,
    reg_number TEXT UNIQUE NOT NULL,
    manufacturer TEXT,
    country_of_origin TEXT,
    dosage_form TEXT,
    therapeutic_category TEXT,
    approval_date TEXT
);
CREATE VIRTUAL TABLE IF NOT EXISTS drugs_fts USING fts5(
    drug_name, generic_name, manufacturer,
    content='drugs', content_rowid='id'
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
"""

FTS_SYNC = """
INSERT INTO drugs_fts(rowid, drug_name, generic_name, manufacturer)
SELECT id, drug_name, generic_name, manufacturer FROM drugs;
"""

def get_page(url: str, session: requests.Session) -> BeautifulSoup:
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")

def extract_rows(soup: BeautifulSoup) -> list[dict]:
    rows = []
    table = soup.find("table")
    if not table:
        return rows
    for tr in table.find_all("tr")[1:]:  # skip header row
        cells = [td.get_text(strip=True) for td in tr.find_all("td")]
        if not cells:
            continue
        def get(field):
            idx = COLUMN_MAP.get(field)
            if idx is None or idx >= len(cells):
                return None
            val = cells[idx]
            return val if val else None
        row = {
            "drug_name": get("drug_name"),
            "generic_name": get("generic_name"),
            "reg_number": get("reg_number"),
            "manufacturer": get("manufacturer"),
            "country_of_origin": get("country_of_origin"),
            "dosage_form": get("dosage_form"),
            "therapeutic_category": get("therapeutic_category"),
            "approval_date": get("approval_date"),
        }
        if row["drug_name"] and row["reg_number"]:
            rows.append(row)
    return rows

def main():
    db_path = os.path.join(os.path.dirname(__file__), "drugs.db")
    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA)

    session = requests.Session()
    session.headers["User-Agent"] = "NAFDAC-Verifier-Scraper/1.0"

    url = BASE_URL
    total = 0
    page_num = 1

    while url:
        print(f"Scraping page {page_num}: {url}")
        soup = get_page(url, session)
        rows = extract_rows(soup)
        print(f"  → {len(rows)} rows")

        for row in rows:
            try:
                conn.execute(
                    """INSERT OR IGNORE INTO drugs
                       (drug_name, generic_name, reg_number, manufacturer,
                        country_of_origin, dosage_form, therapeutic_category, approval_date)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    (row["drug_name"], row["generic_name"], row["reg_number"],
                     row["manufacturer"], row["country_of_origin"], row["dosage_form"],
                     row["therapeutic_category"], row["approval_date"])
                )
                total += 1
            except sqlite3.Error as e:
                print(f"  Skip row ({row['reg_number']}): {e}")

        conn.commit()

        next_link = soup.select_one(NEXT_PAGE_SELECTOR)
        url = next_link["href"] if next_link else None
        page_num += 1
        time.sleep(1)  # be polite

    # Build FTS index
    print("Building FTS5 index...")
    conn.execute("DELETE FROM drugs_fts")
    conn.executescript(FTS_SYNC)

    # Record scrape date
    conn.execute(
        "INSERT OR REPLACE INTO meta VALUES ('scrape_date', ?)",
        (date.today().isoformat(),)
    )
    conn.commit()
    conn.close()
    print(f"Done. {total} drugs written to {db_path}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Update COLUMN_MAP and run the scraper**

After inspecting the HTML, update `COLUMN_MAP` at the top of `scrape.py`, then run:
```bash
python data/scrape.py
```
Watch the page count and row count. When it finishes, verify:
```bash
sqlite3 data/drugs.db "SELECT COUNT(*) FROM drugs; SELECT * FROM drugs LIMIT 3;"
```
Expect thousands of rows. At least one result from the sample query.

- [ ] **Step 4: Commit drugs.db**

```bash
git add data/scrape.py data/drugs.db
git commit -m "feat: NAFDAC Greenbook scraper + committed drugs.db dataset"
```

---

### Task 4: Pydantic Models

**Files:**
- Create: `backend/models.py`

**Interfaces:**
- Produces:
  - `DrugRecord` — full drug fields, all optional except `drug_name` and `reg_number`
  - `ClosestMatch` — `drug_name`, `reg_number`, `manufacturer`
  - `VerifyRequest` — `query: str` (validated non-empty)
  - `VerifyResponse` — `status`, `drug`, `closest_matches`, `candidates`, `summary`
  - `SearchResponse` — `results: list[SearchResult]`
  - `HealthResponse` — `status`, `scrape_date`, `drug_count`

- [ ] **Step 1: Create backend/models.py**

```python
from pydantic import BaseModel, field_validator
from typing import Optional

class VerifyRequest(BaseModel):
    query: str

    @field_validator("query")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("query cannot be empty")
        return v.strip()

class DrugRecord(BaseModel):
    drug_name: str
    generic_name: Optional[str] = None
    reg_number: str
    manufacturer: Optional[str] = None
    country_of_origin: Optional[str] = None
    dosage_form: Optional[str] = None
    therapeutic_category: Optional[str] = None
    approval_date: Optional[str] = None

class ClosestMatch(BaseModel):
    drug_name: str
    reg_number: str
    manufacturer: Optional[str] = None

class VerifyResponse(BaseModel):
    status: str
    drug: Optional[DrugRecord] = None
    closest_matches: Optional[list[ClosestMatch]] = None
    candidates: Optional[list[DrugRecord]] = None
    summary: Optional[str] = None

class SearchResult(BaseModel):
    drug_name: str
    reg_number: str

class SearchResponse(BaseModel):
    results: list[SearchResult]

class HealthResponse(BaseModel):
    status: str
    scrape_date: Optional[str] = None
    drug_count: int
```

- [ ] **Step 2: Verify models import cleanly**

```bash
cd backend && python -c "from models import VerifyRequest, VerifyResponse, DrugRecord; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/models.py
git commit -m "feat: Pydantic v2 request/response models"
```

---

### Task 5: Claude Client

**Files:**
- Create: `backend/claude_client.py`
- Create: `backend/tests/test_claude_client.py`

**Interfaces:**
- Consumes: nothing (standalone module)
- Produces:
  - `async not_found_summary(query: str, closest: list[ClosestMatch]) -> str | None`
  - `async single_best_match_summary(query: str, best: DrugRecord) -> str | None`
  - `async multiple_matches_summary(query: str, candidates: list[DrugRecord]) -> str | None`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_claude_client.py`:
```python
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from unittest.mock import AsyncMock, MagicMock, patch
from models import ClosestMatch, DrugRecord

@pytest.fixture
def mock_anthropic(monkeypatch):
    mock_msg = MagicMock()
    mock_msg.content = [MagicMock(text="Test summary response.")]
    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock(return_value=mock_msg)
    monkeypatch.setattr("claude_client._client", mock_client)
    return mock_client

@pytest.mark.asyncio
async def test_not_found_summary_returns_string(mock_anthropic):
    import claude_client
    closest = [ClosestMatch(drug_name="Amox 500mg", reg_number="A4-0083", manufacturer="May and Baker")]
    result = await claude_client.not_found_summary("amoxicilin", closest)
    assert isinstance(result, str)
    assert len(result) > 0

@pytest.mark.asyncio
async def test_not_found_summary_no_closest(mock_anthropic):
    import claude_client
    result = await claude_client.not_found_summary("fakename", [])
    assert isinstance(result, str)

@pytest.mark.asyncio
async def test_not_found_summary_returns_none_on_exception(monkeypatch):
    import claude_client
    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock(side_effect=Exception("API down"))
    monkeypatch.setattr("claude_client._client", mock_client)
    result = await claude_client.not_found_summary("x", [])
    assert result is None

@pytest.mark.asyncio
async def test_single_best_match_returns_string(mock_anthropic):
    import claude_client
    best = DrugRecord(drug_name="Amoxicillin 500mg", reg_number="A4-0083", manufacturer="May and Baker")
    result = await claude_client.single_best_match_summary("amoxicilin", best)
    assert isinstance(result, str)

@pytest.mark.asyncio
async def test_multiple_matches_returns_string(mock_anthropic):
    import claude_client
    candidates = [
        DrugRecord(drug_name="Amoxicillin 250mg", reg_number="A4-0082"),
        DrugRecord(drug_name="Amoxicillin 500mg", reg_number="A4-0083"),
    ]
    result = await claude_client.multiple_matches_summary("amoxicillin", candidates)
    assert isinstance(result, str)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_claude_client.py -v
```
Expected: `ModuleNotFoundError: No module named 'claude_client'`

- [ ] **Step 3: Create backend/claude_client.py**

```python
import os
import anthropic
from models import ClosestMatch, DrugRecord

_client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
_MODEL = "claude-haiku-4-5-20251001"
_HOTLINE = "+234 (0) 700-1-623322"

async def not_found_summary(query: str, closest: list[ClosestMatch]) -> str | None:
    try:
        if closest:
            matches_text = "\n".join(
                f"- {m.drug_name} (Reg: {m.reg_number}, Manufacturer: {m.manufacturer or 'Unknown'})"
                for m in closest
            )
            prompt = (
                f'A pharmacist searched for "{query}" in the NAFDAC drug registry. '
                f"It was not found.\n\nClosest registered products:\n{matches_text}\n\n"
                f"Write a 2-3 sentence risk assessment for the pharmacist. Include: "
                f"(1) that the product was not found in the NAFDAC registry, "
                f"(2) what differs between the search and the closest match, "
                f"(3) a clear recommendation to refuse the product and report to NAFDAC at {_HOTLINE}. "
                f"Plain English only. No jargon."
            )
        else:
            prompt = (
                f'A pharmacist searched for "{query}" in the NAFDAC drug registry. '
                f"It was not found and there are no similar registered products. "
                f"Write 2 sentences: state it was not found, and recommend refusing it and "
                f"reporting to NAFDAC at {_HOTLINE}."
            )
        msg = await _client.messages.create(
            model=_MODEL,
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        return msg.content[0].text
    except Exception:
        return None

async def single_best_match_summary(query: str, best: DrugRecord) -> str | None:
    try:
        prompt = (
            f'A pharmacist searched for "{query}". '
            f"The closest NAFDAC-registered product is: "
            f"{best.drug_name} (Reg: {best.reg_number}, "
            f"Manufacturer: {best.manufacturer or 'Unknown'}). "
            f"Write one sentence telling the pharmacist to confirm this is the correct "
            f"product by checking the strength and manufacturer on the package before dispensing."
        )
        msg = await _client.messages.create(
            model=_MODEL,
            max_tokens=100,
            messages=[{"role": "user", "content": prompt}]
        )
        return msg.content[0].text
    except Exception:
        return None

async def multiple_matches_summary(query: str, candidates: list[DrugRecord]) -> str | None:
    try:
        names = ", ".join(c.drug_name for c in candidates[:3])
        prompt = (
            f'A pharmacist searched for "{query}". '
            f"Multiple NAFDAC-registered products match: {names}. "
            f"Write one sentence telling the pharmacist to select the correct product "
            f"by checking the strength and manufacturer on the package."
        )
        msg = await _client.messages.create(
            model=_MODEL,
            max_tokens=100,
            messages=[{"role": "user", "content": prompt}]
        )
        return msg.content[0].text
    except Exception:
        return None
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_claude_client.py -v
```
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/claude_client.py backend/tests/test_claude_client.py
git commit -m "feat: Claude Haiku client with three prompt functions and graceful degradation"
```

---

### Task 6: POST /verify Endpoint

**Files:**
- Create: `backend/routers/verify.py`
- Create: `backend/tests/test_verify.py`

**Interfaces:**
- Consumes: `db.exact_match`, `db.fts_search`, `claude_client.*`, all models
- Produces: `router` (APIRouter) mounted at `/verify`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_verify.py`:
```python
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI
from routers.verify import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)

@pytest.fixture(autouse=True)
def mock_claude(monkeypatch):
    monkeypatch.setattr("routers.verify.claude_client.not_found_summary",
                        AsyncMock(return_value="Mocked risk summary."))
    monkeypatch.setattr("routers.verify.claude_client.single_best_match_summary",
                        AsyncMock(return_value="Mocked single match note."))
    monkeypatch.setattr("routers.verify.claude_client.multiple_matches_summary",
                        AsyncMock(return_value="Mocked disambiguation."))

def test_verify_exact_drug_name_returns_verified(test_db):
    resp = client.post("/verify", json={"query": "Amoxicillin 250mg Capsules"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "VERIFIED"
    assert data["drug"]["reg_number"] == "A4-0082"
    assert data["summary"] is None

def test_verify_case_insensitive(test_db):
    resp = client.post("/verify", json={"query": "amoxicillin 250mg capsules"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "VERIFIED"

def test_verify_reg_number_returns_verified(test_db):
    resp = client.post("/verify", json={"query": "A4-0082"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "VERIFIED"

def test_verify_no_match_returns_not_found(test_db):
    resp = client.post("/verify", json={"query": "zzznomatchzzz"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "NOT_FOUND"
    assert data["drug"] is None
    assert data["summary"] == "Mocked risk summary."

def test_verify_fuzzy_match_returns_multiple_or_not_found(test_db):
    resp = client.post("/verify", json={"query": "amoxicillin"})
    assert resp.status_code == 200
    assert resp.json()["status"] in ("MULTIPLE_MATCHES", "NOT_FOUND")

def test_verify_empty_query_returns_422(test_db):
    resp = client.post("/verify", json={"query": "   "})
    assert resp.status_code == 422

def test_verify_claude_down_still_returns_result(test_db, monkeypatch):
    monkeypatch.setattr("routers.verify.claude_client.not_found_summary",
                        AsyncMock(return_value=None))
    resp = client.post("/verify", json={"query": "zzznomatch"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "NOT_FOUND"
    assert data["summary"] is None
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd backend && python -m pytest tests/test_verify.py -v
```
Expected: `ModuleNotFoundError: No module named 'routers.verify'`

- [ ] **Step 3: Create backend/routers/verify.py**

```python
import re
from fastapi import APIRouter
from models import VerifyRequest, VerifyResponse, DrugRecord, ClosestMatch
import db
import claude_client

router = APIRouter()

_REG_PATTERN = re.compile(r'^[A-Z0-9]+-\d+$', re.IGNORECASE)
_DOMINANCE_RATIO = 2.0
_NOT_FOUND_FALLBACK = (
    "This product was not found in the NAFDAC registry. "
    "Do not dispense. Contact NAFDAC: +234 (0) 700-1-623322"
)

def _to_drug_record(row: dict) -> DrugRecord:
    return DrugRecord(**{k: v for k, v in row.items() if k != "fts_rank"})

def _to_closest(row: dict) -> ClosestMatch:
    return ClosestMatch(
        drug_name=row["drug_name"],
        reg_number=row["reg_number"],
        manufacturer=row.get("manufacturer")
    )

@router.post("/verify", response_model=VerifyResponse)
async def verify(request: VerifyRequest):
    query = request.query

    # Step 1: exact match
    hit = db.exact_match(query)
    if hit:
        return VerifyResponse(status="VERIFIED", drug=_to_drug_record(hit))

    # Step 2: FTS5 search
    results = db.fts_search(query, limit=5)

    if not results:
        summary = await claude_client.not_found_summary(query, [])
        return VerifyResponse(
            status="NOT_FOUND",
            closest_matches=[],
            summary=summary or _NOT_FOUND_FALLBACK
        )

    if len(results) == 1:
        closest = [_to_closest(results[0])]
        summary = await claude_client.not_found_summary(query, closest)
        return VerifyResponse(
            status="NOT_FOUND",
            closest_matches=closest,
            summary=summary or _NOT_FOUND_FALLBACK
        )

    # Multiple results — check dominance
    top_rank = abs(results[0]["fts_rank"])
    second_rank = abs(results[1]["fts_rank"])

    candidates = [_to_drug_record(r) for r in results]

    if second_rank > 0 and top_rank / second_rank >= _DOMINANCE_RATIO:
        summary = await claude_client.single_best_match_summary(query, candidates[0])
    else:
        summary = await claude_client.multiple_matches_summary(query, candidates)

    return VerifyResponse(
        status="MULTIPLE_MATCHES",
        candidates=candidates,
        summary=summary
    )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_verify.py -v
```
Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routers/verify.py backend/tests/test_verify.py
git commit -m "feat: POST /verify endpoint — exact match, FTS5 pipeline, Claude summaries"
```

---

### Task 7: GET /search Endpoint

**Files:**
- Create: `backend/routers/search.py`
- Create: `backend/tests/test_search.py`

**Interfaces:**
- Consumes: `db.prefix_search`
- Produces: `router` (APIRouter) mounted at `/search`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_search.py`:
```python
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from fastapi.testclient import TestClient
from fastapi import FastAPI
from routers.search import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)

def test_search_returns_suggestions(test_db):
    resp = client.get("/search?q=amox")
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    assert len(data["results"]) >= 1
    assert "drug_name" in data["results"][0]
    assert "reg_number" in data["results"][0]

def test_search_max_5_results(test_db):
    resp = client.get("/search?q=a")
    assert resp.status_code == 200
    assert len(resp.json()["results"]) <= 5

def test_search_no_match_returns_empty(test_db):
    resp = client.get("/search?q=zzznomatch")
    assert resp.status_code == 200
    assert resp.json()["results"] == []

def test_search_missing_query_returns_422(test_db):
    resp = client.get("/search")
    assert resp.status_code == 422
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd backend && python -m pytest tests/test_search.py -v
```
Expected: `ModuleNotFoundError: No module named 'routers.search'`

- [ ] **Step 3: Create backend/routers/search.py**

```python
from fastapi import APIRouter, Query
from models import SearchResponse, SearchResult
import db

router = APIRouter()

@router.get("/search", response_model=SearchResponse)
def search(q: str = Query(..., min_length=1)):
    rows = db.prefix_search(q, limit=5)
    return SearchResponse(
        results=[SearchResult(drug_name=r["drug_name"], reg_number=r["reg_number"]) for r in rows]
    )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_search.py -v
```
Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routers/search.py backend/tests/test_search.py
git commit -m "feat: GET /search typeahead endpoint with FTS5 prefix search"
```

---

### Task 8: FastAPI App + CORS + Health Endpoint

**Files:**
- Create: `backend/routers/health.py`
- Create: `backend/tests/test_health.py`
- Create: `backend/main.py`

**Interfaces:**
- Consumes: all three routers, `db.get_meta`
- Produces: runnable FastAPI app

- [ ] **Step 1: Write the failing health tests**

Create `backend/tests/test_health.py`:
```python
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from fastapi.testclient import TestClient
from fastapi import FastAPI
from routers.health import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)

def test_health_returns_ok(test_db):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["scrape_date"] == "2026-08-06"
    assert data["drug_count"] == 3
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && python -m pytest tests/test_health.py -v
```
Expected: `ModuleNotFoundError: No module named 'routers.health'`

- [ ] **Step 3: Create backend/routers/health.py**

```python
from fastapi import APIRouter
from models import HealthResponse
import db

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
def health():
    meta = db.get_meta()
    return HealthResponse(
        status="ok",
        scrape_date=meta["scrape_date"],
        drug_count=meta["drug_count"]
    )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_health.py -v
```
Expected: 1 test PASS

- [ ] **Step 5: Create backend/main.py**

```python
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import verify, search, health

app = FastAPI(title="NAFDAC Drug Verifier API")

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    os.getenv("FRONTEND_URL", ""),   # set to Vercel URL after deploy
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(verify.router)
app.include_router(search.router)
app.include_router(health.router)
```

- [ ] **Step 6: Run all backend tests together**

```bash
cd backend && python -m pytest tests/ -v
```
Expected: all tests PASS (no failures)

- [ ] **Step 7: Smoke test the running server**

```bash
cd backend && DB_PATH=../data/drugs.db uvicorn main:app --reload
```
In another terminal:
```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/verify -H "Content-Type: application/json" -d '{"query":"amoxicillin"}'
curl "http://localhost:8000/search?q=amox"
```
Each should return valid JSON matching the spec shapes. Ctrl-C the server.

- [ ] **Step 8: Commit**

```bash
git add backend/routers/health.py backend/tests/test_health.py backend/main.py
git commit -m "feat: FastAPI app with CORS, all three routers mounted, full backend working"
```

---

### Task 9: Frontend Scaffold + API Client

**Files:**
- Modify: `frontend/src/index.css` (replace with CSS tokens + global resets)
- Create: `frontend/src/api.js`
- Modify: `frontend/index.html` (set page title)
- Modify: `frontend/vite.config.js` (add proxy for local dev)

- [ ] **Step 1: Replace frontend/src/index.css**

Delete the Vite default styles and replace entirely:

```css
:root {
  --green: #008751;
  --red: #CC0000;
  --amber: #B45309;
  --bg: #ffffff;
  --surface: #f9fafb;
  --text-primary: #111827;
  --text-muted: #6b7280;
  --border: #e5e7eb;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text-primary);
  min-height: 100dvh;
  -webkit-font-smoothing: antialiased;
}

button {
  cursor: pointer;
  font-family: inherit;
  border: none;
  background: none;
}

input {
  font-family: inherit;
}
```

- [ ] **Step 2: Update frontend/index.html title**

Change `<title>Vite + React</title>` to `<title>NAFDAC Drug Verifier</title>`.

- [ ] **Step 3: Update frontend/vite.config.js for local dev proxy**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/verify': 'http://localhost:8000',
      '/search': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    }
  }
})
```

- [ ] **Step 4: Create frontend/src/api.js**

```js
const API_BASE = import.meta.env.VITE_API_URL ?? ''
const TIMEOUT_MS = 8000

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return resp
  } catch (err) {
    clearTimeout(id)
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out. Check your network and try again.')
    }
    throw err
  }
}

export async function verifyDrug(query) {
  const resp = await fetchWithTimeout(`${API_BASE}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!resp.ok) throw new Error('Service temporarily unavailable.')
  return resp.json()
}

export async function searchDrugs(q) {
  const resp = await fetchWithTimeout(`${API_BASE}/search?q=${encodeURIComponent(q)}`)
  if (!resp.ok) return { results: [] }
  return resp.json()
}

export async function fetchHealth() {
  const resp = await fetchWithTimeout(`${API_BASE}/health`)
  if (!resp.ok) return null
  return resp.json()
}
```

- [ ] **Step 5: Verify the frontend still starts**

```bash
cd frontend && npm run dev
```
Open `http://localhost:5173`. Should show default React page (we haven't replaced App.jsx yet). No console errors. Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/index.css frontend/src/api.js frontend/index.html frontend/vite.config.js
git commit -m "feat: frontend CSS tokens, API client with 8s timeout, Vite dev proxy"
```

---

### Task 10: Search Components

**Files:**
- Create: `frontend/src/components/SearchInput.jsx`
- Create: `frontend/src/components/TypeaheadDropdown.jsx`

**Interfaces:**
- `SearchInput` props: `onVerify(query: string): void`, `loading: boolean`
- `TypeaheadDropdown` props: `results: [{drug_name, reg_number}]`, `onSelect(drug_name: string): void`, `visible: boolean`

- [ ] **Step 1: Create frontend/src/components/TypeaheadDropdown.jsx**

```jsx
export default function TypeaheadDropdown({ results, onSelect, visible }) {
  if (!visible || results.length === 0) return null

  return (
    <ul style={{
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      zIndex: 10,
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderTop: 'none',
      borderRadius: '0 0 var(--radius) var(--radius)',
      maxHeight: 240,
      overflowY: 'auto',
      listStyle: 'none',
      boxShadow: 'var(--shadow)',
    }}>
      {results.map((r) => (
        <li key={r.reg_number}>
          <button
            type="button"
            onClick={() => onSelect(r.drug_name)}
            style={{
              width: '100%',
              padding: '12px 16px',
              textAlign: 'left',
              minHeight: 48,
              borderBottom: '1px solid var(--border)',
              background: 'none',
              fontSize: '0.95rem',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <span style={{ fontWeight: 500 }}>{r.drug_name}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.8rem' }}>
              {r.reg_number}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: Create frontend/src/components/SearchInput.jsx**

```jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { searchDrugs } from '../api'
import TypeaheadDropdown from './TypeaheadDropdown'

const DEBOUNCE_MS = 300
const MIN_CHARS = 3

export default function SearchInput({ onVerify, loading }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef(null)
  const wrapperRef = useRef(null)

  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < MIN_CHARS) { setSuggestions([]); return }
    const data = await searchDrugs(q)
    setSuggestions(data.results ?? [])
    setShowSuggestions(true)
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(query), DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [query, fetchSuggestions])

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(name) {
    setQuery(name)
    setShowSuggestions(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!query.trim()) return
    setShowSuggestions(false)
    onVerify(query.trim())
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <div ref={wrapperRef} style={{ position: 'relative', display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Drug name or NAFDAC reg. number"
            autoComplete="off"
            style={{
              width: '100%',
              height: 52,
              padding: '0 16px',
              fontSize: '1rem',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius)',
              outline: 'none',
            }}
          />
          <TypeaheadDropdown
            results={suggestions}
            onSelect={handleSelect}
            visible={showSuggestions}
          />
        </div>
        <button
          type="submit"
          disabled={!query.trim() || loading}
          style={{
            height: 52,
            padding: '0 24px',
            background: 'var(--green)',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 600,
            borderRadius: 'var(--radius)',
            opacity: (!query.trim() || loading) ? 0.6 : 1,
            whiteSpace: 'nowrap',
            minWidth: 90,
          }}
        >
          {loading ? '...' : 'Verify'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Smoke test these components in isolation**

Temporarily in `frontend/src/App.jsx`, render only `<SearchInput onVerify={console.log} loading={false} />`. Run `npm run dev` and confirm the input renders, typeahead fires after 3 chars (with the backend running), and the Verify button is disabled when empty.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SearchInput.jsx frontend/src/components/TypeaheadDropdown.jsx
git commit -m "feat: SearchInput with debounced typeahead and TypeaheadDropdown"
```

---

### Task 11: Result Card Components

**Files:**
- Create: `frontend/src/components/VerifiedCard.jsx`
- Create: `frontend/src/components/NotFoundCard.jsx`
- Create: `frontend/src/components/MultipleMatchesCard.jsx`
- Create: `frontend/src/components/ResultCard.jsx`

**Interfaces:**
- `VerifiedCard` props: `drug: DrugRecord`
- `NotFoundCard` props: `summary: string | null`, `closestMatches: ClosestMatch[]`
- `MultipleMatchesCard` props: `candidates: DrugRecord[]`, `summary: string | null`
- `ResultCard` props: `result: VerifyResponse` — routes to the correct card

- [ ] **Step 1: Create frontend/src/components/VerifiedCard.jsx**

```jsx
function Field({ label, value }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}

export default function VerifiedCard({ drug }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--green)', color: '#fff', padding: '16px 20px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', opacity: 0.9 }}>✓ VERIFIED</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 4 }}>{drug.drug_name}</div>
      </div>
      <div style={{ padding: '0 20px' }}>
        <Field label="Manufacturer" value={drug.manufacturer} />
        <Field label="Reg. Number" value={drug.reg_number} />
        <Field label="Dosage Form" value={drug.dosage_form} />
        <Field label="Category" value={drug.therapeutic_category} />
        <Field label="Country" value={drug.country_of_origin} />
        <Field label="Approved" value={drug.approval_date} />
        {drug.generic_name && <Field label="Generic Name" value={drug.generic_name} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create frontend/src/components/NotFoundCard.jsx**

```jsx
const FALLBACK = "Do not dispense. Contact NAFDAC: +234 (0) 700-1-623322"

export default function NotFoundCard({ summary, closestMatches }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--red)', color: '#fff', padding: '16px 20px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', opacity: 0.9 }}>✕ NOT FOUND — POSSIBLE COUNTERFEIT</div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        <p style={{ lineHeight: 1.6, marginBottom: closestMatches?.length ? 16 : 0 }}>
          {summary || FALLBACK}
        </p>
        {closestMatches?.length > 0 && (
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Closest matches in registry
            </p>
            <ul style={{ listStyle: 'none' }}>
              {closestMatches.map((m) => (
                <li key={m.reg_number} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                  {m.drug_name}
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{m.reg_number}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create frontend/src/components/MultipleMatchesCard.jsx**

```jsx
import { useState } from 'react'
import VerifiedCard from './VerifiedCard'

export default function MultipleMatchesCard({ candidates, summary }) {
  const [selected, setSelected] = useState(null)

  if (selected !== null) {
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          style={{ marginBottom: 12, color: 'var(--green)', fontWeight: 600, fontSize: '0.9rem', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ← Back to matches
        </button>
        <VerifiedCard drug={candidates[selected]} />
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--amber)', color: '#fff', padding: '16px 20px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', opacity: 0.9 }}>⚠ MULTIPLE MATCHES</div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {summary && <p style={{ lineHeight: 1.6, marginBottom: 16 }}>{summary}</p>}
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Select the correct product
        </p>
        <ul style={{ listStyle: 'none' }}>
          {candidates.map((c, i) => (
            <li key={c.reg_number}>
              <button
                onClick={() => setSelected(i)}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)',
                  background: 'none',
                  minHeight: 48,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span style={{ fontWeight: 500 }}>› {c.drug_name}</span>
                {c.manufacturer && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.manufacturer}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create frontend/src/components/ResultCard.jsx**

```jsx
import VerifiedCard from './VerifiedCard'
import NotFoundCard from './NotFoundCard'
import MultipleMatchesCard from './MultipleMatchesCard'

export default function ResultCard({ result }) {
  if (!result) return null

  if (result.status === 'VERIFIED') {
    return <VerifiedCard drug={result.drug} />
  }
  if (result.status === 'NOT_FOUND') {
    return <NotFoundCard summary={result.summary} closestMatches={result.closest_matches} />
  }
  if (result.status === 'MULTIPLE_MATCHES') {
    return <MultipleMatchesCard candidates={result.candidates} summary={result.summary} />
  }
  return null
}
```

- [ ] **Step 5: Manually test all three card states**

In `App.jsx`, render each card with hardcoded mock data:
```jsx
// VERIFIED
<ResultCard result={{ status: 'VERIFIED', drug: { drug_name: 'Amoxicillin 250mg', reg_number: 'A4-0082', manufacturer: 'Emzor Pharma', dosage_form: 'Capsule', therapeutic_category: 'Antibiotic', approval_date: '2019-03-14' } }} />

// NOT_FOUND
<ResultCard result={{ status: 'NOT_FOUND', summary: 'Drug not found. Do not dispense.', closest_matches: [{ drug_name: 'Amoxicillin 500mg', reg_number: 'A4-0083', manufacturer: 'May and Baker' }] }} />

// MULTIPLE_MATCHES
<ResultCard result={{ status: 'MULTIPLE_MATCHES', summary: 'Multiple matches found.', candidates: [{ drug_name: 'Amox 250mg', reg_number: 'A4-0082', manufacturer: 'Emzor' }, { drug_name: 'Amox 500mg', reg_number: 'A4-0083', manufacturer: 'May and Baker' }] }} />
```

Run `npm run dev` and verify each renders correctly, MULTIPLE_MATCHES tap-to-expand works, all tap targets are ≥48px.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/VerifiedCard.jsx frontend/src/components/NotFoundCard.jsx frontend/src/components/MultipleMatchesCard.jsx frontend/src/components/ResultCard.jsx
git commit -m "feat: result card components for all three verification states"
```

---

### Task 12: Shell Components

**Files:**
- Create: `frontend/src/components/Header.jsx`
- Create: `frontend/src/components/AboutPanel.jsx`
- Create: `frontend/src/components/Footer.jsx`

**Interfaces:**
- `Header` props: `onInfoClick(): void`
- `AboutPanel` props: `visible: boolean`, `onClose(): void`, `scrapeDate: string | null`
- `Footer` props: `scrapeDate: string | null`

- [ ] **Step 1: Create frontend/src/components/Header.jsx**

```jsx
export default function Header({ onInfoClick }) {
  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--green)' }}>NAFDAC</span>
        <span style={{ fontWeight: 400, fontSize: '1.1rem', color: 'var(--text-primary)' }}> Drug Verifier</span>
      </div>
      <button
        onClick={onInfoClick}
        aria-label="About this tool"
        style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: 'var(--text-muted)' }}
      >
        ℹ
      </button>
    </header>
  )
}
```

- [ ] **Step 2: Create frontend/src/components/AboutPanel.jsx**

```jsx
export default function AboutPanel({ visible, onClose, scrapeDate }) {
  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg)', width: '100%', maxWidth: 360, padding: 24, margin: '60px 0 0 0', borderRadius: '12px 0 0 12px', boxShadow: 'var(--shadow)' }}
      >
        <button onClick={onClose} style={{ float: 'right', fontSize: '1.2rem', color: 'var(--text-muted)' }}>✕</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>About</h2>
        <p style={{ lineHeight: 1.7, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
          NAFDAC (National Agency for Food and Drug Administration and Control) is the Nigerian federal agency responsible for regulating and controlling the manufacture, importation, and distribution of drugs. This tool lets pharmacists instantly verify whether a product is in the NAFDAC registry by name or registration number. Data is sourced from the public NAFDAC Greenbook.
          {scrapeDate && <> Database last updated: <strong>{scrapeDate}</strong>.</>}
        </p>
        <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Questions? Contact NAFDAC: +234 (0) 700-1-623322
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create frontend/src/components/Footer.jsx**

```jsx
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

export default function Footer({ scrapeDate }) {
  const isStale = scrapeDate
    ? Date.now() - new Date(scrapeDate).getTime() > NINETY_DAYS_MS
    : false

  return (
    <footer style={{ padding: '16px 20px', textAlign: 'center' }}>
      {scrapeDate && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          DB last updated: {scrapeDate}
        </p>
      )}
      {isStale && (
        <p style={{ fontSize: '0.75rem', color: 'var(--amber)', marginTop: 4 }}>
          ⚠ Data may be outdated — verify with NAFDAC directly
        </p>
      )}
    </footer>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Header.jsx frontend/src/components/AboutPanel.jsx frontend/src/components/Footer.jsx
git commit -m "feat: Header, AboutPanel, and Footer shell components"
```

---

### Task 13: App.jsx — Wire Everything

**Files:**
- Modify: `frontend/src/App.jsx` (replace Vite default entirely)
- Modify: `frontend/src/main.jsx` (remove default Vite styles import, keep only index.css)

**Interfaces:**
- Consumes: all components, `api.js`
- Produces: working end-to-end SPA

- [ ] **Step 1: Replace frontend/src/App.jsx**

```jsx
import { useState, useEffect } from 'react'
import Header from './components/Header'
import AboutPanel from './components/AboutPanel'
import SearchInput from './components/SearchInput'
import ResultCard from './components/ResultCard'
import Footer from './components/Footer'
import { verifyDrug, fetchHealth } from './api'

export default function App() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showAbout, setShowAbout] = useState(false)
  const [scrapeDate, setScrapeDate] = useState(null)

  useEffect(() => {
    fetchHealth().then((data) => {
      if (data?.scrape_date) setScrapeDate(data.scrape_date)
    })
  }, [])

  async function handleVerify(query) {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await verifyDrug(query)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Header onInfoClick={() => setShowAbout(true)} />
      <AboutPanel visible={showAbout} onClose={() => setShowAbout(false)} scrapeDate={scrapeDate} />

      <main style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SearchInput onVerify={handleVerify} loading={loading} />

        {loading && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Checking registry…</p>
        )}

        {error && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', padding: '14px 16px', color: '#991b1b', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {result && !loading && <ResultCard result={result} />}
      </main>

      <Footer scrapeDate={scrapeDate} />
    </div>
  )
}
```

- [ ] **Step 2: Fix frontend/src/main.jsx**

Remove any Vite default CSS imports. It should look like:
```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 3: End-to-end manual walkthrough**

Start the backend:
```bash
cd backend && DB_PATH=../data/drugs.db ANTHROPIC_API_KEY=<your-key> uvicorn main:app --reload
```

Start the frontend:
```bash
cd frontend && npm run dev
```

Open `http://localhost:5173` on desktop and on a mobile device (or Chrome DevTools mobile emulator). Test:

1. Type a known drug name (e.g., "Amoxicillin") → typeahead fires → select a suggestion → hit Verify → VERIFIED card renders with correct data
2. Type a partial name that doesn't exact-match → MULTIPLE_MATCHES → tap a row → VERIFIED card expands inline
3. Type complete nonsense → NOT_FOUND → Claude summary renders (or fallback if API key missing)
4. Type a valid reg number (e.g., "A4-0082") → VERIFIED card
5. Hit Verify with empty input → button stays disabled (can't submit)
6. Click ℹ → About panel opens → click outside to close
7. Check footer shows scrape date
8. Resize to 375px width — all tap targets comfortable, no horizontal scroll

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx frontend/src/main.jsx
git commit -m "feat: App.jsx wired — full end-to-end verification flow working"
```

---

### Task 14: Railway Backend Deployment

**Files:**
- Create: `railway.toml`
- Modify: `backend/main.py` (add `FRONTEND_URL` env var to CORS)

- [ ] **Step 1: Create railway.toml**

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 30

[[services]]
name = "nafdac-api"
```

- [ ] **Step 2: Deploy to Railway**

1. Push the repo to GitHub
2. Go to railway.app → New Project → Deploy from GitHub repo
3. Select the `backend/` directory as root (or set `root = "backend"` in railway.toml)
4. Add environment variables in Railway dashboard:
   - `ANTHROPIC_API_KEY` = your Anthropic API key
   - `DB_PATH` = `../data/drugs.db` (verify path relative to backend start command)
5. Wait for deployment — check `/health` endpoint on the Railway URL

- [ ] **Step 3: Set up keep-alive cron in Railway**

In Railway project settings → Cron Jobs → New Cron:
- Schedule: `*/10 * * * *` (every 10 minutes)
- Command: `curl https://<your-railway-url>.railway.app/health`

- [ ] **Step 4: Verify CORS settings**

You don't yet have the Vercel URL — leave `FRONTEND_URL` blank for now. Localhost will still work. Come back to this after Task 15.

- [ ] **Step 5: Smoke test production backend**

```bash
curl https://<your-railway-url>.railway.app/health
curl -X POST https://<your-railway-url>.railway.app/verify \
  -H "Content-Type: application/json" \
  -d '{"query": "amoxicillin"}'
```
Expect valid JSON responses with correct shapes.

- [ ] **Step 6: Commit**

```bash
git add railway.toml
git commit -m "chore: Railway deployment config"
```

---

### Task 15: Vercel Frontend Deployment

**Files:**
- Create: `frontend/.env.production`
- Modify: `backend/main.py` — update `FRONTEND_URL` in Railway dashboard after Vercel deploy

- [ ] **Step 1: Create frontend/.env.production**

```
VITE_API_URL=https://<your-railway-url>.railway.app
```

Replace `<your-railway-url>` with the actual Railway URL from Task 14.

Add `.env.production` to `.gitignore` — this file should not be committed (it contains a URL that will change per environment).

Wait — actually for Vite, `.env.production` is safe to commit since it contains no secrets, only the API URL. Leave it committed. The ANTHROPIC_API_KEY is only ever in Railway.

- [ ] **Step 2: Deploy to Vercel**

```bash
cd frontend && npm run build
```
Confirm the `dist/` folder is produced with no build errors.

Then:
1. Go to vercel.com → New Project → Import from GitHub
2. Set root directory to `frontend/`
3. Framework preset: Vite
4. Build command: `npm run build`
5. Output directory: `dist`
6. Add environment variable: `VITE_API_URL` = `https://<your-railway-url>.railway.app`
7. Deploy

- [ ] **Step 3: Update CORS in Railway**

Go to Railway → your project → environment variables → add:
- `FRONTEND_URL` = `https://<your-vercel-app>.vercel.app`

Trigger a redeploy.

- [ ] **Step 4: Final smoke test on production**

Open `https://<your-vercel-app>.vercel.app` on your phone. Run the full walkthrough:

1. Search for a drug by name → VERIFIED renders
2. Search for a reg number → VERIFIED renders
3. Search for partial name → MULTIPLE_MATCHES → tap row → expands
4. Search for nonsense → NOT_FOUND → Claude summary visible
5. Info panel opens and closes
6. Footer shows scrape date
7. No CORS errors in browser console

- [ ] **Step 5: Commit**

```bash
git add frontend/.env.production
git commit -m "chore: Vercel deployment config + production API URL"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Python scraper → SQLite | Task 3 |
| SQLite FTS5 schema | Task 2 |
| POST /verify — exact match | Task 6 |
| POST /verify — FTS5 pipeline | Task 6 |
| POST /verify — dominance rule (≥2×) | Task 6 |
| POST /verify — single candidate → NOT_FOUND | Task 6 |
| Claude only on NOT_FOUND + MULTIPLE_MATCHES | Task 5, 6 |
| Claude graceful degradation | Task 5, 6 |
| NOT_FOUND fallback copy | Task 6, 11 |
| GET /search — prefix FTS5 | Task 7 |
| GET /health | Task 8 |
| CORS whitelist | Task 8, 14 |
| Typeahead ≥3 chars, 5 results, 300ms debounce | Task 10 |
| VERIFIED card — full data grid | Task 11 |
| NOT_FOUND card — red badge + summary + closest | Task 11 |
| MULTIPLE_MATCHES — local selection, no second API call | Task 11 |
| Header + info icon | Task 12 |
| About panel — collapsible | Task 12 |
| Footer — scrape date always | Task 12 |
| Footer — staleness warning >90 days | Task 12 |
| 48px tap targets | Tasks 10, 11, 12 |
| System font stack | Task 9 (index.css) |
| 8s timeout | Task 9 (api.js) |
| NAFDAC hotline +234 (0) 700-1-623322 | Tasks 6, 11, 12 |
| Railway keep-alive cron | Task 14 |
| DB_PATH env var | Task 2 (db.py) |

All spec requirements covered. No gaps found.
