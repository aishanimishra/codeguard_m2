"""
Module 2 – Public File Upload Analyser
No authentication required. Accepts .py file uploads or raw code paste.
Results are cached in S3 (if configured) and metrics pushed to CloudWatch.
"""
import os
import uuid
import json
import tempfile
import time
import logging
from pathlib import Path
from datetime import datetime, timezone

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.services.analyser import run_pylint_on_dir

logger = logging.getLogger(__name__)

router = APIRouter()

# ── AWS clients (fail gracefully if not configured) ──────────────────────────

def _s3():
    """Return S3 client or None if AWS not configured."""
    try:
        return boto3.client(
            "s3",
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )
    except Exception:
        return None

def _cw():
    """Return CloudWatch client or None if AWS not configured."""
    try:
        return boto3.client(
            "cloudwatch",
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )
    except Exception:
        return None

S3_BUCKET = os.getenv("UPLOAD_RESULTS_BUCKET", "")     # e.g. codeguard-results
CW_NAMESPACE = os.getenv("CW_NAMESPACE", "CodeGuard")


# ── CloudWatch metrics helper ─────────────────────────────────────────────────

def _push_metrics(score: float, total_issues: int, duration_ms: float, file_name: str):
    """Push analysis metrics to CloudWatch (best-effort)."""
    cw = _cw()
    if not cw:
        return
    dims = [{"Name": "Service", "Value": "UploadAnalyser"}]
    try:
        cw.put_metric_data(
            Namespace=CW_NAMESPACE,
            MetricData=[
                {"MetricName": "QualityScore",   "Value": score,        "Unit": "None",         "Dimensions": dims},
                {"MetricName": "TotalIssues",    "Value": total_issues, "Unit": "Count",        "Dimensions": dims},
                {"MetricName": "AnalysisDuration","Value": duration_ms, "Unit": "Milliseconds", "Dimensions": dims},
                {"MetricName": "AnalysisCount",  "Value": 1,            "Unit": "Count",        "Dimensions": dims},
            ],
        )
        logger.info("CloudWatch metrics pushed for %s", file_name)
    except (BotoCoreError, ClientError) as e:
        logger.warning("CloudWatch push failed (non-fatal): %s", e)


# ── S3 result caching ─────────────────────────────────────────────────────────

def _save_to_s3(result_id: str, payload: dict) -> str | None:
    """
    Persist the full analysis JSON to S3.
    Returns the S3 key, or None if S3 is not configured / fails.
    """
    if not S3_BUCKET:
        return None
    s3 = _s3()
    if not s3:
        return None
    key = f"uploads/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{result_id}.json"
    try:
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=json.dumps(payload),
            ContentType="application/json",
            ServerSideEncryption="AES256",
            Tagging="source=upload-analyser",
        )
        logger.info("Result saved to s3://%s/%s", S3_BUCKET, key)
        return key
    except (BotoCoreError, ClientError) as e:
        logger.warning("S3 save failed (non-fatal): %s", e)
        return None


def _get_from_s3(result_id: str) -> dict | None:
    """Retrieve a cached result from S3 by its ID."""
    if not S3_BUCKET:
        return None
    s3 = _s3()
    if not s3:
        return None
    # Search today's prefix first, then scan last 7 days
    for days_ago in range(7):
        from datetime import timedelta
        d = datetime.now(timezone.utc) - timedelta(days=days_ago)
        key = f"uploads/{d.strftime('%Y/%m/%d')}/{result_id}.json"
        try:
            obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
            return json.loads(obj["Body"].read())
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                continue
            logger.warning("S3 get failed: %s", e)
            return None
    return None


# ── Helpers ───────────────────────────────────────────────────────────────────

MAX_FILE_SIZE = 1 * 1024 * 1024   # 1 MB
ALLOWED_EXT   = {".py"}


def _validate_file(filename: str, size: int):
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Only .py files are supported, got '{ext}'")
    if size > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large (max 1 MB)")


def _run_analysis_on_code(code: str, filename: str = "upload.py") -> dict:
    """Write code to a temp dir and run Pylint, returning the raw result dict."""
    with tempfile.TemporaryDirectory(prefix="cg_upload_") as tmpdir:
        py_path = Path(tmpdir) / filename
        py_path.write_text(code, encoding="utf-8")
        return run_pylint_on_dir(tmpdir)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/upload/file")
async def analyse_file(file: UploadFile = File(...)):
    """
    Accept a .py file upload, run Pylint, return analysis JSON.
    No auth required — public endpoint.
    """
    content = await file.read()
    _validate_file(file.filename or "upload.py", len(content))

    try:
        code = content.decode("utf-8", errors="replace")
    except Exception:
        raise HTTPException(400, "Could not decode file as UTF-8 text")

    result_id = str(uuid.uuid4())
    t0 = time.monotonic()
    result = _run_analysis_on_code(code, file.filename or "upload.py")
    duration_ms = (time.monotonic() - t0) * 1000

    payload = {
        "result_id": result_id,
        "filename": file.filename,
        "source": "file_upload",
        "analysed_at": datetime.now(timezone.utc).isoformat(),
        "duration_ms": round(duration_ms, 1),
        **result,
    }

    # Best-effort AWS integrations
    s3_key = _save_to_s3(result_id, payload)
    if s3_key:
        payload["s3_key"] = s3_key

    _push_metrics(
        score=result["quality_score"],
        total_issues=result["issue_counts"].get("total", 0),
        duration_ms=duration_ms,
        file_name=file.filename or "upload.py",
    )

    return JSONResponse(payload)


@router.post("/upload/paste")
async def analyse_paste(code: str = Form(...), filename: str = Form("snippet.py")):
    """
    Accept pasted Python code (multipart form), run Pylint, return analysis JSON.
    No auth required — public endpoint.
    """
    if not filename.endswith(".py"):
        filename = "snippet.py"
    if len(code.encode()) > MAX_FILE_SIZE:
        raise HTTPException(413, "Code too large (max 1 MB)")
    if not code.strip():
        raise HTTPException(400, "No code provided")

    result_id = str(uuid.uuid4())
    t0 = time.monotonic()
    result = _run_analysis_on_code(code, filename)
    duration_ms = (time.monotonic() - t0) * 1000

    payload = {
        "result_id": result_id,
        "filename": filename,
        "source": "paste",
        "analysed_at": datetime.now(timezone.utc).isoformat(),
        "duration_ms": round(duration_ms, 1),
        **result,
    }

    s3_key = _save_to_s3(result_id, payload)
    if s3_key:
        payload["s3_key"] = s3_key

    _push_metrics(
        score=result["quality_score"],
        total_issues=result["issue_counts"].get("total", 0),
        duration_ms=duration_ms,
        file_name=filename,
    )

    return JSONResponse(payload)


@router.get("/upload/result/{result_id}")
async def get_cached_result(result_id: str):
    """
    Retrieve a previously-stored result by its UUID.
    Looks up S3 — useful for shareable result links.
    """
    data = _get_from_s3(result_id)
    if not data:
        raise HTTPException(404, "Result not found (S3 not configured or result expired)")
    return JSONResponse(data)
