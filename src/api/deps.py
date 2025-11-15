"""Common dependencies for API routes."""

import os
from fastapi import Request, HTTPException
from src.db.client import prisma


async def get_user_id(request: Request) -> str:
    """Get user ID from request state (set by auth middleware)."""
    # Check if auth is disabled for testing
    if os.getenv("DISABLE_AUTH", "false").lower() == "true":
        # Return test user ID if not set by middleware
        user_id = getattr(request.state, "user_id", "test-user-123")
        if not user_id:
            user_id = "test-user-123"
        return user_id
    
    # Normal authentication flow
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    return user_id


def get_db():
    """Get Prisma database client."""
    return prisma

