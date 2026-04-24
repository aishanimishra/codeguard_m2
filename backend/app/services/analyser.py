import subprocess
import tempfile
import os
import json
import re
import shutil
from pathlib import Path
from typing import Any

CATEGORY_MAP = {
    "C": "convention",
    "R": "refactor",
    "W": "warning",
    "E": "error",
    "F": "fatal",
}

SEVERITY_WEIGHT = {"fatal": 5, "error": 4, "warning": 3, "refactor": 2, "convention": 1}


def run_pylint_on_dir(repo_dir: str) -> dict[str, Any]:
    """
    Run pylint on all Python files in a directory.
    Returns a dict with file_results, issue_counts, quality_score, summary.
    """
    py_files = list(Path(repo_dir).rglob("*.py"))
    if not py_files:
        return _empty_result("No Python files found")

    # Run pylint with JSON output
    cmd = [
        "python", "-m", "pylint",
        "--output-format=json",
        "--score=yes",
        "--recursive=yes",
        str(repo_dir),
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=repo_dir,
        )
        raw_output = result.stdout
    except subprocess.TimeoutExpired:
        return _empty_result("Analysis timed out after 120s")
    except Exception as e:
        return _empty_result(f"Pylint error: {str(e)}")

    # Parse JSON issues
    issues = []
    try:
        issues = json.loads(raw_output) if raw_output.strip().startswith("[") else []
    except json.JSONDecodeError:
        # Try to extract JSON from mixed output
        match = re.search(r"\[.*\]", raw_output, re.DOTALL)
        if match:
            try:
                issues = json.loads(match.group())
            except Exception:
                issues = []

    # Extract pylint score from stderr (e.g. "Your code has been rated at 6.50/10")
    score_match = re.search(r"rated at ([\d.]+)/10", result.stderr + result.stdout)
    quality_score = float(score_match.group(1)) if score_match else _compute_score(issues)

    # Group issues by file
    file_map: dict[str, list] = {}
    for issue in issues:
        path = issue.get("path", "unknown")
        rel_path = _relative(path, repo_dir)
        if rel_path not in file_map:
            file_map[rel_path] = []
        category_code = issue.get("type", "C")[0].upper()
        severity = CATEGORY_MAP.get(category_code, "convention")
        file_map[rel_path].append({
            "line": issue.get("line", 0),
            "column": issue.get("column", 0),
            "severity": severity,
            "symbol": issue.get("symbol", ""),
            "message": issue.get("message", ""),
            "message_id": issue.get("message-id", ""),
        })

    # Sort files by issue count descending
    file_results = [
        {
            "file": f,
            "issues": sorted(v, key=lambda x: x["line"]),
            "issue_count": len(v),
            "error_count": sum(1 for i in v if i["severity"] in ("error", "fatal")),
        }
        for f, v in sorted(file_map.items(), key=lambda x: -len(x[1]))
    ]

    issue_counts = {
        "convention": sum(1 for i in issues if CATEGORY_MAP.get(i.get("type","C")[0].upper()) == "convention"),
        "refactor": sum(1 for i in issues if CATEGORY_MAP.get(i.get("type","C")[0].upper()) == "refactor"),
        "warning": sum(1 for i in issues if CATEGORY_MAP.get(i.get("type","C")[0].upper()) == "warning"),
        "error": sum(1 for i in issues if CATEGORY_MAP.get(i.get("type","C")[0].upper()) == "error"),
        "fatal": sum(1 for i in issues if CATEGORY_MAP.get(i.get("type","C")[0].upper()) == "fatal"),
        "total": len(issues),
    }

    summary = {
        "total_files": len(py_files),
        "analysed_files": len(file_map),
        "clean_files": len(py_files) - len(file_map),
        "most_common": _most_common(issues),
    }

    return {
        "quality_score": round(quality_score, 2),
        "file_results": file_results,
        "issue_counts": issue_counts,
        "summary": summary,
    }


def _relative(path: str, base: str) -> str:
    try:
        return str(Path(path).relative_to(base))
    except Exception:
        return path


def _compute_score(issues: list) -> float:
    """Fallback scoring when pylint doesn't emit a score line."""
    if not issues:
        return 10.0
    penalty = sum(SEVERITY_WEIGHT.get(CATEGORY_MAP.get(i.get("type","C")[0].upper(), "convention"), 1) for i in issues)
    score = max(0.0, 10.0 - (penalty * 0.05))
    return round(score, 2)


def _most_common(issues: list, n: int = 5) -> list:
    counts: dict[str, int] = {}
    for i in issues:
        sym = i.get("symbol", "unknown")
        counts[sym] = counts.get(sym, 0) + 1
    return sorted([{"symbol": k, "count": v} for k, v in counts.items()], key=lambda x: -x["count"])[:n]


def _empty_result(reason: str) -> dict:
    return {
        "quality_score": 0.0,
        "file_results": [],
        "issue_counts": {"convention": 0, "refactor": 0, "warning": 0, "error": 0, "fatal": 0, "total": 0},
        "summary": {"total_files": 0, "analysed_files": 0, "clean_files": 0, "most_common": [], "error": reason},
    }
