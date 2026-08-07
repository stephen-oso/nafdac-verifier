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
