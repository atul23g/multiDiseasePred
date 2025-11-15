"""Prediction endpoints."""

from fastapi import APIRouter, Request, HTTPException, Depends
from prisma.fields import Json
from src.api.schemas import (
    PredictWithFeaturesRequest,
    PredictWithFeaturesResponse
)
from src.models.inference_router import predict_tabular
from src.scoring.health_score import compute_score
from src.api.deps import get_user_id
from src.db.client import prisma

router = APIRouter()


@router.post("/with_features", response_model=PredictWithFeaturesResponse)
async def predict_with_features(
    req: PredictWithFeaturesRequest,
    request: Request,
    user_id: str = Depends(get_user_id)
):
    """Predict with merged features."""
    # Convert Task enum to string for model
    task_str = req.task.value
    
    # Predict using inference router (expects string, not enum)
    pred_result = predict_tabular(task_str, req.features)
    
    label = int(pred_result["label"])
    proba = float(pred_result["probability"])
    
    # Clean features for health score (extract from lists)
    features_clean = {}
    for k, v in req.features.items():
        if isinstance(v, list):
            features_clean[k] = v[0] if len(v) > 0 else None
        else:
            features_clean[k] = v
    
    # Compute health score
    score, top_breakdown = compute_score(req.task.value, features_clean, proba)
    health_score = float(score)
    
    # Extract top contributors
    top_contributors = [k for k, _ in top_breakdown] if top_breakdown else []
    
    # Get warnings from prediction result if available
    warnings = pred_result.get("warnings", [])
    
    # Ensure Profile exists for user (required relation)
    try:
        await prisma.profile.upsert(
            where={"userId": user_id},
            data={
                "create": {"userId": user_id},
                "update": {}
            }
        )
    except Exception as e:
        # Do not proceed without a related Profile
        raise HTTPException(
            status_code=500,
            detail=f"Failed to ensure user profile: {str(e)}"
        )
    
    # Persist prediction
    # Convert to JSON-serializable format
    import json
    features_json = json.loads(json.dumps(req.features)) if req.features else {}
    contributors_json = json.loads(json.dumps(top_contributors)) if top_contributors else []
    warnings_json = json.loads(json.dumps(warnings)) if warnings else []
    
    # Build create payload using nested relation connects only
    create_data = {
        "task": req.task.value,
        "features": Json(features_json),
        "label": label,
        "probability": proba,
        "healthScore": health_score,
        "topContributors": Json(contributors_json),
        "warnings": Json(warnings_json),
        "Profile": {"connect": {"userId": user_id}},
    }
    if req.report_id:
        create_data["Report"] = {"connect": {"id": req.report_id}}

    try:
        pred = await prisma.prediction.create(data=create_data)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction.create failed: keys={list(create_data.keys())}, types: features={type(features_json).__name__}, topContributors={type(contributors_json).__name__}, warnings={type(warnings_json).__name__}; error={e}"
        )
    
    return PredictWithFeaturesResponse(
        task=req.task,
        label=label,
        probability=proba,
        health_score=health_score,
        top_contributors=top_contributors,
        warnings=warnings,
        prediction_id=pred.id
    )

