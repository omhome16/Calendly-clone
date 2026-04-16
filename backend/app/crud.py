# backend/app/crud.py
import re
import secrets
import json
from datetime import datetime, timedelta, date, time as time_type
from typing import List, Optional
import pytz

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from . import models, schemas


# ── Utility ────────────────────────────────────────────────────

def slugify(text: str) -> str:
    """Convert event name to URL-safe slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    text = re.sub(r'^-+|-+$', '', text)
    return text


def ensure_unique_slug(db: Session, base_slug: str, exclude_id: Optional[int] = None) -> str:
    """Append numeric suffix if slug already exists."""
    slug = base_slug
    counter = 1
    while True:
        q = db.query(models.EventType).filter(models.EventType.slug == slug)
        if exclude_id:
            q = q.filter(models.EventType.id != exclude_id)
        if not q.first():
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1


# ── Users ──────────────────────────────────────────────────────

def get_default_user(db: Session) -> models.User:
    """Always returns the default admin user (id=1)."""
    user = db.query(models.User).filter(models.User.id == 1).first()
    if not user:
        raise Exception("Default user not found. Run the seed script first.")
    return user


# ── Event Types ────────────────────────────────────────────────

def get_event_types(db: Session, user_id: int = 1) -> List[models.EventType]:
    return (
        db.query(models.EventType)
        .filter(models.EventType.user_id == user_id)
        .order_by(models.EventType.created_at.asc())
        .all()
    )


def get_event_type_by_id(db: Session, event_type_id: int) -> Optional[models.EventType]:
    return db.query(models.EventType).filter(models.EventType.id == event_type_id).first()


def get_event_type_by_slug(db: Session, slug: str) -> Optional[models.EventType]:
    return db.query(models.EventType).filter(models.EventType.slug == slug).first()


def create_event_type(db: Session, data: schemas.EventTypeCreate, user_id: int = 1) -> models.EventType:
    base_slug = data.slug if data.slug else slugify(data.name)
    slug = ensure_unique_slug(db, base_slug)

    event_type = models.EventType(
        user_id=user_id,
        name=data.name,
        slug=slug,
        duration=data.duration,
        description=data.description,
        color=data.color,
        location=data.location,
        event_category=data.event_category,
        max_invitees=data.max_invitees if data.event_category == 'group' else 1,
        buffer_before=data.buffer_before,
        buffer_after=data.buffer_after,
        max_per_day=data.max_per_day,
        schedule_days_ahead=data.schedule_days_ahead,
        min_notice_hours=data.min_notice_hours,
        custom_questions=data.custom_questions,
        schedule_id=data.schedule_id,
    )
    db.add(event_type)
    db.commit()
    db.refresh(event_type)
    return event_type


def update_event_type(
    db: Session, event_type_id: int, data: schemas.EventTypeUpdate
) -> Optional[models.EventType]:
    et = get_event_type_by_id(db, event_type_id)
    if not et:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(et, key, value)

    db.commit()
    db.refresh(et)
    return et


def delete_event_type(db: Session, event_type_id: int) -> bool:
    et = get_event_type_by_id(db, event_type_id)
    if not et:
        return False
    db.delete(et)
    db.commit()
    return True


# ── Availability ───────────────────────────────────────────────

def get_default_schedule(db: Session, user_id: int = 1) -> Optional[models.AvailabilitySchedule]:
    return (
        db.query(models.AvailabilitySchedule)
        .filter(
            models.AvailabilitySchedule.user_id == user_id,
            models.AvailabilitySchedule.is_default == True,
        )
        .first()
    )


def get_all_schedules(db: Session, user_id: int = 1) -> List[models.AvailabilitySchedule]:
    return (
        db.query(models.AvailabilitySchedule)
        .filter(models.AvailabilitySchedule.user_id == user_id)
        .order_by(models.AvailabilitySchedule.created_at.asc())
        .all()
    )


def create_availability_schedule(
    db: Session, data: schemas.AvailabilityScheduleCreate, user_id: int = 1
) -> models.AvailabilitySchedule:
    """Create a new availability schedule. First schedule created becomes default."""
    existing = get_all_schedules(db, user_id)
    is_default = len(existing) == 0

    schedule = models.AvailabilitySchedule(
        user_id=user_id,
        name=data.name,
        timezone=data.timezone,
        is_default=is_default,
    )
    db.add(schedule)
    db.commit()

    # Add default Mon-Fri 9-5 rules
    for dow in range(1, 6):  # Mon=1 to Fri=5
        rule = models.AvailabilityRule(
            schedule_id=schedule.id,
            day_of_week=dow,
            is_available=True,
            start_time=time_type(9, 0),
            end_time=time_type(17, 0),
        )
        db.add(rule)
    # Sat=6, Sun=0
    for dow in [0, 6]:
        rule = models.AvailabilityRule(
            schedule_id=schedule.id,
            day_of_week=dow,
            is_available=False,
        )
        db.add(rule)

    db.commit()
    db.refresh(schedule)
    return schedule


def delete_availability_schedule(db: Session, schedule_id: int) -> bool:
    """Delete a non-default schedule."""
    schedule = db.query(models.AvailabilitySchedule).filter(
        models.AvailabilitySchedule.id == schedule_id
    ).first()
    if not schedule or schedule.is_default:
        return False
    db.delete(schedule)
    db.commit()
    return True


def validate_single_use_token(db: Session, token: str) -> dict:
    """Check if a single-use link token is still valid."""
    link = db.query(models.SingleUseLink).filter(
        models.SingleUseLink.token == token
    ).first()
    if not link:
        return {"valid": False, "reason": "Token not found"}
    if link.status == "used":
        return {"valid": False, "reason": "This link has already been used"}
    if link.status == "expired":
        return {"valid": False, "reason": "This link has expired"}
    return {"valid": True, "event_type_id": link.event_type_id}


def check_date_booking_conflicts(
    db: Session, user_id: int, target_date: date
) -> List[dict]:
    """Check if there are active bookings on a specific date for this user."""
    tz = pytz.timezone("Asia/Kolkata")
    day_start_utc = tz.localize(datetime.combine(target_date, time_type(0, 0))).astimezone(pytz.utc)
    day_end_utc = day_start_utc + timedelta(days=1)

    bookings = (
        db.query(models.Booking)
        .join(models.EventType, models.Booking.event_type_id == models.EventType.id)
        .filter(
            models.EventType.user_id == user_id,
            models.Booking.status == "active",
            models.Booking.start_time < day_end_utc,
            models.Booking.end_time > day_start_utc,
        )
        .all()
    )

    return [{
        "booking_id": b.id,
        "invitee_name": b.invitee_name,
        "invitee_email": b.invitee_email,
        "start_time": b.start_time.isoformat(),
        "end_time": b.end_time.isoformat(),
        "event_type": b.event_type.name,
    } for b in bookings]


def update_availability(
    db: Session, schedule_id: int, data: schemas.AvailabilityScheduleUpdate
) -> Optional[models.AvailabilitySchedule]:
    schedule = db.query(models.AvailabilitySchedule).filter(
        models.AvailabilitySchedule.id == schedule_id
    ).first()
    if not schedule:
        return None

    update_data = data.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"]:
        schedule.name = update_data["name"]
    if "timezone" in update_data and update_data["timezone"]:
        schedule.timezone = update_data["timezone"]
    if "meeting_limit_per_day" in update_data:
        schedule.meeting_limit_per_day = update_data["meeting_limit_per_day"]

    if data.rules is not None:
        # Delete existing rules and replace
        db.query(models.AvailabilityRule).filter(
            models.AvailabilityRule.schedule_id == schedule_id
        ).delete()

        for rule_data in data.rules:
            start_t = None
            end_t = None
            if rule_data.is_available and rule_data.start_time and rule_data.end_time:
                start_t = datetime.strptime(rule_data.start_time, "%H:%M").time()
                end_t = datetime.strptime(rule_data.end_time, "%H:%M").time()

            rule = models.AvailabilityRule(
                schedule_id=schedule_id,
                day_of_week=rule_data.day_of_week,
                is_available=rule_data.is_available,
                start_time=start_t,
                end_time=end_t,
            )
            db.add(rule)

    db.commit()
    db.refresh(schedule)
    return schedule


# ── Date Overrides ─────────────────────────────────────────────

def create_date_override(
    db: Session, schedule_id: int, data: schemas.DateOverrideCreate
) -> models.DateOverride:
    override_date = datetime.strptime(data.override_date, "%Y-%m-%d").date()
    start_t = datetime.strptime(data.start_time, "%H:%M").time() if data.start_time else None
    end_t = datetime.strptime(data.end_time, "%H:%M").time() if data.end_time else None
    start_t2 = datetime.strptime(data.start_time_2, "%H:%M").time() if data.start_time_2 else None
    end_t2 = datetime.strptime(data.end_time_2, "%H:%M").time() if data.end_time_2 else None

    # Upsert: delete existing override for this date
    db.query(models.DateOverride).filter(
        models.DateOverride.schedule_id == schedule_id,
        models.DateOverride.override_date == override_date,
    ).delete()

    override = models.DateOverride(
        schedule_id=schedule_id,
        override_date=override_date,
        is_available=data.is_available,
        start_time=start_t,
        end_time=end_t,
        start_time_2=start_t2,
        end_time_2=end_t2,
    )
    db.add(override)
    db.commit()
    db.refresh(override)
    return override


def delete_date_override(db: Session, override_id: int) -> bool:
    override = db.query(models.DateOverride).filter(models.DateOverride.id == override_id).first()
    if not override:
        return False
    db.delete(override)
    db.commit()
    return True


def get_date_overrides(db: Session, schedule_id: int) -> List[models.DateOverride]:
    return (
        db.query(models.DateOverride)
        .filter(models.DateOverride.schedule_id == schedule_id)
        .order_by(models.DateOverride.override_date.asc())
        .all()
    )


def check_availability_conflicts(
    db: Session, user_id: int, schedule_id: int
) -> List[dict]:
    """Check if any active bookings conflict with the current availability rules.
    Only checks bookings belonging to event types linked to this schedule."""
    schedule = db.query(models.AvailabilitySchedule).filter(
        models.AvailabilitySchedule.id == schedule_id
    ).first()
    if not schedule:
        return []

    tz = pytz.timezone(schedule.timezone)
    now = datetime.now(pytz.utc)

    # Get future active bookings for event types linked to THIS schedule
    # If this is the default schedule, also include event types with no schedule_id
    query = (
        db.query(models.Booking)
        .join(models.EventType, models.Booking.event_type_id == models.EventType.id)
        .filter(
            models.EventType.user_id == user_id,
            models.Booking.status == "active",
            models.Booking.start_time > now,
        )
    )
    if schedule.is_default:
        query = query.filter(
            or_(models.EventType.schedule_id == schedule_id, models.EventType.schedule_id == None)
        )
    else:
        query = query.filter(models.EventType.schedule_id == schedule_id)

    future_bookings = query.all()

    conflicts = []
    for booking in future_bookings:
        booking_start_local = booking.start_time.astimezone(tz)
        booking_date = booking_start_local.date()
        day_of_week = (booking_date.weekday() + 1) % 7  # Convert to 0=Sun

        # Check if there's a date override
        override = db.query(models.DateOverride).filter(
            models.DateOverride.schedule_id == schedule_id,
            models.DateOverride.override_date == booking_date,
        ).first()

        if override:
            if not override.is_available:
                conflicts.append({
                    "booking_id": booking.id,
                    "invitee_name": booking.invitee_name,
                    "invitee_email": booking.invitee_email,
                    "start_time": booking.start_time.isoformat(),
                    "end_time": booking.end_time.isoformat(),
                    "event_type": booking.event_type.name,
                    "reason": f"Date {booking_date} is now unavailable",
                })
        else:
            # Check weekly rule
            rule = None
            for r in schedule.rules:
                if r.day_of_week == day_of_week:
                    rule = r
                    break
            if not rule or not rule.is_available:
                conflicts.append({
                    "booking_id": booking.id,
                    "invitee_name": booking.invitee_name,
                    "invitee_email": booking.invitee_email,
                    "start_time": booking.start_time.isoformat(),
                    "end_time": booking.end_time.isoformat(),
                    "event_type": booking.event_type.name,
                    "reason": f"Day is now unavailable",
                })

    return conflicts


# ── Slot Generation ────────────────────────────────────────────

def _get_event_schedule(db: Session, event_type: models.EventType) -> Optional[models.AvailabilitySchedule]:
    """Get the schedule for an event type (linked or default)."""
    schedule = None
    if event_type.schedule_id:
        schedule = db.query(models.AvailabilitySchedule).filter(
            models.AvailabilitySchedule.id == event_type.schedule_id
        ).first()
    if not schedule:
        schedule = get_default_schedule(db, user_id=event_type.user_id)
    return schedule


def get_available_slots(
    db: Session,
    event_type: models.EventType,
    requested_date: date,
    invitee_tz_name: Optional[str] = None,
) -> List[dict]:
    """
    Generate available time slots for a given date and event type.
    Enforces schedule_days_ahead, min_notice_hours, and max_per_day.
    Returns times in invitee_tz if provided, otherwise in schedule timezone.
    """
    schedule = _get_event_schedule(db, event_type)
    if not schedule:
        return []

    tz = pytz.timezone(schedule.timezone)
    now_utc = datetime.now(pytz.utc)
    today = now_utc.astimezone(tz).date()

    # Enforce schedule_days_ahead — reject dates too far in the future
    max_date = today + timedelta(days=event_type.schedule_days_ahead)
    if requested_date > max_date:
        return []
    # Reject past dates
    if requested_date < today:
        return []

    # Check for date-specific override first
    override = db.query(models.DateOverride).filter(
        models.DateOverride.schedule_id == schedule.id,
        models.DateOverride.override_date == requested_date,
    ).first()

    # Build list of time intervals for this day
    intervals = []
    if override:
        if not override.is_available or not override.start_time or not override.end_time:
            return []
        intervals.append((override.start_time, override.end_time))
        if override.start_time_2 and override.end_time_2:
            intervals.append((override.start_time_2, override.end_time_2))
    else:
        day_of_week = requested_date.weekday()  # 0=Mon in Python
        our_day_of_week = (day_of_week + 1) % 7  # Convert Python 0-Mon to 0-Sun

        rule = None
        for r in schedule.rules:
            if r.day_of_week == our_day_of_week:
                rule = r
                break

        if not rule or not rule.is_available or not rule.start_time or not rule.end_time:
            return []

        intervals.append((rule.start_time, rule.end_time))

    duration = timedelta(minutes=event_type.duration)
    buffer_total = timedelta(minutes=event_type.buffer_before + event_type.buffer_after)

    # Get ALL active bookings for this user on this day
    day_start_utc = tz.localize(datetime.combine(requested_date, time_type(0, 0))).astimezone(pytz.utc)
    day_end_utc = day_start_utc + timedelta(days=1)

    all_user_bookings = (
        db.query(models.Booking)
        .join(models.EventType, models.Booking.event_type_id == models.EventType.id)
        .filter(
            models.EventType.user_id == event_type.user_id,
            models.Booking.status == "active",
            models.Booking.start_time < day_end_utc,
            models.Booking.end_time > day_start_utc,
        )
        .all()
    )

    # max_per_day: event type's own limit, or schedule's global limit
    daily_bookings_count = len(all_user_bookings)
    max_per_day = event_type.max_per_day
    if max_per_day is None and schedule.meeting_limit_per_day:
        max_per_day = schedule.meeting_limit_per_day

    # Determine output timezone
    out_tz = pytz.timezone(invitee_tz_name) if invitee_tz_name else tz

    # Generate slots for each interval
    slots = []
    min_notice = timedelta(hours=event_type.min_notice_hours)

    for interval_start, interval_end in intervals:
        start_dt = tz.localize(datetime.combine(requested_date, interval_start))
        end_dt = tz.localize(datetime.combine(requested_date, interval_end))
        current = start_dt

        while current + duration <= end_dt:
            slot_start_utc = current.astimezone(pytz.utc)
            slot_end_utc = (current + duration).astimezone(pytz.utc)

            is_booked = any(
                b.start_time < slot_end_utc and b.end_time > slot_start_utc
                for b in all_user_bookings
            )
            is_past = slot_start_utc <= now_utc
            is_too_soon = slot_start_utc <= now_utc + min_notice
            is_limit_reached = max_per_day is not None and daily_bookings_count >= max_per_day

            # Convert to output timezone for display
            slot_start_display = current.astimezone(out_tz)
            slot_end_display = (current + duration).astimezone(out_tz)

            slots.append({
                "start": slot_start_display.isoformat(),
                "end": slot_end_display.isoformat(),
                "available": not is_booked and not is_past and not is_too_soon and not is_limit_reached,
            })
            current += duration + buffer_total

    return slots


# ── Bookings ───────────────────────────────────────────────────

def get_booking_by_id(db: Session, booking_id: int) -> Optional[models.Booking]:
    return db.query(models.Booking).filter(models.Booking.id == booking_id).first()


def get_bookings(
    db: Session,
    user_id: int = 1,
    status_filter: Optional[str] = None,
    upcoming_only: bool = False,
    past_only: bool = False,
) -> List[models.Booking]:
    """Get all bookings for event types owned by user_id."""
    now = datetime.now(pytz.utc)

    query = (
        db.query(models.Booking)
        .join(models.EventType, models.Booking.event_type_id == models.EventType.id)
        .filter(models.EventType.user_id == user_id)
    )

    if status_filter:
        query = query.filter(models.Booking.status == status_filter)

    if upcoming_only:
        # Active bookings in the future
        query = query.filter(
            models.Booking.start_time >= now,
            models.Booking.status == "active",
        )
    elif past_only:
        # Active bookings in the past (completed) OR ANY cancelled bookings
        query = query.filter(
            or_(
                and_(models.Booking.start_time < now, models.Booking.status == "active"),
                models.Booking.status == "cancelled"
            )
        )

    return query.order_by(models.Booking.start_time.asc()).all()


def get_booking_by_id(db: Session, booking_id: int) -> Optional[models.Booking]:
    return db.query(models.Booking).filter(models.Booking.id == booking_id).first()


def create_booking(
    db: Session,
    event_type: models.EventType,
    data: schemas.BookingCreate,
) -> models.Booking:
    """Create a booking. Raises ValueError if slot is already taken."""
    # Use the event type's linked schedule for timezone and limits
    schedule = _get_event_schedule(db, event_type)
    tz_name = schedule.timezone if schedule else "Asia/Kolkata"
    tz = pytz.timezone(tz_name)

    # Validate guest_emails for one-on-one (no guests allowed)
    if event_type.event_category == 'one-on-one' and data.guest_emails:
        raise ValueError("One-on-one events do not allow guest invitations.")

    # Validate guest count for group events
    if event_type.event_category == 'group' and data.guest_emails:
        guest_count = len([e.strip() for e in data.guest_emails.split(',') if e.strip()])
        if event_type.max_invitees and guest_count + 1 > event_type.max_invitees:
            raise ValueError(f"Maximum {event_type.max_invitees} invitees allowed (including yourself).")

    # Parse start_time
    if data.start_time.endswith("Z"):
        start_dt = datetime.fromisoformat(data.start_time.replace("Z", "+00:00"))
    else:
        start_dt = datetime.fromisoformat(data.start_time)

    # Ensure timezone aware
    if start_dt.tzinfo is None:
        start_dt = tz.localize(start_dt)

    start_utc = start_dt.astimezone(pytz.utc)
    end_utc = start_utc + timedelta(minutes=event_type.duration)

    # Check for overlapping bookings across ALL event types for this user
    overlapping = (
        db.query(models.Booking)
        .join(models.EventType, models.Booking.event_type_id == models.EventType.id)
        .filter(
            models.EventType.user_id == event_type.user_id,
            models.Booking.status == "active",
            models.Booking.start_time < end_utc,
            models.Booking.end_time > start_utc,
        )
        .first()
    )

    if overlapping:
        raise ValueError("This time slot overlaps with an existing booking.")

    # Check max meetings per day — use event type's linked schedule
    day_start = tz.localize(datetime.combine(start_dt.astimezone(tz).date(), time_type(0, 0))).astimezone(pytz.utc)
    day_end = day_start + timedelta(days=1)
    daily_count = (
        db.query(models.Booking)
        .join(models.EventType, models.Booking.event_type_id == models.EventType.id)
        .filter(
            models.EventType.user_id == event_type.user_id,
            models.Booking.status == "active",
            models.Booking.start_time >= day_start,
            models.Booking.start_time < day_end,
        )
        .count()
    )
    max_per_day = event_type.max_per_day
    if max_per_day is None and schedule and schedule.meeting_limit_per_day:
        max_per_day = schedule.meeting_limit_per_day
    if max_per_day is not None and daily_count >= max_per_day:
        raise ValueError(f"Maximum {max_per_day} meetings per day limit reached.")

    booking = models.Booking(
        event_type_id=event_type.id,
        invitee_name=data.invitee_name,
        invitee_email=data.invitee_email,
        start_time=start_utc,
        end_time=end_utc,
        notes=data.notes,
        guest_emails=data.guest_emails,
        custom_answers=data.custom_answers,
        invitee_timezone=data.invitee_timezone,
        status="active",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def reschedule_booking(
    db: Session, booking_id: int, new_start_time_str: str
) -> Optional[models.Booking]:
    """Cancel old booking and create a new one at the new time."""
    old_booking = get_booking_by_id(db, booking_id)
    if not old_booking or old_booking.status != "active":
        return None

    event_type = old_booking.event_type
    schedule = _get_event_schedule(db, event_type)
    tz_name = schedule.timezone if schedule else "Asia/Kolkata"
    tz = pytz.timezone(tz_name)

    if new_start_time_str.endswith("Z"):
        new_start = datetime.fromisoformat(new_start_time_str.replace("Z", "+00:00"))
    else:
        new_start = datetime.fromisoformat(new_start_time_str)

    if new_start.tzinfo is None:
        new_start = tz.localize(new_start)

    new_start_utc = new_start.astimezone(pytz.utc)
    new_end_utc = new_start_utc + timedelta(minutes=event_type.duration)

    # Check for overlap (exclude current booking)
    overlapping = (
        db.query(models.Booking)
        .join(models.EventType, models.Booking.event_type_id == models.EventType.id)
        .filter(
            models.EventType.user_id == event_type.user_id,
            models.Booking.status == "active",
            models.Booking.id != booking_id,
            models.Booking.start_time < new_end_utc,
            models.Booking.end_time > new_start_utc,
        )
        .first()
    )
    if overlapping:
        raise ValueError("The new time slot overlaps with an existing booking.")

    old_booking.status = "rescheduled"

    new_booking = models.Booking(
        event_type_id=event_type.id,
        invitee_name=old_booking.invitee_name,
        invitee_email=old_booking.invitee_email,
        start_time=new_start_utc,
        end_time=new_end_utc,
        notes=old_booking.notes,
        guest_emails=old_booking.guest_emails,
        custom_answers=old_booking.custom_answers,
        invitee_timezone=old_booking.invitee_timezone,
        rescheduled_from=old_booking.id,
        status="active",
    )
    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)
    return new_booking


def cancel_booking(
    db: Session, booking_id: int, cancel_reason: Optional[str] = None
) -> Optional[models.Booking]:
    booking = get_booking_by_id(db, booking_id)
    if not booking:
        return None
    booking.status = "cancelled"
    booking.cancel_reason = cancel_reason
    db.commit()
    db.refresh(booking)
    return booking


# ── Single Use Links ──────────────────────────────────────────

def create_single_use_link(db: Session, event_type_id: int) -> models.SingleUseLink:
    token = secrets.token_urlsafe(32)
    link = models.SingleUseLink(
        event_type_id=event_type_id,
        token=token,
        status="created",
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def get_single_use_links(db: Session, user_id: int = 1) -> List[models.SingleUseLink]:
    return (
        db.query(models.SingleUseLink)
        .join(models.EventType, models.SingleUseLink.event_type_id == models.EventType.id)
        .filter(models.EventType.user_id == user_id)
        .order_by(models.SingleUseLink.created_at.desc())
        .all()
    )


def get_single_use_link_by_token(db: Session, token: str) -> Optional[models.SingleUseLink]:
    return db.query(models.SingleUseLink).filter(models.SingleUseLink.token == token).first()


def use_single_use_link(db: Session, token: str, booking_id: int) -> Optional[models.SingleUseLink]:
    link = get_single_use_link_by_token(db, token)
    if not link or link.status != "created":
        return None
    link.status = "used"
    link.booking_id = booking_id
    db.commit()
    db.refresh(link)
    return link


def delete_single_use_link(db: Session, link_id: int) -> bool:
    link = db.query(models.SingleUseLink).filter(models.SingleUseLink.id == link_id).first()
    if not link:
        return False
    db.delete(link)
    db.commit()
    return True


# ── Custom Questions ──────────────────────────────────────────

def get_custom_questions(db: Session, event_type_id: int) -> List[models.CustomQuestion]:
    return (
        db.query(models.CustomQuestion)
        .filter(models.CustomQuestion.event_type_id == event_type_id)
        .order_by(models.CustomQuestion.sort_order.asc())
        .all()
    )


def create_custom_question(
    db: Session, event_type_id: int, data: schemas.CustomQuestionCreate
) -> models.CustomQuestion:
    q = models.CustomQuestion(
        event_type_id=event_type_id,
        question_text=data.question_text,
        question_type=data.question_type,
        is_required=data.is_required,
        options=data.options,
        sort_order=data.sort_order,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


def delete_custom_question(db: Session, question_id: int) -> bool:
    q = db.query(models.CustomQuestion).filter(models.CustomQuestion.id == question_id).first()
    if not q:
        return False
    db.delete(q)
    db.commit()
    return True
