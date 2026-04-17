"""Ingestion router – handles CSV, JSON, manual, and real-time review uploads."""

from __future__ import annotations

import io
import uuid
from typing import Any, Dict, List

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from logic.analytics import run_absa
from logic.preprocessing import DeduplicationEngine, is_bot_review, normalize_review
from models.review import AspectInsight, Review
from schemas.review import BulkUploadResponse, ReviewCreate, ReviewResponse

router = APIRouter(prefix="/api/ingest", tags=["Ingestion"])

_REQUIRED_CSV_COLUMNS = {"product_id", "product_name", "text"}


# ---------------------------------------------------------------------------
# Shared processing helpers
# ---------------------------------------------------------------------------

def _build_review_orm(
    product_id: str,
    product_name: str,
    raw_text: str,
    source: str,
    norm: dict,
    dedup_result: dict,
    bot_flag: bool,
) -> Review:
    return Review(
        id=uuid.uuid4(),
        product_id=product_id,
        product_name=product_name,
        raw_text=raw_text,
        cleaned_text=norm["cleaned_text"],
        language_detected=norm["language_detected"],
        is_bot=bot_flag,
        is_duplicate=dedup_result["is_duplicate"],
        overall_sentiment=norm["overall_sentiment"],
        overall_score=norm["final_sentiment_score"],
        source=source,
    )


def _build_aspect_insights(
    review_id: uuid.UUID,
    absa_result: dict,
) -> List[AspectInsight]:
    insights: List[AspectInsight] = []
    for aspect_data in absa_result["aspects"]:
        insight = AspectInsight(
            id=uuid.uuid4(),
            review_id=review_id,
            aspect=aspect_data["aspect"],
            sentiment=aspect_data["sentiment"],
            score=aspect_data["score"],
            confidence=aspect_data["confidence"],
            is_sarcastic=absa_result["is_sarcastic"],
            flagged_for_review=absa_result["flagged_for_human_review"],
        )
        insights.append(insight)
    return insights


async def _process_reviews_bulk(
    rows: List[Dict[str, Any]],
    source: str,
    db: AsyncSession,
) -> BulkUploadResponse:
    dedup_engine = DeduplicationEngine()
    total_processed = 0
    duplicates_quarantined = 0
    bots_quarantined = 0
    insights_generated = 0

    for row in rows:
        raw_text = str(row.get("text", row.get("raw_text", ""))).strip()
        product_id = str(row.get("product_id", "unknown"))
        product_name = str(row.get("product_name", "Unknown Product"))

        if not raw_text:
            continue

        norm = normalize_review(raw_text)
        cleaned = norm["cleaned_text"]

        bot_flag = is_bot_review(raw_text)
        dedup_result = dedup_engine.check_and_add(cleaned)

        review = _build_review_orm(
            product_id=product_id,
            product_name=product_name,
            raw_text=raw_text,
            source=source,
            norm=norm,
            dedup_result=dedup_result,
            bot_flag=bot_flag,
        )
        db.add(review)

        if dedup_result["is_duplicate"]:
            duplicates_quarantined += 1
        if bot_flag:
            bots_quarantined += 1

        if not bot_flag and not dedup_result["is_duplicate"]:
            absa_result = run_absa(cleaned, raw_text)
            for insight in _build_aspect_insights(review.id, absa_result):
                db.add(insight)
            insights_generated += absa_result["aspects_found"]

        total_processed += 1

    await db.flush()
    return BulkUploadResponse(
        total_processed=total_processed,
        duplicates_quarantined=duplicates_quarantined,
        bots_quarantined=bots_quarantined,
        insights_generated=insights_generated,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/csv",
    response_model=BulkUploadResponse,
    summary="Upload reviews via CSV file",
    status_code=status.HTTP_200_OK,
)
async def ingest_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> BulkUploadResponse:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .csv files are accepted.",
        )

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to parse CSV: {exc}",
        ) from exc

    missing = _REQUIRED_CSV_COLUMNS - set(df.columns.str.lower())
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Missing required columns: {missing}",
        )

    df.columns = df.columns.str.lower()
    rows = df.to_dict(orient="records")
    return await _process_reviews_bulk(rows, source="csv", db=db)


@router.post(
    "/json",
    response_model=BulkUploadResponse,
    summary="Upload reviews via JSON body",
    status_code=status.HTTP_200_OK,
)
async def ingest_json(
    reviews: List[Dict[str, Any]],
    db: AsyncSession = Depends(get_db),
) -> BulkUploadResponse:
    if not reviews:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request body must be a non-empty list of review objects.",
        )
    return await _process_reviews_bulk(reviews, source="json", db=db)


@router.post(
    "/manual",
    response_model=ReviewResponse,
    summary="Submit a single review manually",
    status_code=status.HTTP_201_CREATED,
)
async def ingest_manual(
    review_in: ReviewCreate,
    db: AsyncSession = Depends(get_db),
) -> ReviewResponse:
    norm = normalize_review(review_in.raw_text)
    cleaned = norm["cleaned_text"]

    bot_flag = is_bot_review(review_in.raw_text)
    dedup_engine = DeduplicationEngine()
    dedup_result = dedup_engine.check_and_add(cleaned)

    review = _build_review_orm(
        product_id=review_in.product_id,
        product_name=review_in.product_name,
        raw_text=review_in.raw_text,
        source=review_in.source,
        norm=norm,
        dedup_result=dedup_result,
        bot_flag=bot_flag,
    )
    db.add(review)

    aspects_response = []
    if not bot_flag and not dedup_result["is_duplicate"]:
        absa_result = run_absa(cleaned, review_in.raw_text)
        for insight in _build_aspect_insights(review.id, absa_result):
            db.add(insight)
            aspects_response.append(insight)

    await db.flush()
    await db.refresh(review)

    return ReviewResponse(
        id=review.id,
        product_id=review.product_id,
        product_name=review.product_name,
        raw_text=review.raw_text,
        cleaned_text=review.cleaned_text,
        language_detected=review.language_detected,
        is_bot=review.is_bot,
        is_duplicate=review.is_duplicate,
        overall_sentiment=review.overall_sentiment,
        overall_score=review.overall_score,
        created_at=review.created_at,
        source=review.source,
        aspects=[
            {
                "id": ins.id,
                "review_id": ins.review_id,
                "aspect": ins.aspect,
                "sentiment": ins.sentiment,
                "score": ins.score,
                "confidence": ins.confidence,
                "is_sarcastic": ins.is_sarcastic,
                "flagged_for_review": ins.flagged_for_review,
            }
            for ins in aspects_response
        ],
    )


@router.post(
    "/realtime-feed",
    summary="Simulated real-time review ingestion (async, up to 50 reviews)",
    status_code=status.HTTP_202_ACCEPTED,
)
async def ingest_realtime_feed(
    reviews: List[Dict[str, Any]],
    db: AsyncSession = Depends(get_db),
) -> dict:
    if len(reviews) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Real-time feed accepts at most 50 reviews per request.",
        )

    job_id = str(uuid.uuid4())

    await _process_reviews_bulk(reviews, source="api", db=db)

    return {"job_id": job_id, "status": "queued", "reviews_received": len(reviews)}
