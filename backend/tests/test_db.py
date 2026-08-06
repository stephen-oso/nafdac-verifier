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
