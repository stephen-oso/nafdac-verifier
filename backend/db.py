import sqlite3
import re
import os
from contextlib import contextmanager

_REG_PATTERN = re.compile(r'^[A-Z0-9]+-\d+$', re.IGNORECASE)

def _fts_escape(q: str) -> str:
    """Wrap query in double-quotes and escape internal quotes for FTS5 MATCH."""
    return '"' + q.replace('"', '""') + '"'

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
            (_fts_escape(query), limit)
        ).fetchall()
    return [dict(r) for r in rows]

def prefix_search(query: str, limit: int = 5) -> list[dict]:
    fts_query = _fts_escape(query) + " *"
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
