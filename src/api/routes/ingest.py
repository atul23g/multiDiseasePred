"""PDF ingestion endpoint (Phase 6 + 7)."""

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from src.api.deps import get_user_id
from src.db.client import prisma
from prisma import Json
from src.utils.enums import Task
from pathlib import Path
import tempfile
import os

router = APIRouter()


def _strip_nulls(obj):
    """Recursively remove null bytes from strings within nested structures."""
    try:
        if obj is None:
            return None
        if isinstance(obj, str):
            # Remove \x00 which Postgres cannot store in text/JSON
            return obj.replace("\x00", "")
        if isinstance(obj, (int, float, bool)):
            return obj
        if isinstance(obj, list):
            return [_strip_nulls(x) for x in obj]
        if isinstance(obj, tuple):
            return tuple(_strip_nulls(x) for x in obj)
        if isinstance(obj, dict):
            return {k: _strip_nulls(v) for k, v in obj.items()}
    except Exception:
        pass
    return obj

@router.post("/report")
async def ingest_report(
    file: UploadFile = File(...),
    task: str = Query("heart"),
    user_id: str = Depends(get_user_id)
):
    """
    Upload PDF report and extract features.
    
    Returns extracted features, missing fields, and report_id for later completion.
    """
    # Normalize and validate task parameter to handle trailing whitespace/newlines
    task_input = (task or "").strip().lower()
    try:
        task_enum = Task(task_input)
    except Exception:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid task '{task}'. Expected one of: {[t.value for t in Task]}"
        )
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_path = tmp_file.name
    
    try:
        # Extract text and parse using ETL pipeline
        from src.etl.pdf_ingest import pdf_to_text, pdf_to_ocr_tokens
        from src.etl.report_parse import parse_text_to_pairs, parse_tokens_to_pairs, coalesce_pairs, parse_with_advanced_extractor
        from src.etl.map_to_features import map_features
        from src.models.inference_router import _load_tab
        
        # Use advanced extraction pipeline first
        advanced_result = parse_with_advanced_extractor(tmp_path)
        
        # Extract text and tokens from PDF (multi-page safe) - always do this
        text = pdf_to_text(tmp_path)
        ocr_tokens = pdf_to_ocr_tokens(tmp_path)
        
        # Fallback to traditional methods if advanced extraction failed
        if not advanced_result['extracted']:
            if not text.strip():
                raise HTTPException(
                    status_code=400,
                    detail="Could not extract text from PDF even after OCR attempt. Ensure the PDF is readable or install Tesseract for OCR (brew install tesseract on macOS)."
                )
            
            # Parse lab values from text and OCR tokens
            pairs = parse_text_to_pairs(text)
            token_pairs = parse_tokens_to_pairs(ocr_tokens)
            pairs.extend(token_pairs)
            kv = coalesce_pairs(pairs)  # {lab_name: (value, unit)}
            
            # Use traditional extraction results
            feats_dict = advanced_result['extracted']
            extracted_meta = advanced_result['extracted_meta']
            extraction_methods = ['traditional']
        else:
            # Use advanced extraction results
            feats_dict = advanced_result['extracted']
            extracted_meta = advanced_result['extracted_meta']
            extraction_methods = advanced_result['extraction_methods']
            text = advanced_result['text']
            kv = {}  # Will be populated below if needed
            
            # Convert to kv format for compatibility
            for lab, meta in extracted_meta.items():
                kv[lab.lower()] = (meta['value'], meta.get('unit', ''))
        
        # If general mode, skip model feature mapping and return all parsed pairs
        if task_enum == Task.GENERAL:
            feats_dict = {}
            for k, tup in kv.items():
                try:
                    feats_dict[k] = float(tup[0])
                except Exception:
                    feats_dict[k] = tup[0]
            missing = []
            warnings = []
            feats = list(feats_dict.keys())
        else:
            # Load model to get required features
            try:
                model, preproc, feats = _load_tab(task_enum.value)
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to load model for task {task_enum.value}: {str(e)}"
                )
            
            # Map parsed labs to model features
            feats_dict, missing, warnings = map_features(task_enum.value, kv, feats)

        # Build lightweight extractedMeta for UI confidence (placeholder until full pipeline)
        # Use advanced extraction confidence if available
        if extraction_methods != ['traditional'] and extracted_meta:
            # Use the advanced extraction metadata
            pass  # Already populated above
        else:
            # Traditional extraction metadata
            extracted_meta = {}
            try:
                for f in feats:
                    val = feats_dict.get(f)
                    # naive source detection
                    source = 'parsed' if f.lower() in kv else 'imputed'
                    confidence = 0.92 if source == 'parsed' else 0.50
                    unit = None
                    if f.lower() in kv:
                        tup = kv.get(f.lower())
                        if isinstance(tup, (tuple, list)) and len(tup) >= 2:
                            unit = tup[1]
                    extracted_meta[f] = {
                        'value': val,
                        'unit': unit,
                        'confidence': confidence,
                        'source': source,
                    }
            except Exception:
                extracted_meta = {k: {'value': v, 'confidence': 0.5, 'source': 'unknown'} for k, v in (feats_dict or {}).items()}
        
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
        
        # Create report record in database
        # Prisma JSON fields accept Python dict/list directly
        import json
        try:
            # Convert to JSON-serializable format
            extracted_json = json.loads(json.dumps(feats_dict)) if feats_dict else {}
            missing_json = json.loads(json.dumps(missing)) if missing else []
            warnings_json = json.loads(json.dumps(warnings)) if warnings else []
            
            # Sanitize to avoid Postgres "unsupported Unicode escape" (e.g., \u0000)
            safe_text = _strip_nulls(text)
            safe_tokens = _strip_nulls(ocr_tokens)

            report = await prisma.report.create(
                data={
                    "userId": user_id,
                    "task": task_enum.value,
                    "rawFilename": file.filename,
                    "extracted": Json(extracted_json),
                    "missingFields": Json(missing_json),
                    "warnings": Json(warnings_json),
                    # Persist artifacts for history and UI
                    "rawOCR": Json({"text": safe_text, "tokens": safe_tokens}),
                    "extractedMeta": Json(extracted_meta),
                }
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save report to database: {str(e)}"
            )
        
        return {
            "report_id": report.id,
            "extracted": feats_dict,
            "missing_fields": missing,
            "warnings": warnings,
            "extracted_meta": extracted_meta,
            "parsed_keys": list(kv.keys()),
            "extracted_text_length": len(text),
            "pages": len(ocr_tokens.get('pages', [])) if isinstance(ocr_tokens, dict) else 0,
            "task": task_enum.value,
            "extraction_methods": extraction_methods,
            "overall_confidence": extracted_meta.get('overall_confidence', 0.0) if isinstance(extracted_meta, dict) else 0.0
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing PDF: {str(e)}"
        )
    finally:
        # Clean up temporary file
        if os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

