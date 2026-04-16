# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine
from . import models
from .routers import event_types, availability, bookings, slots, single_use_links, holidays, notifications

# Create all DB tables on startup (alternatively use Alembic migrations)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Calendly API",
    description="Calendly Clone Backend — FastAPI + PostgreSQL",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(event_types.router)
app.include_router(availability.router)
app.include_router(bookings.router)
app.include_router(slots.router)
app.include_router(single_use_links.router)
app.include_router(holidays.router)
app.include_router(notifications.router)


@app.get("/")
def root():
    return {"message": "Calendly API is running!", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
