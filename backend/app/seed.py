# backend/app/seed.py
"""
Run this once to populate the database with a default user,
sample event types, availability schedule, and past/upcoming bookings.

Usage:
  cd backend
  python -m app.seed
"""
from datetime import datetime, timedelta
import pytz
from .database import SessionLocal, engine
from . import models

def seed():
    from .database import Base
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # ── Check if already seeded ──────────────────────────────
        if db.query(models.User).count() > 0:
            print("Database already seeded. Skipping.")
            return

        # ── Default Admin User ───────────────────────────────────
        user = models.User(
            id=1,
            name="Alex Johnson",
            email="alex@schedulr.app",
            username="alex",
            timezone="Asia/Kolkata",
        )
        db.add(user)
        db.flush()

        # ── Event Types ──────────────────────────────────────────
        et1 = models.EventType(
            user_id=1,
            name="30 Minute Meeting",
            slug="30-minute-meeting",
            duration=30,
            description="A quick 30-minute catch-up or intro call.",
            color="#7C3AED",
            location="Google Meet",
            is_active=True,
        )
        et2 = models.EventType(
            user_id=1,
            name="60 Minute Deep Dive",
            slug="60-minute-deep-dive",
            duration=60,
            description="An in-depth 1-hour session for detailed discussions.",
            color="#0EA5E9",
            location="Zoom",
            is_active=True,
        )
        et3 = models.EventType(
            user_id=1,
            name="15 Minute Intro Call",
            slug="15-minute-intro",
            duration=15,
            description="A brief 15-minute introduction.",
            color="#10B981",
            location="Phone Call",
            is_active=True,
        )
        db.add_all([et1, et2, et3])
        db.flush()

        # ── Availability Schedule ────────────────────────────────
        schedule = models.AvailabilitySchedule(
            user_id=1,
            name="Working hours",
            is_default=True,
            timezone="Asia/Kolkata",
        )
        db.add(schedule)
        db.flush()

        # Rules: Mon–Fri 9am–5pm, Sat–Sun unavailable
        # day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
        from datetime import time
        rules = [
            models.AvailabilityRule(schedule_id=schedule.id, day_of_week=0, is_available=False),  # Sun
            models.AvailabilityRule(schedule_id=schedule.id, day_of_week=1, is_available=True, start_time=time(9, 0), end_time=time(17, 0)),   # Mon
            models.AvailabilityRule(schedule_id=schedule.id, day_of_week=2, is_available=True, start_time=time(9, 0), end_time=time(17, 0)),   # Tue
            models.AvailabilityRule(schedule_id=schedule.id, day_of_week=3, is_available=True, start_time=time(9, 0), end_time=time(17, 0)),   # Wed
            models.AvailabilityRule(schedule_id=schedule.id, day_of_week=4, is_available=True, start_time=time(9, 0), end_time=time(17, 0)),   # Thu
            models.AvailabilityRule(schedule_id=schedule.id, day_of_week=5, is_available=True, start_time=time(9, 0), end_time=time(17, 0)),   # Fri
            models.AvailabilityRule(schedule_id=schedule.id, day_of_week=6, is_available=False),  # Sat
        ]
        db.add_all(rules)
        db.flush()

        # ── Sample Bookings ──────────────────────────────────────
        tz = pytz.timezone("Asia/Kolkata")
        now = datetime.now(tz)

        # Upcoming booking (2 days from now at 10:00 AM)
        future_start = now.replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=2)
        if future_start.weekday() >= 5:  # Skip weekend
            future_start += timedelta(days=2)
        future_start_utc = future_start.astimezone(pytz.utc)

        b1 = models.Booking(
            event_type_id=et1.id,
            invitee_name="Om Nawale",
            invitee_email="om@example.com",
            start_time=future_start_utc,
            end_time=future_start_utc + timedelta(minutes=30),
            status="active",
        )

        # Another upcoming booking
        future2 = future_start + timedelta(days=1, hours=2)
        if future2.weekday() >= 5:
            future2 += timedelta(days=2)
        b2 = models.Booking(
            event_type_id=et2.id,
            invitee_name="Priya Sharma",
            invitee_email="priya@example.com",
            start_time=future2.astimezone(pytz.utc),
            end_time=(future2 + timedelta(minutes=60)).astimezone(pytz.utc),
            status="active",
        )

        # Past booking (3 days ago)
        past_start = now.replace(hour=14, minute=0, second=0, microsecond=0) - timedelta(days=3)
        if past_start.weekday() >= 5:
            past_start -= timedelta(days=2)
        b3 = models.Booking(
            event_type_id=et1.id,
            invitee_name="Rahul Gupta",
            invitee_email="rahul@example.com",
            start_time=past_start.astimezone(pytz.utc),
            end_time=(past_start + timedelta(minutes=30)).astimezone(pytz.utc),
            status="active",
        )

        # Cancelled past booking
        past2 = now.replace(hour=11, minute=0, second=0, microsecond=0) - timedelta(days=7)
        b4 = models.Booking(
            event_type_id=et3.id,
            invitee_name="Sneha Patel",
            invitee_email="sneha@example.com",
            start_time=past2.astimezone(pytz.utc),
            end_time=(past2 + timedelta(minutes=15)).astimezone(pytz.utc),
            status="cancelled",
            cancel_reason="Scheduling conflict",
        )

        db.add_all([b1, b2, b3, b4])
        db.commit()
        print("[OK] Database seeded successfully!")
        print(f"   - 1 admin user")
        print(f"   - 3 event types")
        print(f"   - 1 availability schedule (Mon-Fri 9-5)")
        print(f"   - 4 sample bookings (2 upcoming, 1 past, 1 cancelled)")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
