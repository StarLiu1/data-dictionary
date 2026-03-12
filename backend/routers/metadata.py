from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Dictionary

router = APIRouter()

@router.get("/")
def list_dictionaries(db: Session = Depends(get_db)):
    """List all available data dictionaries."""
    dicts = db.query(Dictionary).all()
    return [{"id": d.id, "name": d.name, "schema": d.schema_name, "updated_at": d.updated_at} for d in dicts]

@router.get("/{dict_id}")
def get_dictionary(dict_id: int, db: Session = Depends(get_db)):
    """Get full metadata for a dictionary."""
    d = db.query(Dictionary).filter(Dictionary.id == dict_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dictionary not found")
    return d.metadata_json

@router.get("/{dict_id}/tables/{table_name}")
def get_table(dict_id: int, table_name: str, db: Session = Depends(get_db)):
    """Get metadata for a specific table."""
    d = db.query(Dictionary).filter(Dictionary.id == dict_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dictionary not found")
    for table in d.metadata_json.get("tables", []):
        if table["table_name"] == table_name:
            return table
    raise HTTPException(status_code=404, detail="Table not found")