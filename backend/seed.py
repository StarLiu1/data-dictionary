"""
Import metadata.json into PostgreSQL.

Usage:
    python -m backend.seed outputs/metadata.json --name "deid.derived"
"""

import json
import sys
from .database import SessionLocal, engine, Base
from .models import Dictionary, AdminUser

def seed_metadata(json_path: str, name: str):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    with open(json_path) as f:
        metadata = json.load(f)

    # Upsert dictionary
    existing = db.query(Dictionary).filter(Dictionary.name == name).first()
    if existing:
        existing.metadata_json = metadata
        existing.schema_name = metadata.get("schema", name)
        print(f"Updated existing dictionary: {name}")
    else:
        d = Dictionary(name=name, schema_name=metadata.get("schema", name), metadata_json=metadata)
        db.add(d)
        print(f"Created new dictionary: {name}")

    db.commit()
    db.close()

def seed_initial_admin(github_username: str):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    existing = db.query(AdminUser).filter(AdminUser.github_username == github_username).first()
    if not existing:
        admin = AdminUser(github_username=github_username, role="superadmin", added_by="system")
        db.add(admin)
        db.commit()
        print(f"Added initial admin: {github_username}")
    else:
        print(f"Admin already exists: {github_username}")

    db.close()

if __name__ == "__main__":
    json_path = sys.argv[1] if len(sys.argv) > 1 else "outputs/metadata.json"
    name = sys.argv[2] if len(sys.argv) > 2 else "deid.derived"
    seed_metadata(json_path, name)

    # Add yourself as the first superadmin
    if len(sys.argv) > 3:
        seed_initial_admin(sys.argv[3])