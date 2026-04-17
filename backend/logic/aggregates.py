"""Persisted aggregate recomputation utilities for dashboard reads."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, List

from sqlalchemy import case, delete, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from logic.anomaly import analyze_time_series
from models.aggregate import DashboardAggregate, ProductAnomalyAggregate, ProductAspectAggregate
from models.alert import AnomalyAlert
from models.review import AspectInsight, Review


async def _rebuild_product_aspect_aggregates(db: AsyncSession, product_id: str) -> None:
    await db.execute(
        delete(ProductAspectAggregate).where(ProductAspectAggregate.product_id == product_id)
    )

    rows = await db.execute(
        select(
            AspectInsight.aspect.label("aspect"),
            func.count(AspectInsight.id).label("count"),
            func.sum(case((AspectInsight.sentiment == "positive", 1), else_=0)).label("positive"),
            func.sum(case((AspectInsight.sentiment == "negative", 1), else_=0)).label("negative"),
            func.sum(case((AspectInsight.sentiment == "neutral", 1), else_=0)).label("neutral"),
            func.sum(case((AspectInsight.sentiment == "ambiguous", 1), else_=0)).label("ambiguous"),
            func.avg(AspectInsight.score).label("avg_score"),
        )
        .join(Review, Review.id == AspectInsight.review_id)
        .where(Review.product_id == product_id)
        .group_by(AspectInsight.aspect)
    )

    now = datetime.now(timezone.utc)
    for row in rows.fetchall():
        db.add(
            ProductAspectAggregate(
                product_id=product_id,
                aspect=row.aspect,
                count=int(row.count or 0),
                positive=int(row.positive or 0),
                negative=int(row.negative or 0),
                neutral=int(row.neutral or 0),
                ambiguous=int(row.ambiguous or 0),
                avg_score=float(row.avg_score or 0.0),
                updated_at=now,
            )
        )


async def _rebuild_product_anomaly_aggregates(db: AsyncSession, product_id: str) -> None:
    rows = await db.execute(
        select(Review.created_at, AspectInsight.aspect, AspectInsight.sentiment)
        .join(AspectInsight, Review.id == AspectInsight.review_id)
        .where(Review.product_id == product_id)
        .order_by(Review.created_at.asc())
    )

    review_data: List[dict] = [
        {
            "created_at": row.created_at,
            "aspect": row.aspect,
            "sentiment": row.sentiment,
        }
        for row in rows.fetchall()
    ]

    spikes = analyze_time_series(review_data)

    await db.execute(
        delete(ProductAnomalyAggregate).where(ProductAnomalyAggregate.product_id == product_id)
    )

    # Keep alerts as precomputed persistence for dashboard reads.
    await db.execute(
        delete(AnomalyAlert).where(
            AnomalyAlert.product_id == product_id,
            AnomalyAlert.is_resolved.is_(False),
        )
    )

    now = datetime.now(timezone.utc)
    for spike in spikes:
        db.add(
            ProductAnomalyAggregate(
                product_id=product_id,
                aspect=spike["aspect"],
                baseline_pct=spike["baseline_pct"],
                current_pct=spike["current_pct"],
                spike_delta=spike["spike_delta"],
                severity=spike["severity"],
                is_systemic=bool(spike.get("is_systemic", False)),
                updated_at=now,
            )
        )
        db.add(
            AnomalyAlert(
                product_id=product_id,
                aspect=spike["aspect"],
                baseline_pct=spike["baseline_pct"],
                current_pct=spike["current_pct"],
                spike_delta=spike["spike_delta"],
                severity=spike["severity"],
                is_resolved=False,
                triggered_at=now,
            )
        )


async def _all_product_ids(db: AsyncSession) -> List[str]:
    rows = await db.execute(select(distinct(Review.product_id)))
    return [row[0] for row in rows.fetchall() if row[0]]


async def _rebuild_dashboard_summary(db: AsyncSession) -> None:
    total_result = await db.execute(select(func.count(Review.id)))
    total_reviews = int(total_result.scalar_one() or 0)

    avg_result = await db.execute(select(func.avg(Review.overall_score)))
    avg_sentiment_score = float(avg_result.scalar_one() or 0.0)

    bot_count_result = await db.execute(
        select(func.count(Review.id)).where(Review.is_bot.is_(True))
    )
    bot_count = int(bot_count_result.scalar_one() or 0)

    sarcastic_count_result = await db.execute(
        select(func.count(AspectInsight.id)).where(AspectInsight.is_sarcastic.is_(True))
    )
    sarcastic_count = int(sarcastic_count_result.scalar_one() or 0)

    total_insights_result = await db.execute(select(func.count(AspectInsight.id)))
    total_insights = int(total_insights_result.scalar_one() or 0)

    top_rows = await db.execute(
        select(AspectInsight.aspect, func.count(AspectInsight.id).label("cnt"))
        .group_by(AspectInsight.aspect)
        .order_by(func.count(AspectInsight.id).desc())
        .limit(5)
    )
    top_aspects = [
        {"aspect": row.aspect, "count": int(row.cnt)}
        for row in top_rows.fetchall()
    ]

    active_alerts_result = await db.execute(
        select(func.count(AnomalyAlert.id)).where(AnomalyAlert.is_resolved.is_(False))
    )
    active_alerts = int(active_alerts_result.scalar_one() or 0)

    bot_rate = (bot_count / total_reviews) if total_reviews else 0.0
    sarcasm_rate = (sarcastic_count / total_insights) if total_insights else 0.0

    existing = await db.get(DashboardAggregate, "global")
    now = datetime.now(timezone.utc)
    if existing is None:
        existing = DashboardAggregate(id="global")
        db.add(existing)

    existing.total_reviews = total_reviews
    existing.avg_sentiment_score = round(avg_sentiment_score, 4)
    existing.top_aspects = top_aspects
    existing.active_alerts = active_alerts
    existing.bot_rate = round(bot_rate, 4)
    existing.sarcasm_rate = round(sarcasm_rate, 4)
    existing.updated_at = now


async def recompute_aggregates(db: AsyncSession, product_id: str | None = None) -> None:
    product_ids: Iterable[str]
    if product_id:
        product_ids = [product_id]
    else:
        product_ids = await _all_product_ids(db)

    for pid in product_ids:
        await _rebuild_product_aspect_aggregates(db, pid)
        await _rebuild_product_anomaly_aggregates(db, pid)

    await _rebuild_dashboard_summary(db)
    await db.flush()


async def recompute_aggregates_background(product_id: str | None = None) -> None:
    async with AsyncSessionLocal() as session:
        try:
            await recompute_aggregates(session, product_id=product_id)
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
