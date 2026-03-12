from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import engine, Base
from .routers import metadata, admin, auth

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Data Dictionary API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(metadata.router, prefix="/api/metadata", tags=["metadata"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

# Serve React build as static files (after API routes)
# app.mount("/", StaticFiles(directory="dist", html=True), name="spa")