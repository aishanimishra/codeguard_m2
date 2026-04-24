"""
PDF download route for Module 2.
POST /api/upload/report   – generate PDF from a result payload directly
GET  /api/upload/report/{result_id} – regenerate from S3-cached result
"""
import json
import logging
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from app.services.report import generate_pdf, REPORTLAB_AVAILABLE
from app.api.upload import _get_from_s3

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/upload/report")
async def download_report_from_payload(request: Request):
    """
    Accept a full result JSON body (as returned by /upload/file or /upload/paste),
    generate and stream a PDF report.
    No auth required.
    """
    if not REPORTLAB_AVAILABLE:
        raise HTTPException(500, "reportlab not installed on the server")
    try:
        result = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON body")

    try:
        pdf_bytes = generate_pdf(result)
    except Exception as e:
        logger.exception("PDF generation failed")
        raise HTTPException(500, f"PDF generation failed: {e}")

    filename = result.get("filename", "analysis").replace("/", "_").replace("\\", "_")
    safe_name = f"codeguard-{filename}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.get("/upload/report/{result_id}")
async def download_report_by_id(result_id: str):
    """
    Fetch a previously-stored result from S3 and stream a PDF report.
    Useful for generating a shareable download link.
    No auth required.
    """
    if not REPORTLAB_AVAILABLE:
        raise HTTPException(500, "reportlab not installed on the server")

    result = _get_from_s3(result_id)
    if not result:
        raise HTTPException(404, "Result not found in S3 (not configured or expired)")

    try:
        pdf_bytes = generate_pdf(result)
    except Exception as e:
        logger.exception("PDF generation failed")
        raise HTTPException(500, f"PDF generation failed: {e}")

    filename = result.get("filename", "analysis").replace("/", "_")
    safe_name = f"codeguard-{filename}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )
