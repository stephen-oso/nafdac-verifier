from pydantic import BaseModel, field_validator
from typing import Optional


class VerifyRequest(BaseModel):
    query: str

    @field_validator("query")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("query cannot be empty")
        return v.strip()


class DrugRecord(BaseModel):
    drug_name: str
    generic_name: Optional[str] = None
    reg_number: str
    manufacturer: Optional[str] = None
    country_of_origin: Optional[str] = None
    dosage_form: Optional[str] = None
    therapeutic_category: Optional[str] = None
    approval_date: Optional[str] = None
    strength: Optional[str] = None
    roa: Optional[str] = None


class ClosestMatch(BaseModel):
    drug_name: str
    reg_number: str
    manufacturer: Optional[str] = None


class VerifyResponse(BaseModel):
    status: str
    drug: Optional[DrugRecord] = None
    closest_matches: Optional[list[ClosestMatch]] = None
    candidates: Optional[list[DrugRecord]] = None
    summary: Optional[str] = None


class SearchResult(BaseModel):
    drug_name: str
    reg_number: str


class SearchResponse(BaseModel):
    results: list[SearchResult]


class HealthResponse(BaseModel):
    status: str
    scrape_date: Optional[str] = None
    drug_count: int


class ReportRequest(BaseModel):
    drug_query: str
    closest_match: Optional[str] = None
    manufacturer: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    observation: Optional[str] = None
    location: Optional[str] = None

    @field_validator("drug_query")
    @classmethod
    def drug_query_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("drug_query cannot be empty")
        return v.strip()

    @field_validator("observation")
    @classmethod
    def observation_max_280(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) > 280:
            raise ValueError("observation cannot exceed 280 characters")
        return v


class ReportResponse(BaseModel):
    status: str
    ref: str
