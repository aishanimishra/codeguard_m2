"""
Module 2 – PDF Report Generation
Generates a downloadable PDF report for any analysis result.
"""
import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.analysis import Analysis
from app.models.repo import Repo

router = APIRouter()


def _build_pdf(analysis: Analysis, repo_name: str) -> bytes:
    """Generate a simple PDF report using reportlab."""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.colors import HexColor
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.units import inch
    except ImportError:
        raise HTTPException(500, "reportlab not installed — run: pip install reportlab")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                            rightMargin=inch, leftMargin=inch,
                            topMargin=inch, bottomMargin=inch)

    styles = getSampleStyleSheet()
    green = HexColor("#00875a")
    red = HexColor("#c0392b")
    dark = HexColor("#111418")

    story = []
    title_style = ParagraphStyle("title", parent=styles["Title"], textColor=dark, fontSize=24, spaceAfter=6)
    h2_style = ParagraphStyle("h2", parent=styles["Heading2"], textColor=dark, fontSize=14, spaceAfter=4)
    body_style = ParagraphStyle("body", parent=styles["Normal"], fontSize=10, spaceAfter=4)
    code_style = ParagraphStyle("code", parent=styles["Code"], fontSize=9, spaceAfter=2)

    story.append(Paragraph("CodeGuard — Analysis Report", title_style))
    story.append(Paragraph(f"Repository: {repo_name}", body_style))
    story.append(Paragraph(f"Commit: {analysis.commit_sha[:12]} on {analysis.branch}", body_style))
    story.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", body_style))
    story.append(Spacer(1, 0.2 * inch))

    # Score section
    score_color = green if analysis.passed_gate else red
    gate_text = "PASSED" if analysis.passed_gate else "FAILED"
    story.append(Paragraph(f"Quality Score: {analysis.quality_score}/10  —  Gate: {gate_text}", h2_style))
    story.append(Spacer(1, 0.15 * inch))

    # Issue counts table
    ic = analysis.issue_counts or {}
    story.append(Paragraph("Issue Summary", h2_style))
    count_data = [
        ["Category", "Count"],
        ["Convention", str(ic.get("convention", 0))],
        ["Refactor",   str(ic.get("refactor", 0))],
        ["Warning",    str(ic.get("warning", 0))],
        ["Error",      str(ic.get("error", 0))],
        ["Fatal",      str(ic.get("fatal", 0))],
        ["Total",      str(ic.get("total", 0))],
    ]
    t = Table(count_data, colWidths=[3 * inch, 1.5 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), dark),
        ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#ffffff")),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#f5f6f7"), HexColor("#ffffff")]),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#cccccc")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.2 * inch))

    # File breakdown
    file_results = analysis.file_results or []
    if file_results:
        story.append(Paragraph("File Breakdown", h2_style))
        for f in file_results[:20]:  # cap at 20 files
            story.append(Paragraph(f"<b>{f['file']}</b> — {f['issue_count']} issues ({f['error_count']} errors)", body_style))
            for issue in f["issues"][:10]:  # cap at 10 issues per file
                story.append(Paragraph(
                    f"  Line {issue['line']}: [{issue['severity']}] {issue['message']} ({issue['symbol']})",
                    code_style
                ))
        if len(file_results) > 20:
            story.append(Paragraph(f"... and {len(file_results) - 20} more files", body_style))

    doc.build(story)
    return buffer.getvalue()


@router.get("/report/{analysis_id}")
async def download_report(
    analysis_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download a PDF report for a completed analysis."""
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user.id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(404, "Analysis not found")
    if analysis.status != "done":
        raise HTTPException(400, "Analysis not complete yet")

    repo_result = await db.execute(select(Repo).where(Repo.id == analysis.repo_id))
    repo = repo_result.scalar_one_or_none()
    repo_name = repo.full_name if repo else f"repo-{analysis.repo_id}"

    pdf_bytes = _build_pdf(analysis, repo_name)

    filename = f"codeguard-{repo_name.replace('/', '-')}-{analysis.commit_sha[:7]}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
