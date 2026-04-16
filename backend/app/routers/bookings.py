# backend/app/routers/bookings.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/api/bookings", tags=["Bookings"])


@router.get("/validate-token/{token}")
def validate_token(token: str, db: Session = Depends(get_db)):
    """Check if a single-use link token is still valid."""
    return crud.validate_single_use_token(db, token)


@router.get("/", response_model=List[schemas.BookingResponse])
def list_bookings(
    filter: Optional[str] = Query(None, description="'upcoming', 'past', or 'cancelled'"),
    db: Session = Depends(get_db),
):
    """List all bookings for the default admin user."""
    if filter == "cancelled":
        bookings = crud.get_bookings(db, user_id=1, status_filter="cancelled")
    elif filter == "upcoming":
        bookings = crud.get_bookings(db, user_id=1, upcoming_only=True)
    elif filter == "past":
        bookings = crud.get_bookings(db, user_id=1, past_only=True)
    else:
        bookings = crud.get_bookings(db, user_id=1)
    return bookings


@router.get("/public/{slug}", response_model=schemas.EventTypeResponse)
def get_public_event_type(slug: str, db: Session = Depends(get_db)):
    """Public endpoint to get event type info by slug (for the booking page)."""
    et = crud.get_event_type_by_slug(db, slug)
    if not et or not et.is_active:
        raise HTTPException(status_code=404, detail="Event type not found")
    return et


@router.get("/{booking_id}", response_model=schemas.BookingResponse)
def get_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = crud.get_booking_by_id(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


@router.post("/{slug}", response_model=schemas.BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    slug: str,
    data: schemas.BookingCreate,
    db: Session = Depends(get_db),
):
    """Create a booking for a public event type (identified by slug).
    Optionally validates a single-use link token."""
    event_type = crud.get_event_type_by_slug(db, slug)
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found")
    if not event_type.is_active:
        raise HTTPException(status_code=400, detail="This event type is not currently active")

    # Validate single-use link token if provided
    single_use_link = None
    if data.token:
        single_use_link = crud.get_single_use_link_by_token(db, data.token)
        if not single_use_link:
            raise HTTPException(status_code=400, detail="Invalid single-use link token")
        if single_use_link.status != "created":
            raise HTTPException(status_code=400, detail="This single-use link has already been used or expired")
        if single_use_link.event_type_id != event_type.id:
            raise HTTPException(status_code=400, detail="Token does not match this event type")

    try:
        booking = crud.create_booking(db, event_type, data)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # Mark single-use link as used after successful booking
    if single_use_link:
        crud.use_single_use_link(db, data.token, booking.id)

    return booking


@router.patch("/{booking_id}/cancel", response_model=schemas.BookingResponse)
def cancel_booking(
    booking_id: int,
    data: schemas.BookingCancelRequest,
    db: Session = Depends(get_db),
):
    booking = crud.cancel_booking(db, booking_id, data.cancel_reason)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


@router.patch("/{booking_id}/reschedule", response_model=schemas.BookingResponse)
def reschedule_booking(
    booking_id: int,
    data: schemas.RescheduleRequest,
    db: Session = Depends(get_db),
):
    """Reschedule a booking to a new time. Old booking is marked as 'rescheduled'."""
    try:
        new_booking = crud.reschedule_booking(db, booking_id, data.new_start_time)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not new_booking:
        raise HTTPException(status_code=404, detail="Booking not found or cannot be rescheduled")
    return new_booking
