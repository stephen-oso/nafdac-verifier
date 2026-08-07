import os
import anthropic
from models import ClosestMatch, DrugRecord

_client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"), timeout=5.0)
_MODEL = "claude-haiku-4-5-20251001"
_HOTLINE = "+234 (0) 700-1-623322"


async def not_found_summary(query: str, closest: list[ClosestMatch]) -> str | None:
    try:
        if closest:
            matches_text = "\n".join(
                f"- {m.drug_name} (Reg: {m.reg_number}, Manufacturer: {m.manufacturer or 'Unknown'})"
                for m in closest
            )
            prompt = (
                f'A pharmacist searched for "{query}" in the NAFDAC drug registry. '
                f"It was not found.\n\nClosest registered products:\n{matches_text}\n\n"
                f"Write a 2-3 sentence risk assessment for the pharmacist. Include: "
                f"(1) that the product was not found in the NAFDAC registry, "
                f"(2) what differs between the search and the closest match, "
                f"(3) a clear recommendation to refuse the product and report to NAFDAC at {_HOTLINE}. "
                f"Plain English only. No jargon."
            )
        else:
            prompt = (
                f'A pharmacist searched for "{query}" in the NAFDAC drug registry. '
                f"It was not found and there are no similar registered products. "
                f"Write 2 sentences: state it was not found, and recommend refusing it and "
                f"reporting to NAFDAC at {_HOTLINE}."
            )
        msg = await _client.messages.create(
            model=_MODEL,
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        return msg.content[0].text
    except Exception:
        return None


async def single_best_match_summary(query: str, best: DrugRecord) -> str | None:
    try:
        prompt = (
            f'A pharmacist searched for "{query}". '
            f"The closest NAFDAC-registered product is: "
            f"{best.drug_name} (Reg: {best.reg_number}, "
            f"Manufacturer: {best.manufacturer or 'Unknown'}). "
            f"Write one sentence telling the pharmacist to confirm this is the correct "
            f"product by checking the strength and manufacturer on the package before dispensing."
        )
        msg = await _client.messages.create(
            model=_MODEL,
            max_tokens=100,
            messages=[{"role": "user", "content": prompt}]
        )
        return msg.content[0].text
    except Exception:
        return None


async def multiple_matches_summary(query: str, candidates: list[DrugRecord]) -> str | None:
    try:
        names = ", ".join(c.drug_name for c in candidates[:3])
        prompt = (
            f'A pharmacist searched for "{query}". '
            f"Multiple NAFDAC-registered products match: {names}. "
            f"Write one sentence telling the pharmacist to select the correct product "
            f"by checking the strength and manufacturer on the package."
        )
        msg = await _client.messages.create(
            model=_MODEL,
            max_tokens=100,
            messages=[{"role": "user", "content": prompt}]
        )
        return msg.content[0].text
    except Exception:
        return None
