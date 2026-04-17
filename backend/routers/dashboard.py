"""Dashboard router – analytics, review listing, and anomaly reporting."""

from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import Integer, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from config import settings
from logic.aggregates import recompute_aggregates, recompute_aggregates_background
from logic.ollama_client import generate_json
from models.aggregate import DashboardAggregate, ProductAnomalyAggregate, ProductAspectAggregate
from models.alert import AnomalyAlert
from models.review import AspectInsight, Review
from schemas.alert import AlertResponse, DashboardSummary, PrecomputeResponse, ProductAIInsights, ProductSummary
from schemas.review import ReviewResponse

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

_CATEGORY_BASELINE = ["Consumer Electronics", "Home Appliances", "Software Services"]


def _compute_window_rates(window_rows: List[tuple]) -> Dict[str, Dict[str, float]]:
    review_aspect_sentiments: Dict[str, Dict[str, set]] = {}
    for review_id, aspect, sentiment in window_rows:
        key = str(review_id)
        if key not in review_aspect_sentiments:
            review_aspect_sentiments[key] = {"negative": set(), "positive": set()}
        if sentiment == "negative":
            review_aspect_sentiments[key]["negative"].add(aspect)
        elif sentiment == "positive":
            review_aspect_sentiments[key]["positive"].add(aspect)

    total_reviews = max(len(review_aspect_sentiments), 1)
    aspect_counts: Dict[str, Dict[str, int]] = {}
    for sentiment_bucket in ["negative", "positive"]:
        for _, sentiments in review_aspect_sentiments.items():
            for aspect in sentiments[sentiment_bucket]:
                if aspect not in aspect_counts:
                    aspect_counts[aspect] = {"negative": 0, "positive": 0}
                aspect_counts[aspect][sentiment_bucket] += 1

    rates: Dict[str, Dict[str, float]] = {}
    for aspect, counts in aspect_counts.items():
        rates[aspect] = {
            "negative": round(counts["negative"] / total_reviews, 4),
            "positive": round(counts["positive"] / total_reviews, 4),
            "current_count": counts["negative"] + counts["positive"],
            "total_reviews": total_reviews,
        }
    return rates


def _build_ai_fallback(
    product_id: str,
    anomalies: List[ProductAnomalyAggregate],
    aspects: List[ProductAspectAggregate],
    active_alerts_count: int,
) -> ProductAIInsights:
    top_anomalies = sorted(anomalies, key=lambda a: float(a.spike_delta or 0.0), reverse=True)[:3]
    top_negative = sorted(aspects, key=lambda a: int(a.negative or 0), reverse=True)[:3]

    likely_root_causes = [
        f"{a.aspect}: spike delta {round(float(a.spike_delta or 0.0) * 100, 1)} percentage points"
        for a in top_anomalies
    ]
    if not likely_root_causes:
        likely_root_causes = [
            f"{a.aspect}: high negative volume ({int(a.negative)} negative mentions)"
            for a in top_negative
        ]

    immediate_actions = [
        f"Investigate '{a.aspect}' complaints in the latest review cohort"
        for a in top_negative[:2]
    ]
    if active_alerts_count > 0:
        immediate_actions.append("Escalate unresolved critical/high alerts to support and QA leads")
    if not immediate_actions:
        immediate_actions = ["Collect more reviews before deciding on remediation priorities"]

    summary = (
        f"Product {product_id} currently has {active_alerts_count} active alert(s). "
        f"Most pressure is around {', '.join([a.aspect for a in top_negative[:2]]) or 'general quality signals'}"
        "."
    )

    return ProductAIInsights(
        product_id=product_id,
        generated_by="heuristic-fallback",
        summary=summary,
        likely_root_causes=likely_root_causes,
        immediate_actions=immediate_actions,
        confidence=0.68,
    )


# ---------------------------------------------------------------------------
# /products
# ---------------------------------------------------------------------------

@router.get(
    "/products",
    response_model=List[ProductSummary],
    summary="Product-level summary for frontend selectors and KPI widgets",
)
async def list_products(db: AsyncSession = Depends(get_db)) -> List[ProductSummary]:
    rows = await db.execute(
        select(
            Review.product_id,
            Review.product_name,
            func.count(Review.id).label("total_reviews"),
            func.coalesce(func.avg(Review.overall_score), 0.0).label("avg_sentiment_score"),
            func.coalesce(func.sum(cast(Review.is_bot, Integer)), 0).label("bot_reviews"),
            func.coalesce(func.sum(cast(Review.is_duplicate, Integer)), 0).label("duplicate_reviews"),
        )
        .group_by(Review.product_id, Review.product_name)
        .order_by(func.count(Review.id).desc())
    )

    product_rows = rows.all()
    if not product_rows:
        return []

    alerts_rows = await db.execute(
        select(AnomalyAlert.product_id, func.count(AnomalyAlert.id))
        .where(AnomalyAlert.is_resolved.is_(False))
        .group_by(AnomalyAlert.product_id)
    )
    alerts_by_product = {product_id: int(count) for product_id, count in alerts_rows.all()}

    return [
        ProductSummary(
            product_id=row.product_id,
            product_name=row.product_name,
            total_reviews=int(row.total_reviews or 0),
            avg_sentiment_score=round(float(row.avg_sentiment_score or 0.0), 4),
            bot_reviews=int(row.bot_reviews or 0),
            duplicate_reviews=int(row.duplicate_reviews or 0),
            active_alerts=alerts_by_product.get(row.product_id, 0),
        )
        for row in product_rows
    ]


# ---------------------------------------------------------------------------
# /summary
# ---------------------------------------------------------------------------

@router.get(
    "/summary",
    response_model=DashboardSummary,
    summary="Get platform-wide dashboard summary",
)
async def get_summary(db: AsyncSession = Depends(get_db)) -> DashboardSummary:
    aggregate = await db.get(DashboardAggregate, "global")
    if aggregate is None:
        await recompute_aggregates(db)
        aggregate = await db.get(DashboardAggregate, "global")

    if aggregate is None:
        return DashboardSummary(
            total_reviews=0,
            avg_sentiment_score=0.0,
            top_aspects=[],
            active_alerts=0,
            bot_rate=0.0,
            sarcasm_rate=0.0,
            updated_at=None,
        )

    return DashboardSummary(
        total_reviews=aggregate.total_reviews,
        avg_sentiment_score=round(float(aggregate.avg_sentiment_score), 4),
        top_aspects=aggregate.top_aspects or [],
        active_alerts=aggregate.active_alerts,
        bot_rate=round(float(aggregate.bot_rate), 4),
        sarcasm_rate=round(float(aggregate.sarcasm_rate), 4),
        updated_at=aggregate.updated_at,
    )


# ---------------------------------------------------------------------------
# /reviews
# ---------------------------------------------------------------------------

@router.get(
    "/reviews",
    response_model=List[ReviewResponse],
    summary="Paginated list of reviews with optional filters",
)
async def list_reviews(
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    product_id: Optional[str] = Query(default=None),
    sentiment: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
) -> List[ReviewResponse]:
    query = select(Review).options(selectinload(Review.aspects))

    if product_id:
        query = query.where(Review.product_id == product_id)
    if sentiment:
        query = query.where(Review.overall_sentiment == sentiment)
    if source:
        query = query.where(Review.source == source)

    query = (
        query.order_by(Review.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    result = await db.execute(query)
    reviews = result.scalars().all()
    return [ReviewResponse.model_validate(r) for r in reviews]


# ---------------------------------------------------------------------------
# /alerts
# ---------------------------------------------------------------------------

@router.get(
    "/alerts",
    response_model=List[AlertResponse],
    summary="List active anomaly alerts ordered by severity",
)
async def list_alerts(db: AsyncSession = Depends(get_db)) -> List[AlertResponse]:
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}

    result = await db.execute(
        select(AnomalyAlert)
        .where(AnomalyAlert.is_resolved.is_(False))
        .order_by(AnomalyAlert.triggered_at.desc())
    )
    alerts = result.scalars().all()
    alerts_sorted = sorted(
        alerts, key=lambda a: severity_order.get(a.severity, 99)
    )
    return [AlertResponse.model_validate(a) for a in alerts_sorted]


# ---------------------------------------------------------------------------
# /aspects/{product_id}
# ---------------------------------------------------------------------------

@router.get(
    "/aspects/{product_id}",
    summary="Aspect breakdown and time-series data for a specific product",
)
async def get_aspects_for_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    rows = await db.execute(
        select(ProductAspectAggregate)
        .where(ProductAspectAggregate.product_id == product_id)
        .order_by(ProductAspectAggregate.count.desc())
    )
    aggregates = rows.scalars().all()

    total_reviews_result = await db.execute(
        select(func.count(Review.id)).where(Review.product_id == product_id)
    )
    total_reviews = int(total_reviews_result.scalar_one() or 0)

    aspect_summary: List[dict] = [
        {
            "aspect": row.aspect,
            "count": row.count,
            "positive": row.positive,
            "negative": row.negative,
            "neutral": row.neutral,
            "ambiguous": row.ambiguous,
            "avg_score": round(float(row.avg_score or 0.0), 4),
            "updated_at": row.updated_at,
        }
        for row in aggregates
    ]

    return {
        "product_id": product_id,
        "total_reviews": total_reviews,
        "aspect_breakdown": aspect_summary,
    }


# ---------------------------------------------------------------------------
# /anomaly-report/{product_id}
# ---------------------------------------------------------------------------

@router.get(
    "/anomaly-report/{product_id}",
    summary="Full anomaly analysis report for a product",
)
async def get_anomaly_report(
    product_id: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    spikes_result = await db.execute(
        select(ProductAnomalyAggregate)
        .where(ProductAnomalyAggregate.product_id == product_id)
        .order_by(ProductAnomalyAggregate.spike_delta.desc())
    )
    spikes = spikes_result.scalars().all()

    active_alerts_result = await db.execute(
        select(AnomalyAlert).where(
            AnomalyAlert.product_id == product_id,
            AnomalyAlert.is_resolved.is_(False),
        )
    )
    active_alerts = active_alerts_result.scalars().all()

    total_reviews_result = await db.execute(
        select(func.count(Review.id)).where(Review.product_id == product_id)
    )
    total_reviews = int(total_reviews_result.scalar_one() or 0)

    detected_spikes = [
        {
            "aspect": s.aspect,
            "baseline_pct": s.baseline_pct,
            "current_pct": s.current_pct,
            "spike_delta": s.spike_delta,
            "severity": s.severity,
            "is_systemic": s.is_systemic,
            "updated_at": s.updated_at,
        }
        for s in spikes
    ]

    return {
        "product_id": product_id,
        "total_reviews_analysed": total_reviews,
        "detected_spikes": detected_spikes,
        "active_alerts": [AlertResponse.model_validate(a) for a in active_alerts],
        "spike_count": len(detected_spikes),
        "systemic_failures": [s for s in detected_spikes if s.get("is_systemic")],
    }


@router.get(
    "/trends",
    summary="Batch-over-batch issue and praise trend detection",
)
async def get_batch_trends(
    db: AsyncSession = Depends(get_db),
    product_id: Optional[str] = Query(default=None),
    batch_size: int = Query(default=50, ge=10, le=500),
) -> Dict[str, Any]:
    reviews_query = select(Review.id).where(
        Review.is_bot.is_(False),
        Review.is_spam.is_(False),
        Review.is_duplicate.is_(False),
    )
    if product_id:
        reviews_query = reviews_query.where(Review.product_id == product_id)

    reviews_query = reviews_query.order_by(Review.created_at.desc()).limit(batch_size * 2)
    review_rows = await db.execute(reviews_query)
    review_ids = [row[0] for row in review_rows.all()]

    if len(review_ids) < 2:
        return {
            "product_id": product_id,
            "batch_size": batch_size,
            "message": "Not enough reviews to compute trends.",
            "trends": [],
        }

    split = min(batch_size, len(review_ids) // 2)
    current_ids = set(review_ids[:split])
    previous_ids = set(review_ids[split:split * 2])

    aspects_result = await db.execute(
        select(AspectInsight.review_id, AspectInsight.aspect, AspectInsight.sentiment)
        .where(AspectInsight.review_id.in_(list(current_ids | previous_ids)))
    )
    all_rows = aspects_result.all()

    current_rows = [row for row in all_rows if row[0] in current_ids]
    previous_rows = [row for row in all_rows if row[0] in previous_ids]

    current_rates = _compute_window_rates(current_rows)
    previous_rates = _compute_window_rates(previous_rows)

    all_aspects = set(current_rates.keys()) | set(previous_rates.keys())
    trends: List[Dict[str, Any]] = []
    for aspect in sorted(all_aspects):
        prev_neg = previous_rates.get(aspect, {}).get("negative", 0.0)
        curr_neg = current_rates.get(aspect, {}).get("negative", 0.0)
        prev_pos = previous_rates.get(aspect, {}).get("positive", 0.0)
        curr_pos = current_rates.get(aspect, {}).get("positive", 0.0)

        neg_delta = round(curr_neg - prev_neg, 4)
        pos_delta = round(curr_pos - prev_pos, 4)

        if abs(neg_delta) < 0.05 and abs(pos_delta) < 0.05:
            continue

        current_count = int(current_rates.get(aspect, {}).get("current_count", 0))
        classification = "systemic" if curr_neg >= 0.15 and current_count >= 3 else "isolated"
        if neg_delta >= 0.2:
            trend_type = "issue_spike"
        elif pos_delta >= 0.2:
            trend_type = "praise_spike"
        elif neg_delta > 0:
            trend_type = "emerging_issue"
        elif pos_delta > 0:
            trend_type = "emerging_praise"
        else:
            trend_type = "stabilizing"

        trends.append(
            {
                "aspect": aspect,
                "previous_negative_rate": prev_neg,
                "current_negative_rate": curr_neg,
                "negative_delta": neg_delta,
                "previous_positive_rate": prev_pos,
                "current_positive_rate": curr_pos,
                "positive_delta": pos_delta,
                "current_mentions": current_count,
                "classification": classification,
                "trend_type": trend_type,
            }
        )

    trends.sort(key=lambda t: abs(float(t["negative_delta"])) + abs(float(t["positive_delta"])), reverse=True)
    return {
        "product_id": product_id,
        "batch_size": batch_size,
        "current_window_reviews": len(current_ids),
        "previous_window_reviews": len(previous_ids),
        "trends": trends,
    }


@router.get(
    "/ai-insights/{product_id}",
    response_model=ProductAIInsights,
    summary="AI-generated root-cause and action insights for a product",
)
async def get_ai_insights(
    product_id: str,
    db: AsyncSession = Depends(get_db),
) -> ProductAIInsights:
    anomaly_rows = await db.execute(
        select(ProductAnomalyAggregate)
        .where(ProductAnomalyAggregate.product_id == product_id)
        .order_by(ProductAnomalyAggregate.spike_delta.desc())
    )
    anomalies = anomaly_rows.scalars().all()

    aspect_rows = await db.execute(
        select(ProductAspectAggregate)
        .where(ProductAspectAggregate.product_id == product_id)
        .order_by(ProductAspectAggregate.negative.desc())
    )
    aspects = aspect_rows.scalars().all()

    if not anomalies and not aspects:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No analytics found for product_id '{product_id}'.",
        )

    active_alerts_count_result = await db.execute(
        select(func.count(AnomalyAlert.id)).where(
            AnomalyAlert.product_id == product_id,
            AnomalyAlert.is_resolved.is_(False),
        )
    )
    active_alerts_count = int(active_alerts_count_result.scalar_one() or 0)

    fallback_payload = _build_ai_fallback(product_id, anomalies, aspects, active_alerts_count)

    if not settings.OLLAMA_ENABLE_EXTRACTION:
        return fallback_payload

    anomalies_prompt = [
        {
            "aspect": row.aspect,
            "severity": row.severity,
            "spike_delta": round(float(row.spike_delta or 0.0), 4),
            "is_systemic": bool(row.is_systemic),
        }
        for row in anomalies[:5]
    ]
    aspects_prompt = [
        {
            "aspect": row.aspect,
            "negative": int(row.negative or 0),
            "count": int(row.count or 0),
            "avg_score": round(float(row.avg_score or 0.0), 4),
        }
        for row in aspects[:5]
    ]

    prompt = (
        "You are an analytics copilot for customer-review operations. "
        "Given product anomaly and aspect metrics, return concise, actionable JSON only. "
        "Return exact schema: "
        "{\"summary\":\"...\",\"likely_root_causes\":[\"...\"],\"immediate_actions\":[\"...\"],\"confidence\":0.0}. "
        "Constraints: max 2 sentences in summary, 2-4 root causes, 2-4 actions, confidence between 0 and 1. "
        f"Product: {product_id}. Active alerts: {active_alerts_count}. "
        f"Anomalies: {anomalies_prompt}. "
        f"Aspects: {aspects_prompt}."
    )

    try:
        llm = await generate_json(prompt)
        summary = str(llm.get("summary", "")).strip()
        likely_root_causes = llm.get("likely_root_causes", [])
        immediate_actions = llm.get("immediate_actions", [])
        confidence_raw = llm.get("confidence", 0.7)

        if not isinstance(likely_root_causes, list):
            likely_root_causes = []
        if not isinstance(immediate_actions, list):
            immediate_actions = []

        normalized_root_causes = [str(item).strip() for item in likely_root_causes if str(item).strip()]
        normalized_actions = [str(item).strip() for item in immediate_actions if str(item).strip()]

        try:
            confidence = float(confidence_raw)
        except (TypeError, ValueError):
            confidence = 0.7
        confidence = max(0.0, min(1.0, confidence))

        if not summary or not normalized_root_causes or not normalized_actions:
            return fallback_payload

        return ProductAIInsights(
            product_id=product_id,
            generated_by="ollama",
            summary=summary,
            likely_root_causes=normalized_root_causes[:4],
            immediate_actions=normalized_actions[:4],
            confidence=round(confidence, 4),
        )
    except Exception:
        return fallback_payload


@router.get(
    "/category-comparison",
    summary="Cross-category sentiment and quality comparison",
)
async def get_category_comparison(
    db: AsyncSession = Depends(get_db),
    top_n: int = Query(default=5, ge=3, le=10),
) -> Dict[str, Any]:
    rows = await db.execute(
        select(
            Review.category,
            func.count(Review.id).label("total_reviews"),
            func.coalesce(func.avg(Review.overall_score), 0.0).label("avg_sentiment_score"),
            func.coalesce(func.avg(cast(Review.is_bot, Integer)), 0.0).label("bot_rate"),
            func.coalesce(func.avg(cast(Review.is_spam, Integer)), 0.0).label("spam_rate"),
            func.coalesce(func.avg(cast(Review.is_duplicate, Integer)), 0.0).label("duplicate_rate"),
        )
        .group_by(Review.category)
        .order_by(func.count(Review.id).desc())
        .limit(top_n)
    )

    category_rows = rows.all()
    payload: List[Dict[str, Any]] = []
    existing = set()

    for row in category_rows:
        category_name = row.category or "Uncategorized"
        existing.add(category_name)
        payload.append(
            {
                "category": category_name,
                "total_reviews": int(row.total_reviews or 0),
                "avg_sentiment_score": round(float(row.avg_sentiment_score or 0.0), 4),
                "bot_rate": round(float(row.bot_rate or 0.0), 4),
                "spam_rate": round(float(row.spam_rate or 0.0), 4),
                "duplicate_rate": round(float(row.duplicate_rate or 0.0), 4),
            }
        )

    for baseline_category in _CATEGORY_BASELINE:
        if len(payload) >= top_n:
            break
        if baseline_category in existing:
            continue
        payload.append(
            {
                "category": baseline_category,
                "total_reviews": 0,
                "avg_sentiment_score": 0.0,
                "bot_rate": 0.0,
                "spam_rate": 0.0,
                "duplicate_rate": 0.0,
            }
        )

    return {"categories": payload}


@router.get(
    "/report/export",
    summary="Download dashboard report as PDF",
)
async def export_dashboard_report(
    db: AsyncSession = Depends(get_db),
    product_id: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
) -> Response:
    try:
        from reportlab.lib.pagesizes import LETTER
        from reportlab.pdfgen import canvas
    except ModuleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PDF export dependency missing: install 'reportlab' in the backend Python environment.",
        ) from exc

    reviews_query = select(Review)
    if product_id:
        reviews_query = reviews_query.where(Review.product_id == product_id)
    if category:
        reviews_query = reviews_query.where(Review.category == category)

    reviews_query = reviews_query.order_by(Review.created_at.desc()).limit(200)
    result = await db.execute(reviews_query)
    reviews = result.scalars().all()

    summary = await get_summary(db)
    categories = await get_category_comparison(db, top_n=5)

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=LETTER)
    page_width, page_height = LETTER
    y = page_height - 50

    def ensure_space(lines: int = 1) -> None:
        nonlocal y
        if y <= 50 + (lines * 14):
            pdf.showPage()
            y = page_height - 50

    def draw_line(text: str, font_name: str = "Helvetica", font_size: int = 10) -> None:
        nonlocal y
        ensure_space(1)
        pdf.setFont(font_name, font_size)
        pdf.drawString(50, y, text[:120])
        y -= 14

    def draw_wrapped(text: str, max_chars: int = 110) -> None:
        chunks = [text[i:i + max_chars] for i in range(0, len(text), max_chars)] if text else [""]
        for chunk in chunks:
            draw_line(chunk)

    generated_at = datetime.now(timezone.utc).isoformat()

    draw_line("Synapse Intelligence Report", font_name="Helvetica-Bold", font_size=16)
    draw_line(f"Generated At: {generated_at}")
    draw_line(f"Product Filter: {product_id or 'All'}")
    draw_line(f"Category Filter: {category or 'All'}")
    y -= 8

    draw_line("Global Summary", font_name="Helvetica-Bold", font_size=12)
    draw_line(f"Total Reviews: {summary.total_reviews}")
    draw_line(f"Average Sentiment: {round(float(summary.avg_sentiment_score), 4)}")
    draw_line(f"Active Alerts: {summary.active_alerts}")
    draw_line(f"Bot Rate: {round(float(summary.bot_rate), 4)}")
    draw_line(f"Sarcasm Rate: {round(float(summary.sarcasm_rate), 4)}")
    y -= 8

    draw_line("Category Comparison", font_name="Helvetica-Bold", font_size=12)
    for row in categories["categories"]:
        draw_line(
            f"{row['category']} | reviews={row['total_reviews']} | sentiment={row['avg_sentiment_score']} | "
            f"bot={row['bot_rate']} | spam={row['spam_rate']} | duplicate={row['duplicate_rate']}"
        )
    y -= 8

    draw_line("Recent Reviews (up to 200)", font_name="Helvetica-Bold", font_size=12)
    for review in reviews:
        ensure_space(6)
        draw_line(f"Review ID: {review.id}", font_name="Helvetica-Bold")
        draw_line(f"Product: {review.product_id} - {review.product_name}")
        draw_line(f"Category: {review.category} | Sentiment: {review.overall_sentiment} | Score: {review.overall_score}")
        draw_line(f"Language: {review.language_detected} | Source: {review.source}")
        draw_line(f"Created At: {review.created_at.isoformat() if review.created_at else ''}")
        draw_wrapped(f"Text: {review.raw_text}")
        y -= 6

    pdf.save()
    buffer.seek(0)

    filename_parts = ["synapse_report"]
    if product_id:
        filename_parts.append(product_id)
    if category:
        filename_parts.append(category.lower().replace(" ", "_"))
    filename_parts.append(datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S"))
    filename = "_".join(filename_parts) + ".pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/precompute",
    response_model=PrecomputeResponse,
    summary="Precompute and persist dashboard aggregates",
)
async def precompute_dashboard(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    product_id: Optional[str] = Query(default=None),
    background: bool = Query(default=True),
) -> PrecomputeResponse:
    if background:
        background_tasks.add_task(recompute_aggregates_background, product_id)
        return PrecomputeResponse(status="accepted", mode="background", product_id=product_id)

    await recompute_aggregates(db, product_id=product_id)
    return PrecomputeResponse(status="completed", mode="sync", product_id=product_id)
