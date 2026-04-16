# backend/app/routers/holidays.py
from fastapi import APIRouter
from typing import List, Dict
from pydantic import BaseModel

router = APIRouter(prefix="/api/holidays", tags=["Holidays"])


class Holiday(BaseModel):
    date: str         # YYYY-MM-DD
    name: str
    type: str         # national, religious, cultural


# ── Holiday Data ──────────────────────────────────────────────
# Dates are approximate for 2026; religious holidays shift yearly.

HOLIDAYS: Dict[str, Dict[int, List[dict]]] = {
    "IN": {
        2026: [
            {"date": "2026-01-14", "name": "Makar Sankranti / Pongal", "type": "cultural"},
            {"date": "2026-01-26", "name": "Republic Day", "type": "national"},
            {"date": "2026-03-10", "name": "Maha Shivaratri", "type": "religious"},
            {"date": "2026-03-17", "name": "Holi", "type": "religious"},
            {"date": "2026-03-20", "name": "Eid ul-Fitr", "type": "religious"},
            {"date": "2026-03-30", "name": "Ugadi / Gudi Padwa", "type": "cultural"},
            {"date": "2026-04-02", "name": "Ram Navami", "type": "religious"},
            {"date": "2026-04-06", "name": "Mahavir Jayanti", "type": "religious"},
            {"date": "2026-04-14", "name": "Dr. Ambedkar Jayanti", "type": "national"},
            {"date": "2026-05-01", "name": "May Day", "type": "national"},
            {"date": "2026-05-12", "name": "Buddha Purnima", "type": "religious"},
            {"date": "2026-05-27", "name": "Eid ul-Adha (Bakrid)", "type": "religious"},
            {"date": "2026-06-26", "name": "Muharram", "type": "religious"},
            {"date": "2026-08-06", "name": "Raksha Bandhan", "type": "cultural"},
            {"date": "2026-08-14", "name": "Janmashtami", "type": "religious"},
            {"date": "2026-08-15", "name": "Independence Day", "type": "national"},
            {"date": "2026-08-26", "name": "Milad un-Nabi", "type": "religious"},
            {"date": "2026-10-02", "name": "Gandhi Jayanti", "type": "national"},
            {"date": "2026-10-02", "name": "Dussehra (Vijayadashami)", "type": "religious"},
            {"date": "2026-10-12", "name": "Karva Chauth", "type": "cultural"},
            {"date": "2026-10-20", "name": "Diwali", "type": "religious"},
            {"date": "2026-10-22", "name": "Govardhan Puja", "type": "religious"},
            {"date": "2026-10-23", "name": "Bhai Dooj", "type": "cultural"},
            {"date": "2026-11-01", "name": "Chhath Puja", "type": "religious"},
            {"date": "2026-11-04", "name": "Guru Nanak Jayanti", "type": "religious"},
            {"date": "2026-12-25", "name": "Christmas", "type": "religious"},
        ],
        2025: [
            {"date": "2025-01-14", "name": "Makar Sankranti / Pongal", "type": "cultural"},
            {"date": "2025-01-26", "name": "Republic Day", "type": "national"},
            {"date": "2025-02-26", "name": "Maha Shivaratri", "type": "religious"},
            {"date": "2025-03-14", "name": "Holi", "type": "religious"},
            {"date": "2025-03-31", "name": "Eid ul-Fitr", "type": "religious"},
            {"date": "2025-04-06", "name": "Ram Navami", "type": "religious"},
            {"date": "2025-04-10", "name": "Mahavir Jayanti", "type": "religious"},
            {"date": "2025-04-14", "name": "Dr. Ambedkar Jayanti", "type": "national"},
            {"date": "2025-05-12", "name": "Buddha Purnima", "type": "religious"},
            {"date": "2025-06-07", "name": "Eid ul-Adha (Bakrid)", "type": "religious"},
            {"date": "2025-08-09", "name": "Raksha Bandhan", "type": "cultural"},
            {"date": "2025-08-15", "name": "Independence Day", "type": "national"},
            {"date": "2025-08-16", "name": "Janmashtami", "type": "religious"},
            {"date": "2025-10-02", "name": "Gandhi Jayanti", "type": "national"},
            {"date": "2025-10-02", "name": "Dussehra (Vijayadashami)", "type": "religious"},
            {"date": "2025-10-20", "name": "Diwali", "type": "religious"},
            {"date": "2025-11-05", "name": "Guru Nanak Jayanti", "type": "religious"},
            {"date": "2025-12-25", "name": "Christmas", "type": "religious"},
        ],
    },
    "US": {
        2026: [
            {"date": "2026-01-01", "name": "New Year's Day", "type": "national"},
            {"date": "2026-01-19", "name": "Martin Luther King Jr. Day", "type": "national"},
            {"date": "2026-02-16", "name": "Presidents' Day", "type": "national"},
            {"date": "2026-05-25", "name": "Memorial Day", "type": "national"},
            {"date": "2026-06-19", "name": "Juneteenth", "type": "national"},
            {"date": "2026-07-04", "name": "Independence Day", "type": "national"},
            {"date": "2026-09-07", "name": "Labor Day", "type": "national"},
            {"date": "2026-10-12", "name": "Columbus Day", "type": "national"},
            {"date": "2026-11-11", "name": "Veterans Day", "type": "national"},
            {"date": "2026-11-26", "name": "Thanksgiving", "type": "national"},
            {"date": "2026-12-25", "name": "Christmas Day", "type": "national"},
        ],
        2025: [
            {"date": "2025-01-01", "name": "New Year's Day", "type": "national"},
            {"date": "2025-01-20", "name": "Martin Luther King Jr. Day", "type": "national"},
            {"date": "2025-02-17", "name": "Presidents' Day", "type": "national"},
            {"date": "2025-05-26", "name": "Memorial Day", "type": "national"},
            {"date": "2025-06-19", "name": "Juneteenth", "type": "national"},
            {"date": "2025-07-04", "name": "Independence Day", "type": "national"},
            {"date": "2025-09-01", "name": "Labor Day", "type": "national"},
            {"date": "2025-10-13", "name": "Columbus Day", "type": "national"},
            {"date": "2025-11-11", "name": "Veterans Day", "type": "national"},
            {"date": "2025-11-27", "name": "Thanksgiving", "type": "national"},
            {"date": "2025-12-25", "name": "Christmas Day", "type": "national"},
        ],
    },
    "GB": {
        2026: [
            {"date": "2026-01-01", "name": "New Year's Day", "type": "national"},
            {"date": "2026-04-03", "name": "Good Friday", "type": "national"},
            {"date": "2026-04-06", "name": "Easter Monday", "type": "national"},
            {"date": "2026-05-04", "name": "Early May Bank Holiday", "type": "national"},
            {"date": "2026-05-25", "name": "Spring Bank Holiday", "type": "national"},
            {"date": "2026-08-31", "name": "Summer Bank Holiday", "type": "national"},
            {"date": "2026-12-25", "name": "Christmas Day", "type": "national"},
            {"date": "2026-12-26", "name": "Boxing Day", "type": "national"},
        ],
        2025: [
            {"date": "2025-01-01", "name": "New Year's Day", "type": "national"},
            {"date": "2025-04-18", "name": "Good Friday", "type": "national"},
            {"date": "2025-04-21", "name": "Easter Monday", "type": "national"},
            {"date": "2025-05-05", "name": "Early May Bank Holiday", "type": "national"},
            {"date": "2025-05-26", "name": "Spring Bank Holiday", "type": "national"},
            {"date": "2025-08-25", "name": "Summer Bank Holiday", "type": "national"},
            {"date": "2025-12-25", "name": "Christmas Day", "type": "national"},
            {"date": "2025-12-26", "name": "Boxing Day", "type": "national"},
        ],
    },
}


@router.get("/{country_code}/{year}", response_model=List[Holiday])
def get_holidays(country_code: str, year: int):
    """Get holidays for a specific country and year.
    Supported countries: IN (India), US (United States), GB (United Kingdom)."""
    code = country_code.upper()
    if code not in HOLIDAYS:
        return []
    year_data = HOLIDAYS[code].get(year, [])
    return year_data


@router.get("/countries")
def list_countries():
    """List all supported countries."""
    return [
        {"code": "IN", "name": "India", "flag": "🇮🇳"},
        {"code": "US", "name": "United States", "flag": "🇺🇸"},
        {"code": "GB", "name": "United Kingdom", "flag": "🇬🇧"},
    ]
