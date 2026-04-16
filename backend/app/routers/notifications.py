# backend/app/routers/notifications.py
"""Email notification endpoints. Supports SMTP via .env or falls back to console logging."""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
import logging

from ..database import get_db
from .. import crud

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])
logger = logging.getLogger(__name__)

# SMTP config from environment
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").replace(" ", "")  # Strip spaces from app passwords
SMTP_FROM = os.getenv("SMTP_FROM", "")
SMTP_ENABLED = bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


class NotificationPayload(BaseModel):
    booking_id: int
    notification_type: str  # "confirmation" | "cancellation" | "reschedule" | "reschedule_request"


def send_email(to_email: str, subject: str, body: str) -> dict:
    """Send email via SMTP. Returns a dict with status and any error details."""
    if not SMTP_ENABLED:
        logger.info(f"\n{'='*50}\nEMAIL (SMTP not configured - logged to console)\nTo: {to_email}\nSubject: {subject}\n{'-'*50}\n{body}\n{'='*50}")
        return {"sent": False, "error": None}

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = SMTP_FROM or SMTP_USER
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Email sent to {to_email}: {subject}")
        return {"sent": True, "error": None}
    except smtplib.SMTPAuthenticationError as e:
        error_msg = f"SMTP Authentication failed: {e}"
        logger.error(error_msg)
        return {"sent": False, "error": error_msg}
    except smtplib.SMTPException as e:
        error_msg = f"SMTP error: {e}"
        logger.error(error_msg)
        return {"sent": False, "error": error_msg}
    except Exception as e:
        error_msg = f"Failed to send email: {type(e).__name__}: {e}"
        logger.error(error_msg)
        return {"sent": False, "error": error_msg}


@router.post("/send")
def send_notification(payload: NotificationPayload, db: Session = Depends(get_db)):
    """Send an email notification for a booking event."""
    booking = crud.get_booking_by_id(db, payload.booking_id)
    if not booking:
        return {"status": "error", "message": "Booking not found"}

    event_type = booking.event_type
    invitee = booking.invitee_name
    email = booking.invitee_email
    start = booking.start_time.strftime("%B %d, %Y at %I:%M %p UTC")

    templates = {
        "confirmation": {
            "subject": f"Meeting Confirmed: {event_type.name}",
            "body": f"""Hi {invitee},

Your meeting has been confirmed!

Event: {event_type.name}
When: {start}
Duration: {event_type.duration} minutes
Location: {event_type.location}

You will receive a calendar invite shortly.

Best regards,
Calendly Clone"""
        },
        "cancellation": {
            "subject": f"Meeting Cancelled: {event_type.name}",
            "body": f"""Hi {invitee},

Your meeting has been cancelled.

Event: {event_type.name}
Originally scheduled: {start}

If you'd like to rebook, please visit the scheduling page.

Best regards,
Calendly Clone"""
        },
        "reschedule": {
            "subject": f"Meeting Rescheduled: {event_type.name}",
            "body": f"""Hi {invitee},

Your meeting has been rescheduled.

Event: {event_type.name}
New time: {start}
Duration: {event_type.duration} minutes

Best regards,
Om Nawale"""
        },
        "reschedule_request": {
            "subject": f"Request to Reschedule: {event_type.name}",
            "body": f"""Hi {invitee},

The host has requested to reschedule your upcoming meeting.

Event: {event_type.name}
Originally scheduled: {start}

Please visit the booking page to select a new time that works for you.

Best regards,
Calendly Clone"""
        },
    }

    template = templates.get(payload.notification_type)
    if not template:
        return {"status": "error", "message": f"Unknown notification type: {payload.notification_type}"}

    result = send_email(email, template["subject"], template["body"])

    return {
        "status": "sent" if result["sent"] else "logged",
        "to": email,
        "subject": template["subject"],
        "notification_type": payload.notification_type,
        "smtp_configured": SMTP_ENABLED,
        "smtp_error": result.get("error"),
        "message": "Email sent via SMTP" if result["sent"] else (
            result.get("error") or "Email logged to console (configure SMTP in .env)"
        ),
    }


@router.get("/test")
def test_email():
    """Test endpoint to verify SMTP configuration works."""
    if not SMTP_ENABLED:
        return {
            "status": "not_configured",
            "smtp_host": SMTP_HOST or "(empty)",
            "smtp_user": SMTP_USER or "(empty)",
            "smtp_password_set": bool(SMTP_PASSWORD),
            "message": "SMTP is not configured. Fill SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in .env",
        }
    result = send_email(SMTP_USER, "Calendly Clone - Test Email", "This is a test email from Calendly Clone. If you received this, SMTP is working correctly!")
    return {
        "status": "sent" if result["sent"] else "failed",
        "smtp_host": SMTP_HOST,
        "smtp_port": SMTP_PORT,
        "smtp_user": SMTP_USER,
        "error": result.get("error"),
    }
