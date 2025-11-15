"""FastAPI main application with auth and database."""

import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from src.api.auth import auth_middleware
from src.db.client import prisma
from src.api.routes import features, predict, triage, session
from src.api.routes import history
from src.api.routes import auth_clerk

# Load environment variables
env_path = Path(__file__).parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

# Import ingest route
from src.api.routes import ingest

app = FastAPI(
    title="Disease AI API",
    description="Multi-disease prediction system with health scoring and LLM triage",
    version="0.2.0",
)

# Production-ready middleware configuration
# CORS: configurable via ALLOWED_ORIGINS (comma-separated). Defaults to * for dev.
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
allow_all = allowed_origins_env.strip() == "*"
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()] if not allow_all else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trusted hosts: set via ALLOWED_HOSTS (comma-separated). Example: "api.example.com,.example.com"
allowed_hosts_env = os.getenv("ALLOWED_HOSTS", "*")
hosts_all = allowed_hosts_env.strip() == "*"
if not hosts_all:
    allowed_hosts = [h.strip() for h in allowed_hosts_env.split(",") if h.strip()]
    if allowed_hosts:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

# Optional HTTPS redirect in production
if os.getenv("FORCE_HTTPS", "false").lower() == "true":
    app.add_middleware(HTTPSRedirectMiddleware)

# Auth middleware (must be after CORS)
app.middleware("http")(auth_middleware)


@app.on_event("startup")
async def startup():
    """Initialize database connection on startup."""
    try:
        await prisma.connect()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Database connect failed on startup: {e}")


@app.on_event("shutdown")
async def shutdown():
    """Close database connection on shutdown."""
    try:
        await prisma.disconnect()
    except Exception:
        pass


# Include routers
app.include_router(features.router, prefix="/features", tags=["features"])
app.include_router(predict.router, prefix="/predict", tags=["predict"])
app.include_router(triage.router, prefix="/triage", tags=["triage"])
app.include_router(session.router, prefix="/session", tags=["session"])
app.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
app.include_router(history.router, prefix="/history", tags=["history"]) 
app.include_router(auth_clerk.router, prefix="/auth", tags=["auth"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Disease AI API",
        "status": "ok",
        "version": "0.2.0"
    }


@app.get("/health")
async def health():
    """Health check endpoint (public, no auth required)."""
    # Database connection is managed in startup/shutdown events
    # Just check if Prisma client is available
    db_status = "available" if prisma else "unavailable"
    
    return {
        "status": "ok",
        "database": db_status,
        "version": "0.2.0"
    }

