import re
from fastapi import APIRouter
from models import VerifyRequest, VerifyResponse, DrugRecord, ClosestMatch
import db
import claude_client

router = APIRouter()

_REG_PATTERN = re.compile(r'^[A-Z0-9]+-\d+$', re.IGNORECASE)
_DOMINANCE_RATIO = 2.0

# Fallback text is defined here for frontend reference but NOT injected
# by the backend — when Claude returns None, summary is None.
_NOT_FOUND_FALLBACK = (
    "This product was not found in the NAFDAC registry. "
    "Do not dispense. Contact NAFDAC: +234 (0) 700-1-623322"
)


def _to_drug_record(row: dict) -> DrugRecord:
    return DrugRecord(**{k: v for k, v in row.items() if k != "fts_rank"})


def _to_closest(row: dict) -> ClosestMatch:
    return ClosestMatch(
        drug_name=row["drug_name"],
        reg_number=row["reg_number"],
        manufacturer=row.get("manufacturer")
    )


@router.post("/verify", response_model=VerifyResponse)
async def verify(request: VerifyRequest):
    query = request.query

    # Step 1: exact match — no Claude call on VERIFIED path
    hit = db.exact_match(query)
    if hit:
        return VerifyResponse(status="VERIFIED", drug=_to_drug_record(hit))

    # Step 2: FTS5 search
    results = db.fts_search(query, limit=5)

    if not results:
        summary = await claude_client.not_found_summary(query, [])
        return VerifyResponse(
            status="NOT_FOUND",
            closest_matches=[],
            summary=summary
        )

    if len(results) == 1:
        closest = [_to_closest(results[0])]
        summary = await claude_client.not_found_summary(query, closest)
        return VerifyResponse(
            status="NOT_FOUND",
            closest_matches=closest,
            summary=summary
        )

    # Multiple results — check dominance
    top_rank = abs(results[0]["fts_rank"])
    second_rank = abs(results[1]["fts_rank"])

    candidates = [_to_drug_record(r) for r in results]

    if second_rank > 0 and top_rank / second_rank >= _DOMINANCE_RATIO:
        summary = await claude_client.single_best_match_summary(query, candidates[0])
    else:
        summary = await claude_client.multiple_matches_summary(query, candidates)

    return VerifyResponse(
        status="MULTIPLE_MATCHES",
        candidates=candidates,
        summary=summary
    )
