from datetime import datetime, timezone, timedelta
from fastapi import APIRouter
from models import ReportRequest, ReportResponse
import db
import email_client

router = APIRouter()

_WAT = timezone(timedelta(hours=1))


def _make_ref(report_id: int) -> str:
    year = datetime.now(_WAT).year
    return f"SF-{year}-{report_id:04d}"


@router.post("/report", response_model=ReportResponse)
async def report(request: ReportRequest):
    data = request.model_dump()
    report_id = db.insert_report(data)
    ref = _make_ref(report_id)
    try:
        email_client.send_sf_alert(report_id, data, ref)
    except Exception:
        pass
    return ReportResponse(status="received", ref=ref)
