import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from unittest.mock import patch, MagicMock
import email_client

SAMPLE_DATA = {
    "drug_query": "Amoxicillin 500mg",
    "closest_match": "Amoxicillin 500mg Capsules — Emzor — A4-0083",
    "manufacturer": "Unknown",
    "batch_number": "BN2024/0041",
    "expiry_date": "09/2025",
    "observation": "Blurry print and unusual smell",
    "location": "Lagos Island",
}

def test_send_sf_alert_returns_true_on_success(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.setenv("NAFDAC_REPORT_EMAIL", "sf.alert@nafdac.gov.ng")
    monkeypatch.setenv("FROM_EMAIL", "test@example.com")
    with patch("resend.Emails.send", return_value={"id": "abc123"}) as mock_send:
        result = email_client.send_sf_alert(1, SAMPLE_DATA, "SF-2026-0001")
    assert result is True
    mock_send.assert_called_once()

def test_send_sf_alert_subject_contains_drug_and_ref(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.setenv("NAFDAC_REPORT_EMAIL", "sf.alert@nafdac.gov.ng")
    monkeypatch.setenv("FROM_EMAIL", "test@example.com")
    with patch("resend.Emails.send") as mock_send:
        email_client.send_sf_alert(1, SAMPLE_DATA, "SF-2026-0001")
    call_kwargs = mock_send.call_args[0][0]
    assert "Amoxicillin 500mg" in call_kwargs["subject"]
    assert "SF-2026-0001" in call_kwargs["subject"]

def test_send_sf_alert_returns_false_when_no_api_key(monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    result = email_client.send_sf_alert(1, SAMPLE_DATA, "SF-2026-0001")
    assert result is False

def test_send_sf_alert_returns_false_on_resend_exception(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.setenv("NAFDAC_REPORT_EMAIL", "sf.alert@nafdac.gov.ng")
    monkeypatch.setenv("FROM_EMAIL", "test@example.com")
    with patch("resend.Emails.send", side_effect=Exception("network error")):
        result = email_client.send_sf_alert(1, SAMPLE_DATA, "SF-2026-0001")
    assert result is False
