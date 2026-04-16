# backend/app/routers/event_types.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/api/event-types", tags=["Event Types"])


@router.get("/", response_model=List[schemas.EventTypeResponse])
def list_event_types(db: Session = Depends(get_db)):
    """List all event types for the default admin user."""
    return crud.get_event_types(db, user_id=1)


@router.get("/{event_type_id}", response_model=schemas.EventTypeResponse)
def get_event_type(event_type_id: int, db: Session = Depends(get_db)):
    et = crud.get_event_type_by_id(db, event_type_id)
    if not et:
        raise HTTPException(status_code=404, detail="Event type not found")
    return et


@router.post("/", response_model=schemas.EventTypeResponse, status_code=status.HTTP_201_CREATED)
def create_event_type(data: schemas.EventTypeCreate, db: Session = Depends(get_db)):
    return crud.create_event_type(db, data, user_id=1)


@router.patch("/{event_type_id}", response_model=schemas.EventTypeResponse)
def update_event_type(
    event_type_id: int,
    data: schemas.EventTypeUpdate,
    db: Session = Depends(get_db),
):
    et = crud.update_event_type(db, event_type_id, data)
    if not et:
        raise HTTPException(status_code=404, detail="Event type not found")
    return et


@router.delete("/{event_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event_type(event_type_id: int, db: Session = Depends(get_db)):
    success = crud.delete_event_type(db, event_type_id)
    if not success:
        raise HTTPException(status_code=404, detail="Event type not found")
