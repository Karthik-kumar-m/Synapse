"""Layer 3 – Anomaly Detection via time-series spike analysis."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional

SPIKE_THRESHOLD: float = 0.15
WINDOW_SIZE: int = 7  # days for rolling window


# ---------------------------------------------------------------------------
# Aspect distribution computation
# ---------------------------------------------------------------------------

def compute_aspect_distribution(reviews_data: List[dict]) -> Dict[str, dict]:
    """
    Compute percentage and negative percentage of each aspect across all reviews.

    Args:
        reviews_data: List of dicts with keys "created_at", "aspect", "sentiment"

    Returns:
        {aspect: {"count": int, "percentage": float, "negative_pct": float}}
    """
    if not reviews_data:
        return {}

    total = len(reviews_data)
    aspect_counts: Dict[str, int] = defaultdict(int)
    aspect_negative: Dict[str, int] = defaultdict(int)

    for entry in reviews_data:
        aspect = entry.get("aspect", "")
        sentiment = entry.get("sentiment", "")
        if aspect:
            aspect_counts[aspect] += 1
            if sentiment == "negative":
                aspect_negative[aspect] += 1

    result: Dict[str, dict] = {}
    for aspect, count in aspect_counts.items():
        pct = count / total
        neg_pct = aspect_negative[aspect] / count if count > 0 else 0.0
        result[aspect] = {
            "count": count,
            "percentage": round(pct, 4),
            "negative_pct": round(neg_pct, 4),
        }
    return result


# ---------------------------------------------------------------------------
# Spike detection
# ---------------------------------------------------------------------------

def detect_spike(historical_pct: float, current_pct: float) -> dict:
    """
    Compare historical vs current aspect percentage and compute spike metrics.

    Returns:
        {
            "spike_detected": bool,
            "delta": float,
            "z_score": float,
            "severity": str | None,
        }
    """
    delta = current_pct - historical_pct
    z_score = delta / max(historical_pct, 0.01)

    if delta > 0.30:
        severity: Optional[str] = "critical"
    elif delta > 0.20:
        severity = "high"
    elif delta > 0.15:
        severity = "medium"
    elif delta > 0.05:
        severity = "low"
    else:
        severity = None

    spike_detected = severity is not None

    return {
        "spike_detected": spike_detected,
        "delta": round(delta, 4),
        "z_score": round(z_score, 4),
        "severity": severity,
    }


# ---------------------------------------------------------------------------
# Time-series analysis
# ---------------------------------------------------------------------------

def analyze_time_series(
    reviews_data: List[dict], window_days: int = WINDOW_SIZE
) -> List[dict]:
    """
    Split reviews into baseline (older than window_days) and recent, then detect spikes.

    Args:
        reviews_data: List of dicts with keys "created_at" (ISO str or datetime),
                      "aspect", "sentiment"
        window_days: Number of recent days to consider as current window

    Returns:
        List of alert dicts:
        [{"aspect", "baseline_pct", "current_pct", "spike_delta", "severity", "is_systemic"}]
    """
    if not reviews_data:
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)

    baseline_reviews: List[dict] = []
    recent_reviews: List[dict] = []

    for entry in reviews_data:
        created_at = entry.get("created_at")
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at)
            except ValueError:
                created_at = datetime.now(timezone.utc)

        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        if created_at < cutoff:
            baseline_reviews.append(entry)
        else:
            recent_reviews.append(entry)

    if not baseline_reviews or not recent_reviews:
        return []

    baseline_dist = compute_aspect_distribution(baseline_reviews)
    recent_dist = compute_aspect_distribution(recent_reviews)

    alerts: List[dict] = []
    all_aspects = set(baseline_dist.keys()) | set(recent_dist.keys())

    for aspect in all_aspects:
        historical_pct = baseline_dist.get(aspect, {}).get("percentage", 0.0)
        current_pct = recent_dist.get(aspect, {}).get("percentage", 0.0)

        spike_result = detect_spike(historical_pct, current_pct)
        if not spike_result["spike_detected"]:
            continue

        day_timeline = _build_day_timeline(reviews_data, window_days)
        systemic = is_systemic_failure(day_timeline, aspect)

        alerts.append(
            {
                "aspect": aspect,
                "baseline_pct": historical_pct,
                "current_pct": current_pct,
                "spike_delta": spike_result["delta"],
                "severity": spike_result["severity"],
                "is_systemic": systemic,
            }
        )

    return alerts


def _build_day_timeline(
    reviews_data: List[dict], window_days: int
) -> List[dict]:
    """Build a per-day distribution timeline for the recent window."""
    timeline: List[dict] = []
    now = datetime.now(timezone.utc)

    for day_offset in range(window_days):
        day_start = now - timedelta(days=window_days - day_offset)
        day_end = day_start + timedelta(days=1)

        day_entries = []
        for entry in reviews_data:
            created_at = entry.get("created_at")
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at)
                except ValueError:
                    continue
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            if day_start <= created_at < day_end:
                day_entries.append(entry)

        dist = compute_aspect_distribution(day_entries) if day_entries else {}
        timeline.append({"date": day_start.date().isoformat(), "distribution": dist})

    return timeline


# ---------------------------------------------------------------------------
# Systemic failure detection
# ---------------------------------------------------------------------------

def is_systemic_failure(
    aspect_timeline: List[dict],
    aspect: str,
    days_threshold: int = 3,
) -> bool:
    """
    Return True if the aspect's negative percentage exceeded SPIKE_THRESHOLD
    for at least `days_threshold` consecutive days.

    Args:
        aspect_timeline: List of dicts like {"date": str, "distribution": {aspect: {...}}}
        aspect: The aspect to check
        days_threshold: Number of consecutive days required
    """
    consecutive = 0

    for day_data in aspect_timeline:
        dist = day_data.get("distribution", {})
        aspect_data = dist.get(aspect, {})
        negative_pct = aspect_data.get("negative_pct", 0.0)

        if negative_pct >= SPIKE_THRESHOLD:
            consecutive += 1
            if consecutive >= days_threshold:
                return True
        else:
            consecutive = 0

    return False
