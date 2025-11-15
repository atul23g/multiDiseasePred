"""Clerk auth sync endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from src.db.client import prisma

router = APIRouter()


class ClerkSyncReq(BaseModel):
    clerk_id: str
    email: EmailStr | None = None


class ClerkSyncResp(BaseModel):
    ok: bool
    user_id: str


@router.post("/clerk_sync", response_model=ClerkSyncResp)
async def clerk_sync(req: ClerkSyncReq):
    """
    Idempotently ensure a Profile row exists for this Clerk user.
    Stores minimal fields compatible with current schema: userId + email.
    """
    if not req.clerk_id:
        raise HTTPException(status_code=400, detail="clerk_id is required")

    # Upsert behavior: try find, else create
    prof = await prisma.profile.find_unique(where={"userId": req.clerk_id})
    if prof is None:
        prof = await prisma.profile.create(
            data={
                "userId": req.clerk_id,
                "email": req.email,
            }
        )
    return ClerkSyncResp(ok=True, user_id=prof.userId)
