# backend/app/schemas.py
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime, time, date


# ── User ──────────────────────────────────────────────────────
class UserBase(BaseModel):
    name: str
    email: str
    username: str
    timezone: str = "Asia/Kolkata"

class UserResponse(UserBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Event Types ───────────────────────────────────────────────
class EventTypeCreate(BaseModel):
    name: str
    duration: int = 30
    description: Optional[str] = None
    color: str = "#7C3AED"
    location: str = "Google Meet"
    slug: Optional[str] = None
    event_category: str = "one-on-one"
    max_invitees: int = 1
    buffer_before: int = 0
    buffer_after: int = 0
    max_per_day: Optional[int] = None
    schedule_days_ahead: int = 60
    min_notice_hours: int = 4
    custom_questions: Optional[str] = None
    schedule_id: Optional[int] = None

    @field_validator("duration")
    @classmethod
    def duration_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Duration must be greater than 0")
        return v

    @field_validator("event_category")
    @classmethod
    def validate_category(cls, v):
        if v not in ("one-on-one", "group", "round-robin"):
            raise ValueError("event_category must be one-on-one, group, or round-robin")
        return v

class EventTypeUpdate(BaseModel):
    name: Optional[str] = None
    duration: Optional[int] = None
    description: Optional[str] = None
    color: Optional[str] = None
    location: Optional[str] = None
    is_active: Optional[bool] = None
    event_category: Optional[str] = None
    max_invitees: Optional[int] = None
    buffer_before: Optional[int] = None
    buffer_after: Optional[int] = None
    max_per_day: Optional[int] = None
    schedule_days_ahead: Optional[int] = None
    min_notice_hours: Optional[int] = None
    custom_questions: Optional[str] = None
    schedule_id: Optional[int] = None

class EventTypeResponse(BaseModel):
    id: int
    user_id: int
    name: str
    slug: str
    duration: int
    description: Optional[str]
    color: str
    location: str
    is_active: bool
    event_category: str = "one-on-one"
    max_invitees: int = 1
    buffer_before: int = 0
    buffer_after: int = 0
    max_per_day: Optional[int] = None
    schedule_days_ahead: int = 60
    min_notice_hours: int = 4
    custom_questions: Optional[str] = None
    schedule_id: Optional[int] = None
    created_at: datetime

    @field_validator("custom_questions", mode="before")
    @classmethod
    def coerce_custom_questions(cls, v):
        if isinstance(v, str) and v:
            return v
        return None

    model_config = {"from_attributes": True}


# ── Availability Rules ─────────────────────────────────────────
class AvailabilityRuleBase(BaseModel):
    day_of_week: int           # 0–6
    is_available: bool = True
    start_time: Optional[str] = None   # "09:00"
    end_time: Optional[str] = None     # "17:00"

class AvailabilityRuleResponse(BaseModel):
    id: int
    day_of_week: int
    is_available: bool = True
    start_time: Optional[str] = None
    end_time: Optional[str] = None

    model_config = {"from_attributes": True}

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def serialize_time(cls, v):
        if v is None:
            return None
        if isinstance(v, time):
            return v.strftime("%H:%M")
        return str(v)


# ── Date Overrides ─────────────────────────────────────────────
class DateOverrideCreate(BaseModel):
    override_date: str       # "2026-04-20"
    is_available: bool = False
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    start_time_2: Optional[str] = None  # Split timing second interval
    end_time_2: Optional[str] = None

class DateOverrideResponse(BaseModel):
    id: int
    override_date: date
    is_available: bool
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    start_time_2: Optional[str] = None
    end_time_2: Optional[str] = None

    model_config = {"from_attributes": True}

    @field_validator("start_time", "end_time", "start_time_2", "end_time_2", mode="before")
    @classmethod
    def serialize_time(cls, v):
        if v is None:
            return None
        if isinstance(v, time):
            return v.strftime("%H:%M")
        return str(v)


# ── Availability Schedule ──────────────────────────────────────
class AvailabilityScheduleCreate(BaseModel):
    name: str = "Working hours"
    timezone: str = "Asia/Kolkata"

class AvailabilityScheduleUpdate(BaseModel):
    name: Optional[str] = None
    timezone: Optional[str] = None
    rules: Optional[List[AvailabilityRuleBase]] = None
    meeting_limit_per_day: Optional[int] = None

class AvailabilityScheduleResponse(BaseModel):
    id: int
    user_id: int
    name: str
    is_default: bool
    timezone: str
    meeting_limit_per_day: Optional[int] = None
    rules: List[AvailabilityRuleResponse]
    date_overrides: List[DateOverrideResponse] = []

    model_config = {"from_attributes": True}

class AvailabilityScheduleListItem(BaseModel):
    id: int
    user_id: int
    name: str
    is_default: bool
    timezone: str

    model_config = {"from_attributes": True}


# ── Slots ──────────────────────────────────────────────────────
class SlotResponse(BaseModel):
    start: str   # ISO datetime string
    end: str     # ISO datetime string
    available: bool


# ── Bookings ───────────────────────────────────────────────────
class BookingCreate(BaseModel):
    invitee_name: str
    invitee_email: str
    start_time: str    # ISO string from frontend e.g. "2026-04-16T09:00:00"
    notes: Optional[str] = None
    guest_emails: Optional[str] = None
    custom_answers: Optional[str] = None
    invitee_timezone: str = "Asia/Kolkata"  # Invitee's timezone
    token: Optional[str] = None  # Single-use link token (if booking via single-use link)

class BookingCancelRequest(BaseModel):
    cancel_reason: Optional[str] = None

class RescheduleRequest(BaseModel):
    new_start_time: str   # ISO string

class BookingResponse(BaseModel):
    id: int
    event_type_id: int
    invitee_name: str
    invitee_email: str
    start_time: datetime
    end_time: datetime
    status: str
    notes: Optional[str]
    cancel_reason: Optional[str]
    guest_emails: Optional[str] = None
    custom_answers: Optional[str] = None
    invitee_timezone: str = "Asia/Kolkata"
    rescheduled_from: Optional[int] = None
    created_at: datetime
    event_type: Optional[EventTypeResponse] = None

    model_config = {"from_attributes": True}


# ── Single Use Links ──────────────────────────────────────────
class SingleUseLinkCreate(BaseModel):
    event_type_id: int

class SingleUseLinkResponse(BaseModel):
    id: int
    event_type_id: int
    token: str
    status: str
    booking_id: Optional[int] = None
    created_at: datetime
    event_type: Optional[EventTypeResponse] = None

    model_config = {"from_attributes": True}


# ── Custom Questions ──────────────────────────────────────────
class CustomQuestionCreate(BaseModel):
    question_text: str
    question_type: str = "text"
    is_required: bool = False
    options: Optional[str] = None
    sort_order: int = 0

class CustomQuestionResponse(BaseModel):
    id: int
    event_type_id: int
    question_text: str
    question_type: str
    is_required: bool
    options: Optional[str]
    sort_order: int

    model_config = {"from_attributes": True}
