"""
PDF report generation for the Upload Analyser (Module 2).
Uses reportlab — no external services required.
"""
import io
from datetime import datetime
from typing import Any

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, KeepTogether,
    )
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

# Brand colours (hex → reportlab Color)
GREEN  = colors.HexColor("#00e676")
AMBER  = colors.HexColor("#ffab00")
RED    = colors.HexColor("#ff4444")
BLUE   = colors.HexColor("#4da6ff")
PURPLE = colors.HexColor("#b388ff")
DARK   = colors.HexColor("#0d1117")
SURFACE= colors.HexColor("#161b22")
BORDER = colors.HexColor("#21262d")
MUTED  = colors.HexColor("#8b949e")
WHITE  = colors.white


def _score_color(score: float, threshold: float = 7.0) -> Any:
    if score >= threshold:
        return GREEN
    if score >= threshold * 0.7:
        return AMBER
    return RED


def _severity_color(sev: str) -> Any:
    return {
        "fatal": RED, "error": RED,
        "warning": AMBER, "refactor": PURPLE,
        "convention": BLUE,
    }.get(sev, BLUE)


def generate_pdf(result: dict) -> bytes:
    """
    Generate a PDF analysis report and return the raw bytes.
    Raises RuntimeError if reportlab is not installed.
    """
    if not REPORTLAB_AVAILABLE:
        raise RuntimeError("reportlab is not installed – run: pip install reportlab")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title=f"CodeGuard – {result.get('filename', 'Analysis Report')}",
    )

    styles = getSampleStyleSheet()
    mono = "Courier"

    # ── Custom styles ─────────────────────────────────────────────────────────
    h1 = ParagraphStyle("H1", fontName="Helvetica-Bold", fontSize=18, textColor=WHITE,
                        spaceAfter=4)
    h2 = ParagraphStyle("H2", fontName="Helvetica-Bold", fontSize=12, textColor=WHITE,
                        spaceBefore=14, spaceAfter=6)
    body = ParagraphStyle("Body", fontName="Helvetica", fontSize=9, textColor=MUTED,
                          spaceAfter=3)
    code_style = ParagraphStyle("Code", fontName=mono, fontSize=7.5, textColor=BLUE,
                                spaceAfter=2)
    small = ParagraphStyle("Small", fontName="Helvetica", fontSize=8, textColor=MUTED)

    score      = result.get("quality_score", 0.0)
    filename   = result.get("filename", "upload.py")
    analysed   = result.get("analysed_at", datetime.utcnow().isoformat())
    source     = result.get("source", "upload")
    ic         = result.get("issue_counts", {})
    summary    = result.get("summary", {})
    file_res   = result.get("file_results", [])
    result_id  = result.get("result_id", "")
    dur        = result.get("duration_ms", 0)

    score_color = _score_color(score)

    story = []

    # ── Header bar (fake dark bg via table) ───────────────────────────────────
    hdr_data = [[
        Paragraph("<b>⬡ CodeGuard</b>", ParagraphStyle("Logo", fontName="Helvetica-Bold",
                  fontSize=14, textColor=GREEN)),
        Paragraph("File Analysis Report", ParagraphStyle("Sub", fontName="Helvetica",
                  fontSize=10, textColor=MUTED, alignment=2)),
    ]]
    hdr_tbl = Table(hdr_data, colWidths=["60%", "40%"])
    hdr_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
        ("ROUNDEDCORNERS", [4]),
    ]))
    story.append(hdr_tbl)
    story.append(Spacer(1, 10 * mm))

    # ── Score + meta ──────────────────────────────────────────────────────────
    score_cell = Paragraph(
        f'<font color="#{score_color.hexval()[1:]}" size="36"><b>{score:.1f}</b></font>'
        f'<font color="#8b949e" size="14"> / 10</font>',
        ParagraphStyle("Score", fontName="Helvetica-Bold", fontSize=36, alignment=1),
    )
    gate = "PASSED ✓" if score >= 7.0 else "FAILED ✗"
    gate_color = GREEN if score >= 7.0 else RED

    meta_lines = [
        f"<b>File:</b> {filename}",
        f"<b>Source:</b> {source.replace('_', ' ').title()}",
        f"<b>Analysed:</b> {analysed[:19].replace('T', ' ')} UTC",
        f"<b>Duration:</b> {dur:.0f} ms",
        f"<b>Result ID:</b> <font name='Courier' size='7'>{result_id}</font>",
    ]
    meta_para = "<br/>".join(meta_lines)

    top_data = [[
        Table([[score_cell],
               [Paragraph(gate, ParagraphStyle("Gate", fontName="Helvetica-Bold",
                          fontSize=11, textColor=gate_color, alignment=1))]],
              colWidths=["100%"]),
        Paragraph(meta_para, ParagraphStyle("Meta", fontName="Helvetica", fontSize=9,
                  textColor=MUTED, leading=16)),
    ]]
    top_tbl = Table(top_data, colWidths=["35%", "65%"])
    top_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("TOPPADDING",    (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING",   (0, 0), (-1, -1), 14),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 14),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LINEAFTER",     (0, 0), (0, -1), 0.5, BORDER),
        ("ROUNDEDCORNERS", [4]),
    ]))
    story.append(top_tbl)
    story.append(Spacer(1, 8 * mm))

    # ── Issue summary bar ─────────────────────────────────────────────────────
    story.append(Paragraph("Issue Summary", h2))
    categories = ["fatal", "error", "warning", "refactor", "convention"]
    ic_data = [["Category", "Count"]]
    for cat in categories:
        count = ic.get(cat, 0)
        ic_data.append([
            Paragraph(cat.title(), ParagraphStyle("IcCat", fontName="Helvetica-Bold",
                      fontSize=9, textColor=_severity_color(cat))),
            Paragraph(str(count), ParagraphStyle("IcNum", fontName=mono,
                      fontSize=9, textColor=WHITE)),
        ])
    ic_data.append([
        Paragraph("Total", ParagraphStyle("Tot", fontName="Helvetica-Bold", fontSize=9,
                  textColor=WHITE)),
        Paragraph(str(ic.get("total", 0)), ParagraphStyle("TotN", fontName=mono,
                  fontSize=9, textColor=GREEN, fontWeight="bold")),
    ])

    ic_tbl = Table(ic_data, colWidths=["70%", "30%"])
    ic_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BORDER),
        ("BACKGROUND", (0, 1), (-1, -1), SURFACE),
        ("BACKGROUND", (0, -1), (-1, -1), BORDER),
        ("TEXTCOLOR",  (0, 0), (-1, 0), MUTED),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, 0), 8),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("GRID",      (0, 0), (-1, -1), 0.3, BORDER),
        ("ROUNDEDCORNERS", [3]),
    ]))
    story.append(ic_tbl)
    story.append(Spacer(1, 8 * mm))

    # ── Most common issues ────────────────────────────────────────────────────
    most_common = summary.get("most_common", [])
    if most_common:
        story.append(Paragraph("Most Common Issues", h2))
        mc_data = [["Symbol", "Occurrences"]]
        for item in most_common:
            mc_data.append([
                Paragraph(item["symbol"], code_style),
                Paragraph(str(item["count"]), ParagraphStyle("Cnt", fontName=mono,
                          fontSize=9, textColor=AMBER)),
            ])
        mc_tbl = Table(mc_data, colWidths=["75%", "25%"])
        mc_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BORDER),
            ("BACKGROUND", (0, 1), (-1, -1), SURFACE),
            ("TEXTCOLOR",  (0, 0), (-1, 0), MUTED),
            ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",   (0, 0), (-1, 0), 8),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 10),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
            ("GRID",      (0, 0), (-1, -1), 0.3, BORDER),
        ]))
        story.append(mc_tbl)
        story.append(Spacer(1, 8 * mm))

    # ── File breakdown ────────────────────────────────────────────────────────
    if file_res:
        story.append(Paragraph("File Breakdown", h2))

        for f in file_res:
            fname = f.get("file", "?")
            issues = f.get("issues", [])
            err_count = f.get("error_count", 0)
            iss_count = f.get("issue_count", 0)

            # File header row
            fhdr_data = [[
                Paragraph(f"📄 {fname}", ParagraphStyle("FN", fontName=mono,
                          fontSize=8.5, textColor=WHITE)),
                Paragraph(f"{iss_count} issues  •  {err_count} errors",
                          ParagraphStyle("FMeta", fontName="Helvetica", fontSize=8,
                          textColor=RED if err_count else MUTED, alignment=2)),
            ]]
            fhdr_tbl = Table(fhdr_data, colWidths=["70%", "30%"])
            fhdr_tbl.setStyle(TableStyle([
                ("BACKGROUND",    (0, 0), (-1, -1), BORDER),
                ("TOPPADDING",    (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("LEFTPADDING",   (0, 0), (-1, -1), 10),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
                ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ]))

            rows = [["Line", "Sev", "Message", "Symbol"]]
            for issue in issues[:50]:   # cap at 50 per file in PDF
                sev = issue.get("severity", "convention")
                rows.append([
                    Paragraph(str(issue.get("line", "")),
                              ParagraphStyle("L", fontName=mono, fontSize=7, textColor=MUTED)),
                    Paragraph(sev[:4].upper(),
                              ParagraphStyle("S", fontName="Helvetica-Bold", fontSize=7,
                              textColor=_severity_color(sev))),
                    Paragraph(issue.get("message", ""),
                              ParagraphStyle("M", fontName="Helvetica", fontSize=7.5,
                              textColor=colors.HexColor("#c9d1d9"))),
                    Paragraph(issue.get("symbol", ""),
                              ParagraphStyle("Sym", fontName=mono, fontSize=7,
                              textColor=BLUE)),
                ])

            issues_tbl = Table(rows, colWidths=["8%", "9%", "60%", "23%"])
            issues_tbl.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), SURFACE),
                ("TEXTCOLOR",  (0, 0), (-1, 0), MUTED),
                ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE",   (0, 0), (-1, 0), 7.5),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#0d1117")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1),
                 [colors.HexColor("#0d1117"), SURFACE]),
                ("TOPPADDING",    (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING",   (0, 0), (-1, -1), 6),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
                ("GRID",      (0, 0), (-1, -1), 0.2, BORDER),
            ]))

            story.append(KeepTogether([fhdr_tbl, issues_tbl, Spacer(1, 5 * mm)]))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        f"Generated by CodeGuard  •  {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC  •  "
        f"Result ID: {result_id}",
        ParagraphStyle("Footer", fontName="Helvetica", fontSize=7, textColor=MUTED, alignment=1),
    ))

    doc.build(story)
    return buf.getvalue()
