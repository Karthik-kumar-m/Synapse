"""Dashboard router – analytics, review listing, and anomaly reporting."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import Integer, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from config import settings
from logic.aggregates import recompute_aggregates, recompute_aggregates_background
from logic.ollama_client import generate_json
from models.aggregate import DashboardAggregate, ProductAnomalyAggregate, ProductAspectAggregate
from models.alert import AnomalyAlert
from models.review import Review
from schemas.alert import AlertResponse, DashboardSummary, PrecomputeResponse, ProductAIInsights, ProductSummary
from schemas.review import ReviewResponse

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


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

    if not aggregates:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No reviews found for product_id '{product_id}'.",
        )

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

    if not spikes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No reviews found for product_id '{product_id}'.",
        )

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
