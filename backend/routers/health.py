from fastapi import APIRouter
from models import HealthResponse
import db

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
def health():
    meta = db.get_meta()
    return HealthResponse(
        status="ok",
        scrape_date=meta["scrape_date"],
        drug_count=meta["drug_count"]
    )
