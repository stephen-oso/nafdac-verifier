import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
from routers.verify import router
import routers.verify as verify_module

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


def _make_fts_row(drug_name, reg_number, rank):
    """Return a dict mimicking an fts_search result row."""
    return {
        "id": 99,
        "drug_name": drug_name,
        "generic_name": None,
        "reg_number": reg_number,
        "manufacturer": "Test Pharma",
        "country_of_origin": "Nigeria",
        "dosage_form": "Tablet",
        "therapeutic_category": "Antibiotic",
        "approval_date": "2020-01-01",
        "fts_rank": rank,
    }


def test_dominance_rule_no_dominant_match_calls_multiple_matches_summary(test_db, monkeypatch):
    """When top/second rank ratio < 2.0, multiple_matches_summary is called (no dominant match)."""
    # abs(-1.0)/abs(-10.0) = 0.1 < 2.0 → no dominance
    fts_rows = [
        _make_fts_row("Drug Alpha 100mg", "X1-0001", -1.0),
        _make_fts_row("Drug Alpha 200mg", "X1-0002", -10.0),
    ]
    monkeypatch.setattr("routers.verify.db.exact_match", lambda q: None)
    monkeypatch.setattr("routers.verify.db.fts_search", lambda q, limit=5: fts_rows)

    multiple_mock = AsyncMock(return_value="Mocked multiple summary.")
    single_mock = AsyncMock(return_value="Should not be called.")
    monkeypatch.setattr("routers.verify.claude_client.multiple_matches_summary", multiple_mock)
    monkeypatch.setattr("routers.verify.claude_client.single_best_match_summary", single_mock)

    resp = client.post("/verify", json={"query": "Drug Alpha"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "MULTIPLE_MATCHES"
    multiple_mock.assert_awaited_once()
    single_mock.assert_not_awaited()


def test_dominance_rule_dominant_match_calls_single_best_match_summary(test_db, monkeypatch):
    """When top/second rank ratio >= 2.0, single_best_match_summary is called (dominant match)."""
    # abs(-10.0)/abs(-2.0) = 5.0 >= 2.0 → dominant
    fts_rows = [
        _make_fts_row("Drug Beta 500mg", "Y1-0001", -10.0),
        _make_fts_row("Drug Beta 50mg",  "Y1-0002", -2.0),
    ]
    monkeypatch.setattr("routers.verify.db.exact_match", lambda q: None)
    monkeypatch.setattr("routers.verify.db.fts_search", lambda q, limit=5: fts_rows)

    single_mock = AsyncMock(return_value="Mocked single best summary.")
    multiple_mock = AsyncMock(return_value="Should not be called.")
    monkeypatch.setattr("routers.verify.claude_client.single_best_match_summary", single_mock)
    monkeypatch.setattr("routers.verify.claude_client.multiple_matches_summary", multiple_mock)

    resp = client.post("/verify", json={"query": "Drug Beta 500mg"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "MULTIPLE_MATCHES"
    single_mock.assert_awaited_once()
    multiple_mock.assert_not_awaited()
