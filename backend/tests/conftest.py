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
CREATE TABLE reports (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    drug_query    TEXT NOT NULL,
    closest_match TEXT,
    manufacturer  TEXT,
    batch_number  TEXT,
    expiry_date   TEXT,
    observation   TEXT,
    location      TEXT,
    created_at    TEXT NOT NULL
);
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
