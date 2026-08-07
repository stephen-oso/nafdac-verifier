import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from unittest.mock import AsyncMock, MagicMock, patch
from models import ClosestMatch, DrugRecord

@pytest.fixture
def mock_anthropic(monkeypatch):
    mock_msg = MagicMock()
    mock_msg.content = [MagicMock(text="Test summary response.")]
    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock(return_value=mock_msg)
    monkeypatch.setattr("claude_client._client", mock_client)
    return mock_client

@pytest.mark.asyncio
async def test_not_found_summary_returns_string(mock_anthropic):
    import claude_client
    closest = [ClosestMatch(drug_name="Amox 500mg", reg_number="A4-0083", manufacturer="May and Baker")]
    result = await claude_client.not_found_summary("amoxicilin", closest)
    assert isinstance(result, str)
    assert len(result) > 0

@pytest.mark.asyncio
async def test_not_found_summary_no_closest(mock_anthropic):
    import claude_client
    result = await claude_client.not_found_summary("fakename", [])
    assert isinstance(result, str)

@pytest.mark.asyncio
async def test_not_found_summary_returns_none_on_exception(monkeypatch):
    import claude_client
    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock(side_effect=Exception("API down"))
    monkeypatch.setattr("claude_client._client", mock_client)
    result = await claude_client.not_found_summary("x", [])
    assert result is None

@pytest.mark.asyncio
async def test_single_best_match_returns_string(mock_anthropic):
    import claude_client
    best = DrugRecord(drug_name="Amoxicillin 500mg", reg_number="A4-0083", manufacturer="May and Baker")
    result = await claude_client.single_best_match_summary("amoxicilin", best)
    assert isinstance(result, str)

@pytest.mark.asyncio
async def test_multiple_matches_returns_string(mock_anthropic):
    import claude_client
    candidates = [
        DrugRecord(drug_name="Amoxicillin 250mg", reg_number="A4-0082"),
        DrugRecord(drug_name="Amoxicillin 500mg", reg_number="A4-0083"),
    ]
    result = await claude_client.multiple_matches_summary("amoxicillin", candidates)
    assert isinstance(result, str)
