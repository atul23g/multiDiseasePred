"""Feature schema and completion endpoints."""

from fastapi import APIRouter, Request, HTTPException, Depends
from src.api.schemas import (
    FeatureSchemaResponse,
    FeatureCompleteRequest,
    FeatureCompleteResponse,
    schema_for
)
from src.utils.enums import Task
from src.utils.merge import merge_features
from src.api.deps import get_user_id, get_db
from src.db.client import prisma

router = APIRouter()


@router.get("/schema", response_model=FeatureSchemaResponse)
async def get_schema(task: Task):
    """Get feature schema for a task."""
    # Use feature_schema as field name to avoid shadowing BaseModel.schema
    return FeatureSchemaResponse(task=task, feature_schema=schema_for(task))


@router.post("/complete", response_model=FeatureCompleteResponse)
async def complete_features(
    req: FeatureCompleteRequest,
    request: Request,
    user_id: str = Depends(get_user_id)
):
    """Complete features by merging extracted and user inputs."""
    extracted = {}
    
    # Load extracted features from report if report_id provided
    if req.report_id:
        rpt = await prisma.report.find_first(
            where={"id": req.report_id, "userId": user_id}
        )
        if not rpt:
            raise HTTPException(status_code=404, detail="Report not found")
        extracted = dict(rpt.extracted or {})
    
    # Merge extracted with user inputs
    merged, still_missing = merge_features(
        extracted,
        req.user_inputs,
        prefer_user=True
    )
    
    # Enforce schema order
    schema = schema_for(req.task)
    ordered = {k: merged.get(k, None) for k in schema.keys()}
    
    notes = []
    if req.user_inputs:
        notes.append("User values override extracted values")
    
    return FeatureCompleteResponse(
        features_ready=ordered,
        still_missing=still_missing,
        notes=notes
    )

