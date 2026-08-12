import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import sqlite3
import db

def test_init_reports_table_creates_table(test_db):
    db.init_reports_table()
    conn = sqlite3.connect(test_db)
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    conn.close()
    assert "reports" in tables

def test_insert_report_returns_id(test_db):
    db.init_reports_table()
    data = {
        "drug_query": "Paracetamol 500mg",
        "closest_match": None,
        "manufacturer": None,
        "batch_number": None,
        "expiry_date": None,
        "observation": None,
        "location": None,
    }
    report_id = db.insert_report(data)
    assert isinstance(report_id, int)
    assert report_id >= 1

def test_insert_report_persists_data(test_db):
    db.init_reports_table()
    data = {
        "drug_query": "Fake Amox",
        "closest_match": "Amoxicillin 500mg — Emzor — A4-0083",
        "manufacturer": "Unknown",
        "batch_number": "BN001",
        "expiry_date": "01/25",
        "observation": "Blurry print",
        "location": "Lagos",
    }
    report_id = db.insert_report(data)
    conn = sqlite3.connect(test_db)
    row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
    conn.close()
    assert row is not None
    assert row[1] == "Fake Amox"   # drug_query
    assert row[7] == "Lagos"       # location

def test_insert_report_increments_id(test_db):
    db.init_reports_table()
    base = {"drug_query": "DrugA", "closest_match": None, "manufacturer": None,
            "batch_number": None, "expiry_date": None, "observation": None, "location": None}
    id1 = db.insert_report(base)
    id2 = db.insert_report({**base, "drug_query": "DrugB"})
    assert id2 == id1 + 1
