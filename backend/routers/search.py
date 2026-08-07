from fastapi import APIRouter, Query
from models import SearchResponse, SearchResult
import db

router = APIRouter()

@router.get("/search", response_model=SearchResponse)
def search(q: str = Query(..., min_length=1)):
    rows = db.prefix_search(q, limit=5)
    return SearchResponse(
        results=[SearchResult(drug_name=r["drug_name"], reg_number=r["reg_number"]) for r in rows]
    )
