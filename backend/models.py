from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from .database import Base

class Dictionary(Base):
    __tablename__ = "dictionaries"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False)       # e.g. "deid.derived"
    schema_name = Column(String(255), nullable=False)              # e.g. "deid.derived"
    metadata_json = Column(JSONB, nullable=False)                  # the full metadata.json content
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True)
    github_username = Column(String(255), unique=True, nullable=False)
    role = Column(String(50), default="admin")                     # "admin" | "superadmin"
    added_by = Column(String(255))
    created_at = Column(DateTime, server_default=func.now())

class EditHistory(Base):
    __tablename__ = "edit_history"

    id = Column(Integer, primary_key=True)
    dictionary_id = Column(Integer, ForeignKey("dictionaries.id"), nullable=False)
    table_name = Column(String(255))
    column_name = Column(String(255))                              # null for table-level edits
    field_name = Column(String(255), nullable=False)               # "comment", "description", "source", etc.
    old_value = Column(Text)
    new_value = Column(Text)
    edited_by = Column(String(255), nullable=False)                # GitHub username
    github_issue_number = Column(Integer)                          # if this edit was linked to an issue
    created_at = Column(DateTime, server_default=func.now())