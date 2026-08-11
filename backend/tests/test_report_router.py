import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from unittest.mock import patch, AsyncMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
import db
from routers.report import router

# Minimal app — no lifespan, just the router under test
app = FastAPI()
app.include_router(router)
client = TestClient(app)

def test_report_returns_received(test_db):
    db.init_reports_table()
    with patch("routers.report.email_client.send_sf_alert", return_value=True):
        resp = client.post("/report", json={"drug_query": "Fake Drug 500mg"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "received"
    assert body["ref"].startswith("SF-")

def test_report_ref_format(test_db):
    db.init_reports_table()
    with patch("routers.report.email_client.send_sf_alert", return_value=True):
        resp = client.post("/report", json={"drug_query": "Drug X"})
    ref = resp.json()["ref"]
    parts = ref.split("-")
    assert len(parts) == 3
    assert parts[0] == "SF"
    assert len(parts[2]) == 4  # zero-padded to 4 digits

def test_report_empty_drug_query_returns_422(test_db):
    resp = client.post("/report", json={"drug_query": "  "})
    assert resp.status_code == 422

def test_report_observation_over_280_returns_422(test_db):
    resp = client.post("/report", json={"drug_query": "Drug", "observation": "x" * 281})
    assert resp.status_code == 422

def test_report_succeeds_when_email_fails(test_db):
    db.init_reports_table()
    with patch("routers.report.email_client.send_sf_alert", return_value=False):
        resp = client.post("/report", json={"drug_query": "Drug Y"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "received"

def test_report_all_optional_fields(test_db):
    db.init_reports_table()
    with patch("routers.report.email_client.send_sf_alert", return_value=True):
        resp = client.post("/report", json={
            "drug_query": "Paracetamol 500mg",
            "closest_match": "Paracetamol 500mg — Emzor — P4-001",
            "manufacturer": "Unknown",
            "batch_number": "BN001",
            "expiry_date": "12/25",
            "observation": "Suspicious packaging",
            "location": "Abuja",
        })
    assert resp.status_code == 200

def test_report_succeeds_when_email_raises(test_db):
    db.init_reports_table()
    with patch("routers.report.email_client.send_sf_alert", side_effect=Exception("smtp error")):
        resp = client.post("/report", json={"drug_query": "Drug Z"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "received"
