# backend/app/models.py
from sqlalchemy import (
    Column, Integer, String, Boolean, Text, Date,
    ForeignKey, DateTime, Time, SmallInteger, CheckConstraint, UniqueConstraint, Enum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(100), nullable=False, default="Admin User")
    email      = Column(String(255), unique=True, nullable=False)
    username   = Column(String(100), unique=True, nullable=False)
    timezone   = Column(String(100), nullable=False, default="Asia/Kolkata")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    event_types            = relationship("EventType", back_populates="user", cascade="all, delete-orphan")
    availability_schedules = relationship("AvailabilitySchedule", back_populates="user", cascade="all, delete-orphan")


class EventType(Base):
    __tablename__ = "event_types"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name            = Column(String(200), nullable=False)
    slug            = Column(String(200), unique=True, nullable=False, index=True)
    duration        = Column(Integer, nullable=False, default=30)
    description     = Column(Text, nullable=True)
    color           = Column(String(20), nullable=False, default="#7C3AED")
    location        = Column(String(200), default="Google Meet")
    is_active       = Column(Boolean, nullable=False, default=True)
    event_category  = Column(String(50), nullable=False, default="one-on-one")  # one-on-one, group, round-robin
    max_invitees    = Column(Integer, nullable=False, default=1)  # 1 for one-on-one, N for group
    buffer_before   = Column(Integer, nullable=False, default=0)   # minutes
    buffer_after    = Column(Integer, nullable=False, default=0)   # minutes
    max_per_day     = Column(Integer, nullable=True)                # meeting limit per day
    schedule_days_ahead = Column(Integer, nullable=False, default=60) # how many days in future invitees can schedule
    min_notice_hours = Column(Integer, nullable=False, default=4)    # minimum notice in hours
    custom_questions = Column(Text, nullable=True)                   # Custom question for invitees
    schedule_id     = Column(Integer, ForeignKey("availability_schedules.id", ondelete="SET NULL"), nullable=True)  # linked schedule
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("event_category IN ('one-on-one', 'group', 'round-robin')", name="ck_event_category"),
    )

    user             = relationship("User", back_populates="event_types")
    bookings         = relationship("Booking", back_populates="event_type", cascade="all, delete-orphan")
    single_use_links = relationship("SingleUseLink", back_populates="event_type", cascade="all, delete-orphan")
    custom_questions_rel = relationship("CustomQuestion", back_populates="event_type", cascade="all, delete-orphan")


class AvailabilitySchedule(Base):
    __tablename__ = "availability_schedules"

    id                  = Column(Integer, primary_key=True, index=True)
    user_id             = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name                = Column(String(100), nullable=False, default="Working hours")
    is_default          = Column(Boolean, nullable=False, default=False)
    timezone            = Column(String(100), nullable=False, default="Asia/Kolkata")
    meeting_limit_per_day = Column(Integer, nullable=True)  # global daily meeting limit
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user           = relationship("User", back_populates="availability_schedules")
    rules          = relationship("AvailabilityRule", back_populates="schedule", cascade="all, delete-orphan")
    date_overrides = relationship("DateOverride", back_populates="schedule", cascade="all, delete-orphan")


class AvailabilityRule(Base):
    __tablename__ = "availability_rules"
    __table_args__ = (
        UniqueConstraint("schedule_id", "day_of_week", name="uq_schedule_day"),
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="ck_day_of_week"),
    )

    id           = Column(Integer, primary_key=True, index=True)
    schedule_id  = Column(Integer, ForeignKey("availability_schedules.id", ondelete="CASCADE"), nullable=False)
    day_of_week  = Column(SmallInteger, nullable=False)  # 0=Sun, 1=Mon, ..., 6=Sat
    is_available = Column(Boolean, nullable=False, default=True)
    start_time   = Column(Time, nullable=True)   # e.g., 09:00:00
    end_time     = Column(Time, nullable=True)   # e.g., 17:00:00
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    schedule = relationship("AvailabilitySchedule", back_populates="rules")


class DateOverride(Base):
    """Date-specific availability overrides (e.g., block a specific day or add custom hours)."""
    __tablename__ = "date_overrides"
    __table_args__ = (
        UniqueConstraint("schedule_id", "override_date", name="uq_schedule_date"),
    )

    id            = Column(Integer, primary_key=True, index=True)
    schedule_id   = Column(Integer, ForeignKey("availability_schedules.id", ondelete="CASCADE"), nullable=False)
    override_date = Column(Date, nullable=False)
    is_available  = Column(Boolean, nullable=False, default=False)
    start_time    = Column(Time, nullable=True)
    end_time      = Column(Time, nullable=True)
    start_time_2  = Column(Time, nullable=True)  # Second interval start (for split timing)
    end_time_2    = Column(Time, nullable=True)   # Second interval end (for split timing)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    schedule = relationship("AvailabilitySchedule", back_populates="date_overrides")


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'cancelled', 'rescheduled')", name="ck_status"),
    )

    id                = Column(Integer, primary_key=True, index=True)
    event_type_id     = Column(Integer, ForeignKey("event_types.id", ondelete="CASCADE"), nullable=False)
    invitee_name      = Column(String(200), nullable=False)
    invitee_email     = Column(String(255), nullable=False)
    start_time        = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time          = Column(DateTime(timezone=True), nullable=False)
    status            = Column(String(20), nullable=False, default="active")
    notes             = Column(Text, nullable=True)
    cancel_reason     = Column(Text, nullable=True)
    guest_emails      = Column(Text, nullable=True)      # comma-separated guest emails
    custom_answers    = Column(Text, nullable=True)       # JSON string of custom question answers
    invitee_timezone  = Column(String(100), nullable=False, default="Asia/Kolkata")  # invitee's timezone
    rescheduled_from  = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    event_type = relationship("EventType", back_populates="bookings")


class SingleUseLink(Base):
    """One-time booking links that expire after a single use."""
    __tablename__ = "single_use_links"

    id            = Column(Integer, primary_key=True, index=True)
    event_type_id = Column(Integer, ForeignKey("event_types.id", ondelete="CASCADE"), nullable=False)
    token         = Column(String(64), unique=True, nullable=False, index=True)
    status        = Column(String(20), nullable=False, default="created")  # created, used, expired
    booking_id    = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    event_type = relationship("EventType", back_populates="single_use_links")


class CustomQuestion(Base):
    """Custom invitee questions attached to an event type."""
    __tablename__ = "custom_questions"

    id            = Column(Integer, primary_key=True, index=True)
    event_type_id = Column(Integer, ForeignKey("event_types.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(String(500), nullable=False)
    question_type = Column(String(20), nullable=False, default="text")  # text, textarea, select
    is_required   = Column(Boolean, nullable=False, default=False)
    options       = Column(Text, nullable=True)  # JSON array for select type
    sort_order    = Column(Integer, nullable=False, default=0)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    event_type = relationship("EventType", back_populates="custom_questions_rel")
