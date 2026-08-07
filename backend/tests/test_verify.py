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
