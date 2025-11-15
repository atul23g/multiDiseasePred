"""History endpoints for reports and predictions."""

from fastapi import APIRouter, Depends, HTTPException
from src.db.client import prisma
from src.api.deps import get_user_id

router = APIRouter()

@router.get("/reports")
async def get_reports(user_id: str = Depends(get_user_id)):
    try:
        rows = await prisma.report.find_many(
            where={"userId": user_id},
            order={'createdAt': 'desc'},
            take=50,
        )
        # Prisma returns Python objects with dict() via .model_dump if pydantic. Here we convert manually
        out = []
        for r in rows:
            out.append({
                'id': r.id,
                'task': r.task,
                'rawFilename': r.rawFilename,
                'extracted': r.extracted,
                'missingFields': r.missingFields,
                'warnings': r.warnings,
                'rawOCR': getattr(r, 'rawOCR', None),
                'extractedMeta': getattr(r, 'extractedMeta', None),
                'createdAt': r.createdAt.isoformat() if getattr(r, 'createdAt', None) else None,
            })
        return out
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {e}")

@router.get("/predictions")
async def get_predictions(user_id: str = Depends(get_user_id)):
    try:
        rows = await prisma.prediction.find_many(
            where={"userId": user_id},
            order={'createdAt': 'desc'},
            take=50,
            include={"Report": True},
        )
        out = []
        for p in rows:
            out.append({
                'id': p.id,
                'task': p.task,
                'features': p.features,
                'label': p.label,
                'probability': p.probability,
                'healthScore': p.healthScore,
                'topContributors': p.topContributors,
                'warnings': p.warnings,
                'reportId': p.reportId,
                'createdAt': p.createdAt.isoformat() if getattr(p, 'createdAt', None) else None,
                'report': {
                    'id': p.Report.id,
                    'rawFilename': p.Report.rawFilename,
                    'task': p.Report.task,
                } if getattr(p, 'Report', None) else None,
            })
        return out
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch predictions: {e}")
