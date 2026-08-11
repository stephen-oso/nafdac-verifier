import os
import resend as _resend


def send_sf_alert(report_id: int, data: dict, ref: str) -> bool:
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        return False

    _resend.api_key = api_key
    to_email = os.getenv("NAFDAC_REPORT_EMAIL", "sf.alert@nafdac.gov.ng")
    from_email = os.getenv("FROM_EMAIL", "noreply@nafdacverifier.com")

    drug_query = data.get("drug_query", "")
    location = data.get("location") or "Not provided"
    subject = f"[SF ALERT] Suspected Falsified Medicine — {drug_query} — {location} — Ref {ref}"

    def cell(label: str, value) -> str:
        v = value or "Not provided"
        return (
            f'<tr><td style="padding:8px 16px;color:#6b7280;white-space:nowrap">{label}</td>'
            f'<td style="padding:8px 16px">{v}</td></tr>'
        )

    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#f3f4f6">
<div style="max-width:600px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <div style="background:#CC0000;color:#fff;padding:16px 20px">
    <p style="margin:0;font-size:1rem;font-weight:700">&#128308; SUBSTANDARD/FALSIFIED MEDICINE ALERT</p>
    <p style="margin:4px 0 0;font-size:0.8rem;opacity:.9">Submitted via NAFDAC Verifier &middot; WHO Rapid Alert System Reference</p>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
    {cell("Ref No.", ref)}
    {cell("Registry Status", "<strong style='color:#CC0000'>NOT FOUND in NAFDAC DB</strong>")}
    {cell("Product Name", data.get("drug_query"))}
    {cell("Closest NAFDAC Match", data.get("closest_match"))}
    {cell("Manufacturer", data.get("manufacturer"))}
    {cell("Batch Number", data.get("batch_number"))}
    {cell("Expiry Date", data.get("expiry_date"))}
    {cell("Location", data.get("location"))}
  </table>
  <div style="background:#fff7ed;border-left:4px solid #f97316;padding:12px 16px;margin:0">
    <p style="margin:0;font-size:0.8rem;font-weight:700;color:#9a3412">Suspected Issue</p>
    <p style="margin:4px 0 0;font-size:0.9rem">{data.get("observation") or "No observation provided"}</p>
  </div>
  <div style="padding:14px 20px;font-size:0.8rem;color:#6b7280;border-top:1px solid #e5e7eb">
    <p style="margin:0">Reporter: Anonymous (NAFDAC Verifier App)</p>
    <p style="margin:4px 0 0">Alternative: Med Safety App (medsafety.io) &middot; NAFDAC Hotline: 0800-162-3322</p>
  </div>
</div>
</body>
</html>
"""

    try:
        _resend.Emails.send({
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
        return True
    except Exception:
        return False
