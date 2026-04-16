# backend/app/routers/availability.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/api/availability", tags=["Availability"])


@router.get("/", response_model=schemas.AvailabilityScheduleResponse)
def get_availability(db: Session = Depends(get_db)):
    """Get the default availability schedule for the admin user."""
    schedule = crud.get_default_schedule(db, user_id=1)
    if not schedule:
        raise HTTPException(status_code=404, detail="No availability schedule found")
    return schedule


@router.get("/all", response_model=List[schemas.AvailabilityScheduleResponse])
def get_all_schedules(db: Session = Depends(get_db)):
    """Get all availability schedules for the admin user."""
    return crud.get_all_schedules(db, user_id=1)




@router.post("/", response_model=schemas.AvailabilityScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_schedule(
    data: schemas.AvailabilityScheduleCreate,
    db: Session = Depends(get_db),
):
    """Create a new availability schedule with default Mon-Fri 9-5 rules."""
    return crud.create_availability_schedule(db, data, user_id=1)


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    """Delete a non-default schedule."""
    if not crud.delete_availability_schedule(db, schedule_id):
        raise HTTPException(status_code=400, detail="Cannot delete default schedule or schedule not found")


@router.patch("/{schedule_id}", response_model=schemas.AvailabilityScheduleResponse)
def update_availability(
    schedule_id: int,
    data: schemas.AvailabilityScheduleUpdate,
    db: Session = Depends(get_db),
):
    schedule = crud.update_availability(db, schedule_id, data)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule


# ── Date Overrides ─────────────────────────────────────────────

@router.post("/{schedule_id}/overrides", response_model=schemas.DateOverrideResponse, status_code=status.HTTP_201_CREATED)
def create_date_override(
    schedule_id: int,
    data: schemas.DateOverrideCreate,
    db: Session = Depends(get_db),
):
    """Add or update a date-specific availability override."""
    return crud.create_date_override(db, schedule_id, data)


@router.get("/{schedule_id}/overrides", response_model=List[schemas.DateOverrideResponse])
def list_date_overrides(schedule_id: int, db: Session = Depends(get_db)):
    """List all date overrides for a schedule."""
    return crud.get_date_overrides(db, schedule_id)


@router.delete("/overrides/{override_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_date_override(override_id: int, db: Session = Depends(get_db)):
    if not crud.delete_date_override(db, override_id):
        raise HTTPException(status_code=404, detail="Override not found")


@router.get("/{schedule_id}/conflicts")
def check_conflicts(schedule_id: int, db: Session = Depends(get_db)):
    """Check if any future bookings conflict with the current availability rules."""
    conflicts = crud.check_availability_conflicts(db, user_id=1, schedule_id=schedule_id)
    return {"conflicts": conflicts, "count": len(conflicts)}


@router.post("/check-date-conflicts")
def check_date_conflicts(data: dict, db: Session = Depends(get_db)):
    """Check if there are bookings on a specific date before marking it unavailable."""
    target_date = datetime.strptime(data["date"], "%Y-%m-%d").date()
    conflicts = crud.check_date_booking_conflicts(db, user_id=1, target_date=target_date)
    return {"conflicts": conflicts, "count": len(conflicts)}
