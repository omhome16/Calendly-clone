# backend/app/routers/slots.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta, datetime
from typing import List, Optional
import calendar
import pytz

from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/api/slots", tags=["Slots"])


@router.get("/{slug}/{date_str}", response_model=List[schemas.SlotResponse])
def get_slots(
    slug: str,
    date_str: str,
    tz: Optional[str] = Query(None, description="Invitee timezone, e.g. America/New_York"),
    db: Session = Depends(get_db),
):
    """
    Get available time slots for a specific event type and date.
    date_str format: YYYY-MM-DD
    Optional tz param converts slot times to invitee's timezone.
    """
    event_type = crud.get_event_type_by_slug(db, slug)
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found")

    try:
        requested_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    slots = crud.get_available_slots(db, event_type, requested_date, invitee_tz_name=tz)
    return slots


@router.get("/{slug}/available-days/{year}/{month}")
def get_available_days(
    slug: str,
    year: int,
    month: int,
    tz: Optional[str] = Query(None, description="Invitee timezone"),
    db: Session = Depends(get_db),
):
    """
    Get all dates in a given month that have at least one available slot.
    Respects schedule_days_ahead to limit the date range.
    """
    event_type = crud.get_event_type_by_slug(db, slug)
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found")

    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Month must be 1-12")

    # Calculate the max bookable date
    schedule = crud._get_event_schedule(db, event_type)
    schedule_tz = pytz.timezone(schedule.timezone) if schedule else pytz.timezone("Asia/Kolkata")
    today = datetime.now(pytz.utc).astimezone(schedule_tz).date()
    max_date = today + timedelta(days=event_type.schedule_days_ahead)

    _, last_day = calendar.monthrange(year, month)
    available_dates = []

    for day in range(1, last_day + 1):
        try:
            d = date(year, month, day)
        except ValueError:
            continue
        # Skip past dates and dates beyond the limit
        if d < today or d > max_date:
            continue
        slots = crud.get_available_slots(db, event_type, d, invitee_tz_name=tz)
        if any(s["available"] for s in slots):
            available_dates.append(d.isoformat())

    return {
        "available_dates": available_dates,
        "max_date": max_date.isoformat(),  # Tell frontend the furthest bookable date
    }
