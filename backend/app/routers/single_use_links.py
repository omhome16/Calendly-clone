# backend/app/routers/single_use_links.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/api/single-use-links", tags=["Single Use Links"])


@router.get("/", response_model=List[schemas.SingleUseLinkResponse])
def list_single_use_links(db: Session = Depends(get_db)):
    """List all single-use links for the default admin user."""
    links = crud.get_single_use_links(db, user_id=1)
    return links


@router.post("/", response_model=schemas.SingleUseLinkResponse, status_code=status.HTTP_201_CREATED)
def create_single_use_link(data: schemas.SingleUseLinkCreate, db: Session = Depends(get_db)):
    """Create a single-use booking link for an event type."""
    event_type = crud.get_event_type_by_id(db, data.event_type_id)
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found")
    link = crud.create_single_use_link(db, data.event_type_id)
    return link


@router.delete("/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_single_use_link(link_id: int, db: Session = Depends(get_db)):
    """Delete a single-use link."""
    if not crud.delete_single_use_link(db, link_id):
        raise HTTPException(status_code=404, detail="Link not found")
