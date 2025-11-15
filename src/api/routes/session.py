"""Session management endpoints."""

from fastapi import APIRouter, Request, HTTPException, Depends
from src.api.schemas import SessionSubmitRequest, SessionSubmitResponse
from src.api.deps import get_user_id
from src.db.client import prisma
from prisma import Json

router = APIRouter()


@router.post("/submit", response_model=SessionSubmitResponse)
async def session_submit(
    req: SessionSubmitRequest,
    request: Request,
    user_id: str = Depends(get_user_id)
):
    """Submit session data (prediction + triage)."""
    pred_id = req.prediction_id
    
    if not pred_id:
        raise HTTPException(
            status_code=400,
            detail="prediction_id is required"
        )
    
    # Verify prediction belongs to user
    pred = await prisma.prediction.find_first(
        where={"id": pred_id, "userId": user_id}
    )
    if not pred:
        raise HTTPException(
            status_code=404,
            detail="Prediction not found"
        )
    
    # Persist triage if present
    if req.triage:
        await prisma.triagenote.create(
            data={
                "complaint": req.complaint,
                "triageSummary": req.triage.get("triage_summary", ""),
                "followups": Json(req.triage.get("followups", [])),
                "modelName": req.triage.get("model_name"),
                "Prediction": {"connect": {"id": pred_id}},
                "Profile": {"connect": {"userId": user_id}},
            }
        )
    
    return SessionSubmitResponse(ok=True, prediction_id=pred_id)


