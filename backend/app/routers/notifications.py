# backend/app/routers/notifications.py
"""Email notification endpoints. Uses Resend API via HTTP to bypass SMTP port blocking."""
import os
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
import logging

from ..database import get_db
from .. import crud

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])
logger = logging.getLogger(__name__)

# Resend API config from environment
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
EMAIL_ENABLED = bool(RESEND_API_KEY)


class NotificationPayload(BaseModel):
    booking_id: int
    notification_type: str  # "confirmation" | "cancellation" | "reschedule" | "reschedule_request"


def send_email(to_email: str, subject: str, body: str) -> dict:
    """Send email via Resend HTTP API. Returns a dict with status and any error details."""
    if not EMAIL_ENABLED:
        logger.info(f"\n{'='*50}\nEMAIL (Resend not configured - logged to console)\nTo: {to_email}\nSubject: {subject}\n{'-'*50}\n{body}\n{'='*50}")
        return {"sent": False, "error": None}

    try:
        payload = {
            "from": "Calendly Clone <onboarding@resend.dev>",
            "to": [to_email],
            "subject": subject,
            "text": body
        }
        
        headers = {
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json"
        }
        
        response = httpx.post(
            "https://api.resend.com/emails", 
            json=payload, 
            headers=headers,
            timeout=10.0
        )
        
        # Raise an exception if the API returns a 4xx or 5xx error
        response.raise_for_status()
        
        logger.info(f"Email sent successfully to {to_email}: {subject}")
        return {"sent": True, "error": None}
        
    except httpx.HTTPStatusError as e:
        error_msg = f"Resend API HTTP Error: {e.response.status_code} - {e.response.text}"
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
        "email_configured": EMAIL_ENABLED,
        "api_error": result.get("error"),
        "message": "Email sent via API" if result["sent"] else (
            result.get("error") or "Email logged to console (configure RESEND_API_KEY in .env)"
        ),
    }


@router.get("/test")
def test_email():
    """Test endpoint to verify Resend API configuration works."""
    if not EMAIL_ENABLED:
        return {
            "status": "not_configured",
            "message": "Resend is not configured. Add RESEND_API_KEY in .env or settings to enable live emails.",
        }
        
    result = send_email("delivered@resend.dev", "Calendly Clone - Test Email", "This is a test email from Calendly Clone hitting the Resend API!")
    
    return {
        "status": "sent" if result["sent"] else "failed",
        "resend_key_length": len(RESEND_API_KEY),
        "error": result.get("error"),
    }
