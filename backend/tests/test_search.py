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
