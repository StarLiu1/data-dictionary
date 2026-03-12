from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..models import Dictionary, EditHistory, AdminUser
from .auth import require_admin

router = APIRouter()

class MetadataEdit(BaseModel):
    field_name: str          # "comment", "data_type", "is_nullable", "source", "description", etc.
    new_value: str
    github_issue_number: Optional[int] = None

@router.put("/{dict_id}/tables/{table_name}/columns/{column_name}")
async def edit_column(
    dict_id: int, table_name: str, column_name: str,
    edit: MetadataEdit,
    auth_info: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Edit a column field (admin only)."""
    d = db.query(Dictionary).filter(Dictionary.id == dict_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dictionary not found")

    # Find and update the column in the JSONB
    metadata = d.metadata_json
    updated = False
    for table in metadata.get("tables", []):
        if table["table_name"] == table_name:
            for col in table.get("columns", []):
                if col["column_name"] == column_name:
                    old_value = col.get(edit.field_name, "")
                    col[edit.field_name] = edit.new_value
                    updated = True

                    # Record edit history
                    history = EditHistory(
                        dictionary_id=dict_id,
                        table_name=table_name,
                        column_name=column_name,
                        field_name=edit.field_name,
                        old_value=str(old_value),
                        new_value=edit.new_value,
                        edited_by=auth_info["user"]["login"],
                        github_issue_number=edit.github_issue_number,
                    )
                    db.add(history)
                    break
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Column not found")

    # Write updated JSONB back
    from sqlalchemy import update
    db.execute(
        update(Dictionary)
        .where(Dictionary.id == dict_id)
        .values(metadata_json=metadata)
    )
    db.commit()

    return {"status": "updated", "table": table_name, "column": column_name, "field": edit.field_name}

class TableEdit(BaseModel):
    field_name: str          # "Comment", "description", etc.
    new_value: str
    github_issue_number: Optional[int] = None

@router.put("/{dict_id}/tables/{table_name}")
async def edit_table(
    dict_id: int, table_name: str,
    edit: TableEdit,
    auth_info: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Edit a table-level field (admin only)."""
    d = db.query(Dictionary).filter(Dictionary.id == dict_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dictionary not found")

    metadata = d.metadata_json
    updated = False
    for table in metadata.get("tables", []):
        if table["table_name"] == table_name:
            old_value = table.get("detail", {}).get(edit.field_name, "")
            if "detail" not in table:
                table["detail"] = {}
            table["detail"][edit.field_name] = edit.new_value
            updated = True

            history = EditHistory(
                dictionary_id=dict_id,
                table_name=table_name,
                field_name=edit.field_name,
                old_value=str(old_value),
                new_value=edit.new_value,
                edited_by=auth_info["user"]["login"],
                github_issue_number=edit.github_issue_number,
            )
            db.add(history)
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Table not found")

    from sqlalchemy import update
    db.execute(
        update(Dictionary)
        .where(Dictionary.id == dict_id)
        .values(metadata_json=metadata)
    )
    db.commit()

    return {"status": "updated", "table": table_name, "field": edit.field_name}

# --- Admin user management (superadmin only) ---

class AddAdminRequest(BaseModel):
    github_username: str
    role: str = "admin"

@router.get("/users")
async def list_admins(auth_info: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """List all admin users."""
    admins = db.query(AdminUser).all()
    return [{"id": a.id, "github_username": a.github_username, "role": a.role, "added_by": a.added_by, "created_at": a.created_at} for a in admins]

@router.post("/users")
async def add_admin(req: AddAdminRequest, auth_info: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Add a new admin user."""
    existing = db.query(AdminUser).filter(AdminUser.github_username == req.github_username).first()
    if existing:
        raise HTTPException(status_code=409, detail="User is already an admin")
    admin = AdminUser(
        github_username=req.github_username,
        role=req.role,
        added_by=auth_info["user"]["login"],
    )
    db.add(admin)
    db.commit()
    return {"status": "added", "github_username": req.github_username, "role": req.role}

@router.delete("/users/{github_username}")
async def remove_admin(github_username: str, auth_info: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Remove an admin user."""
    admin = db.query(AdminUser).filter(AdminUser.github_username == github_username).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    db.delete(admin)
    db.commit()
    return {"status": "removed", "github_username": github_username}

# --- Edit history ---

@router.get("/history")
async def get_edit_history(
    dict_id: int = None, table_name: str = None, limit: int = 50,
    auth_info: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get edit history, optionally filtered by dictionary or table."""
    query = db.query(EditHistory).order_by(EditHistory.created_at.desc())
    if dict_id:
        query = query.filter(EditHistory.dictionary_id == dict_id)
    if table_name:
        query = query.filter(EditHistory.table_name == table_name)
    return query.limit(limit).all()