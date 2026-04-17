"""Dashboard router – analytics, review listing, and anomaly reporting."""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from logic.anomaly import analyze_time_series
from models.alert import AnomalyAlert
from models.review import AspectInsight, Review
from schemas.alert import AlertResponse, DashboardSummary
from schemas.review import ReviewResponse

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


# ---------------------------------------------------------------------------
# /summary
# ---------------------------------------------------------------------------

@router.get(
    "/summary",
    response_model=DashboardSummary,
    summary="Get platform-wide dashboard summary",
)
async def get_summary(db: AsyncSession = Depends(get_db)) -> DashboardSummary:
    total_result = await db.execute(select(func.count(Review.id)))
    total_reviews: int = total_result.scalar_one() or 0

    avg_result = await db.execute(select(func.avg(Review.overall_score)))
    avg_sentiment_score: float = float(avg_result.scalar_one() or 0.0)

    bot_count_result = await db.execute(
        select(func.count(Review.id)).where(Review.is_bot.is_(True))
    )
    bot_count: int = bot_count_result.scalar_one() or 0
    bot_rate = bot_count / total_reviews if total_reviews > 0 else 0.0

    sarcasm_result = await db.execute(
        select(func.count(AspectInsight.id)).where(AspectInsight.is_sarcastic.is_(True))
    )
    sarcastic_count: int = sarcasm_result.scalar_one() or 0

    total_insights_result = await db.execute(select(func.count(AspectInsight.id)))
    total_insights: int = total_insights_result.scalar_one() or 0
    sarcasm_rate = sarcastic_count / total_insights if total_insights > 0 else 0.0

    aspect_rows = await db.execute(
        select(AspectInsight.aspect, func.count(AspectInsight.id).label("cnt"))
        .group_by(AspectInsight.aspect)
        .order_by(func.count(AspectInsight.id).desc())
        .limit(5)
    )
    top_aspects = [
        {"aspect": row.aspect, "count": row.cnt} for row in aspect_rows.fetchall()
    ]

    alerts_result = await db.execute(
        select(func.count(AnomalyAlert.id)).where(AnomalyAlert.is_resolved.is_(False))
    )
    active_alerts: int = alerts_result.scalar_one() or 0

    return DashboardSummary(
        total_reviews=total_reviews,
        avg_sentiment_score=round(avg_sentiment_score, 4),
        top_aspects=top_aspects,
        active_alerts=active_alerts,
        bot_rate=round(bot_rate, 4),
        sarcasm_rate=round(sarcasm_rate, 4),
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
    result = await db.execute(
        select(Review)
        .options(selectinload(Review.aspects))
        .where(Review.product_id == product_id)
        .order_by(Review.created_at.desc())
    )
    reviews = result.scalars().all()

    if not reviews:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No reviews found for product_id '{product_id}'.",
        )

    aspect_totals: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"count": 0, "positive": 0, "negative": 0, "neutral": 0, "avg_score": 0.0}
    )
    reviews_data: List[dict] = []

    for review in reviews:
        for aspect_insight in review.aspects:
            asp = aspect_insight.aspect
            aspect_totals[asp]["count"] += 1
            aspect_totals[asp][aspect_insight.sentiment] += 1
            aspect_totals[asp]["avg_score"] += aspect_insight.score

            reviews_data.append(
                {
                    "created_at": review.created_at.isoformat(),
                    "aspect": asp,
                    "sentiment": aspect_insight.sentiment,
                }
            )

    aspect_summary: List[dict] = []
    for aspect, data in aspect_totals.items():
        count = data["count"]
        avg_score = data["avg_score"] / count if count > 0 else 0.0
        aspect_summary.append(
            {
                "aspect": aspect,
                "count": count,
                "positive": data["positive"],
                "negative": data["negative"],
                "neutral": data["neutral"],
                "avg_score": round(avg_score, 4),
            }
        )

    aspect_summary.sort(key=lambda x: x["count"], reverse=True)

    return {
        "product_id": product_id,
        "total_reviews": len(reviews),
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
    result = await db.execute(
        select(Review)
        .options(selectinload(Review.aspects))
        .where(Review.product_id == product_id)
        .order_by(Review.created_at.asc())
    )
    reviews = result.scalars().all()

    if not reviews:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No reviews found for product_id '{product_id}'.",
        )

    reviews_data: List[dict] = []
    for review in reviews:
        for aspect_insight in review.aspects:
            reviews_data.append(
                {
                    "created_at": review.created_at.isoformat(),
                    "aspect": aspect_insight.aspect,
                    "sentiment": aspect_insight.sentiment,
                }
            )

    spikes = analyze_time_series(reviews_data)

    active_alerts_result = await db.execute(
        select(AnomalyAlert).where(
            AnomalyAlert.product_id == product_id,
            AnomalyAlert.is_resolved.is_(False),
        )
    )
    active_alerts = active_alerts_result.scalars().all()

    return {
        "product_id": product_id,
        "total_reviews_analysed": len(reviews),
        "detected_spikes": spikes,
        "active_alerts": [AlertResponse.model_validate(a) for a in active_alerts],
        "spike_count": len(spikes),
        "systemic_failures": [s for s in spikes if s.get("is_systemic")],
    }
