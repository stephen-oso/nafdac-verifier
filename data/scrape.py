#!/usr/bin/env python3
"""
NAFDAC Greenbook Scraper — greenbook.nafdac.gov.ng
Uses DataTables.js server-side API to fetch all 9,000+ drugs.

Strategy:
  1. GET the main page to extract CSRF token and session cookies
  2. Page through the DataTables API in batches of 500
  3. Parse JSON response and insert records into SQLite
  4. Build FTS5 index and record scrape date

Run from the repo root:
  python data/scrape.py
Outputs: data/drugs.db
"""
import sqlite3
import requests
import urllib.parse
import time
import os
import re
import sys
from datetime import date
from bs4 import BeautifulSoup

BASE_URL = "https://greenbook.nafdac.gov.ng"
BATCH_SIZE = 500
CRAWL_DELAY = 0.5
REQUEST_TIMEOUT = 20
MAX_RETRIES = 3

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
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
"""

SCHEMA_FTS = """
CREATE VIRTUAL TABLE IF NOT EXISTS drugs_fts USING fts5(
    drug_name, generic_name, manufacturer,
    content='drugs', content_rowid='id'
);
"""


def get_csrf_and_cookies() -> tuple[str, str]:
    """Fetch main page to extract CSRF token and session cookies."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    }
    try:
        resp = requests.get(BASE_URL, headers=headers, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()

        # Extract CSRF token from <meta name="csrf-token" content="...">
        soup = BeautifulSoup(resp.text, 'html.parser')
        csrf_meta = soup.find('meta', attrs={'name': 'csrf-token'})
        csrf_token = csrf_meta.get('content', '') if csrf_meta else ''

        # Extract session cookies from response headers
        cookies_dict = resp.cookies.get_dict()
        cookie_str = '; '.join([f'{k}={v}' for k, v in cookies_dict.items()])

        return csrf_token, cookie_str
    except Exception as e:
        print(f"ERROR fetching CSRF/cookies: {e}", file=sys.stderr)
        sys.exit(1)


def fetch_batch(start: int, length: int, csrf_token: str, cookies: str) -> dict | None:
    """Fetch a single batch from DataTables API."""
    # Build query params matching the DataTables format
    params = {
        'draw': 1,
        'start': start,
        'length': length,
        'search[value]': '',
        'columns[0][data]': 'product_name',
        'columns[0][name]': 'product_name',
        'columns[1][data]': 'ingredient.ingredient_name',
        'columns[1][name]': 'ingredient.ingredient_name',
        'columns[2][data]': 'product_category.name',
        'columns[2][name]': 'product_category.name',
        'columns[3][data]': 'product_category_id',
        'columns[3][name]': 'product_category_id',
        'columns[4][data]': 'ingredient.synonym',
        'columns[4][name]': 'ingredient.synonym',
        'columns[5][data]': 'NAFDAC',
        'columns[5][name]': 'NAFDAC',
        'columns[6][data]': 'form.name',
        'columns[6][name]': 'form.name',
        'columns[7][data]': 'route.name',
        'columns[7][name]': 'route.name',
        'columns[8][data]': 'strength',
        'columns[8][name]': 'strength',
        'columns[9][data]': 'applicant.name',
        'columns[9][name]': 'applicant.name',
        'columns[10][data]': 'approval_date',
        'columns[10][name]': 'approval_date',
        'columns[11][data]': 'status',
        'columns[11][name]': 'status',
    }

    query_string = urllib.parse.urlencode(params)
    url = f"{BASE_URL}?{query_string}"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*',
        'Referer': BASE_URL,
        'X-CSRF-TOKEN': csrf_token,
        'Cookie': cookies,
    }

    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            if attempt == MAX_RETRIES - 1:
                print(f"ERROR fetching batch at start={start}: {e}", file=sys.stderr)
                return None
            time.sleep(1.0 * (attempt + 1))
    return None


def clean_drug_name(name: str) -> str | None:
    """Remove all # and * characters from drug name."""
    if not name:
        return None
    cleaned = re.sub(r'[#*]', '', name).strip()
    return cleaned if cleaned else None


def parse_record(raw: dict) -> dict | None:
    """Convert API response record to our database schema."""
    # Extract fields from nested structure
    product_name = raw.get('product_name', '').strip()
    reg_number = raw.get('NAFDAC', '').strip()
    approval_date = raw.get('approval_date', '').strip()
    status = raw.get('status', '').strip()

    # Skip if critical fields missing
    if not product_name or not reg_number:
        return None  # pragma: no cover

    # Only include active drugs (if status is present)
    if status and status.lower() != 'active':
        pass  # We'll still include them; status field guides filtering

    # Extract nested fields
    ingredient_name = ''
    if isinstance(raw.get('ingredient'), dict):
        ingredient_name = raw['ingredient'].get('ingredient_name', '').strip()

    form_name = ''
    if isinstance(raw.get('form'), dict):
        form_name = raw['form'].get('name', '').strip()

    applicant_name = ''
    if isinstance(raw.get('applicant'), dict):
        applicant_name = raw['applicant'].get('name', '').strip()

    category_name = ''
    if isinstance(raw.get('product_category'), dict):
        category_name = raw['product_category'].get('name', '').strip()

    clean_name = clean_drug_name(product_name)
    if not clean_name:
        return None  # Skip records where drug_name becomes empty after cleaning

    return {
        'drug_name': clean_name,
        'generic_name': ingredient_name or None,
        'reg_number': reg_number,
        'manufacturer': applicant_name or None,
        'country_of_origin': None,  # Not available in API response
        'dosage_form': form_name or None,
        'therapeutic_category': category_name or None,
        'approval_date': approval_date or None,
    }


def build_fts_index(conn: sqlite3.Connection) -> None:
    """Build FTS5 index from drugs table."""
    print("Building FTS5 index...", flush=True)
    try:
        # Try to drop existing FTS table
        conn.execute("DROP TABLE IF EXISTS drugs_fts")
    except sqlite3.Error:
        pass

    # Create fresh FTS5 table
    try:
        conn.execute(SCHEMA_FTS)
    except sqlite3.Error as e:
        print(f"ERROR creating FTS5 table: {e}", file=sys.stderr)
        conn.commit()
        return

    # Populate FTS5
    try:
        conn.execute(
            """
            INSERT INTO drugs_fts(rowid, drug_name, generic_name, manufacturer)
            SELECT id, drug_name, COALESCE(generic_name, ''), COALESCE(manufacturer, '')
            FROM drugs
            """
        )
    except sqlite3.Error as e:
        print(f"ERROR populating FTS5: {e}", file=sys.stderr)

    conn.commit()


def main():
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "drugs.db")
    print(f"Database: {db_path}")

    # Delete existing database if it exists
    if os.path.exists(db_path):
        print(f"Removing existing database...")
        try:
            os.remove(db_path)
        except Exception as e:
            print(f"WARNING: Could not delete existing database: {e}", file=sys.stderr)

    # Initialize database
    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA)
    conn.commit()

    # Verify table exists and is empty
    count = conn.execute("SELECT COUNT(*) FROM drugs").fetchone()[0]
    print(f"OK: drugs table exists, currently has {count} rows", flush=True)

    # Get CSRF token and cookies
    print("Fetching CSRF token and cookies...", flush=True)
    csrf_token, cookies = get_csrf_and_cookies()
    if not csrf_token:
        print("WARNING: Could not extract CSRF token, proceeding anyway...", file=sys.stderr)

    # Fetch and insert records
    print("\n=== Fetching drug records ===")
    total_inserted = 0
    total_skipped = 0
    batch_num = 0

    while True:
        start = batch_num * BATCH_SIZE
        batch_num += 1
        print(f"Batch {batch_num} (start={start}, length={BATCH_SIZE})...", flush=True)

        response = fetch_batch(start, BATCH_SIZE, csrf_token, cookies)
        if response is None:
            print("ERROR: Failed to fetch batch, stopping", file=sys.stderr)
            break

        data = response.get('data', [])
        if not data:
            print("No more records, stopping", flush=True)
            break

        records_in_batch = 0
        for i, raw_record in enumerate(data):
            record = parse_record(raw_record)
            if record is None:
                total_skipped += 1
                continue

            try:
                cursor = conn.execute(
                    """INSERT OR IGNORE INTO drugs
                       (drug_name, generic_name, reg_number, manufacturer,
                        country_of_origin, dosage_form, therapeutic_category, approval_date)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    (
                        record['drug_name'], record['generic_name'], record['reg_number'],
                        record['manufacturer'], record['country_of_origin'],
                        record['dosage_form'], record['therapeutic_category'],
                        record['approval_date'],
                    )
                )
                changed = conn.execute("SELECT changes()").fetchone()[0]
                if changed > 0:
                    total_inserted += 1
                    records_in_batch += 1
                else:
                    total_skipped += 1
            except sqlite3.Error as e:
                print(f"  [DB ERR] {record.get('reg_number')}: {e}", file=sys.stderr)
                total_skipped += 1

        conn.commit()
        print(f"  +{records_in_batch} inserted ({total_inserted} total, {total_skipped} skipped)", flush=True)

        # Check if we've fetched all records
        records_total = response.get('recordsTotal', 0)
        if start + BATCH_SIZE >= records_total:
            print(f"Reached end of records (total: {records_total})", flush=True)
            break

        time.sleep(CRAWL_DELAY)

    # Build FTS index and record metadata
    build_fts_index(conn)

    conn.execute("INSERT OR REPLACE INTO meta VALUES ('scrape_date', ?)",
                 (date.today().isoformat(),))
    conn.execute("INSERT OR REPLACE INTO meta VALUES ('source', ?)",
                 ("greenbook.nafdac.gov.ng",))
    conn.commit()

    final_count = conn.execute("SELECT COUNT(*) FROM drugs").fetchone()[0]
    conn.close()

    print(f"\n{'='*60}")
    print(f"Done! {total_inserted} drugs inserted, {total_skipped} skipped/duplicate.")
    print(f"Final count in DB: {final_count}")
    print(f"Database: {db_path}")


if __name__ == "__main__":
    main()
