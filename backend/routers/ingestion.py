"""Ingestion router – handles CSV, JSON, manual, and real-time review uploads."""

from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from config import settings
from logic.analytics import run_absa_batch_ollama
from logic.aggregates import recompute_aggregates_background
from logic.ollama_client import generate_json
from logic.preprocessing import compute_similarity, is_bot_review, normalize_review
from models.review import AspectInsight, Review
from schemas.review import BulkUploadResponse, ReviewCreate, ReviewResponse

router = APIRouter(prefix="/api/ingest", tags=["Ingestion"])

_REQUIRED_CSV_COLUMNS = {"product_id", "product_name", "text"}


def _chunked(items: List[dict], size: int) -> List[List[dict]]:
    chunk_size = max(size, 1)
    return [items[idx:idx + chunk_size] for idx in range(0, len(items), chunk_size)]


async def _check_duplicate_in_db(
    db: AsyncSession,
    cleaned_text: str,
    product_id: str,
) -> dict:
    exact_match = await db.execute(
        select(Review.id)
        .where(
            Review.product_id == product_id,
            Review.cleaned_text == cleaned_text,
        )
        .limit(1)
    )
    if exact_match.scalar_one_or_none() is not None:
        return {
            "is_duplicate": True,
            "similarity_score": 1.0,
            "reason": "exact_text_match",
        }

    candidates_result = await db.execute(
        select(Review.cleaned_text)
        .where(
            Review.product_id == product_id,
            Review.cleaned_text.is_not(None),
            Review.cleaned_text != cleaned_text,
        )
        .order_by(Review.created_at.desc())
        .limit(settings.DEDUPE_CANDIDATE_LIMIT)
    )
    candidates = [row[0] for row in candidates_result.fetchall() if row[0]]

    best_similarity = 0.0
    for candidate in candidates:
        similarity = compute_similarity(cleaned_text, candidate)
        if similarity > best_similarity:
            best_similarity = similarity
        if best_similarity >= settings.DEDUPE_SIMILARITY_THRESHOLD:
            return {
                "is_duplicate": True,
                "similarity_score": round(best_similarity, 4),
                "reason": "cosine_similarity_above_threshold",
            }

    return {
        "is_duplicate": False,
        "similarity_score": round(best_similarity, 4),
        "reason": "unique",
    }


def _parse_created_at(row: Dict[str, Any]) -> datetime | None:
    raw = row.get("created_at") or row.get("date")
    if not raw:
        return None

    text = str(raw).strip()
    if not text:
        return None

    # Accept YYYY-MM-DD and ISO datetime variants.
    try:
        if len(text) == 10:
            dt = datetime.strptime(text, "%Y-%m-%d")
            return dt.replace(tzinfo=timezone.utc)

        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Shared processing helpers
# ---------------------------------------------------------------------------

def _build_review_orm(
    product_id: str,
    product_name: str,
    raw_text: str,
    source: str,
    created_at: datetime | None,
    norm: dict,
    dedup_result: dict,
    bot_flag: bool,
    source_review_id: str | None = None,
    rating: float | None = None,
    firmware_version: str | None = None,
    component_focus: str | None = None,
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
        created_at=created_at,
        source_review_id=source_review_id,
        rating=rating,
        firmware_version=firmware_version,
        component_focus=component_focus,
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
    total_processed = 0
    duplicates_quarantined = 0
    bots_quarantined = 0
    insights_generated = 0

    pending_for_analysis: List[dict] = []

    for row in rows:
        raw_text = str(row.get("text", row.get("raw_text", ""))).strip()
        product_id = str(row.get("product_id", "unknown"))
        product_name = str(row.get("product_name", "Unknown Product"))

        if not raw_text:
            continue

        norm = normalize_review(raw_text)
        cleaned = norm["cleaned_text"]

        bot_flag = is_bot_review(raw_text)
        dedup_result = await _check_duplicate_in_db(
            db=db,
            cleaned_text=cleaned,
            product_id=product_id,
        )
        created_at = _parse_created_at(row)

        # Extract optional enriched fields from CSV
        source_review_id = row.get("review_id")
        if source_review_id:
            source_review_id = str(source_review_id).strip()

        rating = None
        if row.get("rating") is not None:
            try:
                rating = float(row.get("rating"))
            except (ValueError, TypeError):
                rating = None

        firmware_version = row.get("firmware_version")
        if firmware_version:
            firmware_version = str(firmware_version).strip()

        component_focus = row.get("component_focus")
        if component_focus:
            component_focus = str(component_focus).strip()

        review = _build_review_orm(
            product_id=product_id,
            product_name=product_name,
            raw_text=raw_text,
            source=source,
            created_at=created_at,
            norm=norm,
            dedup_result=dedup_result,
            bot_flag=bot_flag,
            source_review_id=source_review_id,
            rating=rating,
            firmware_version=firmware_version,
            component_focus=component_focus,
        )
        db.add(review)
        await db.flush()

        if dedup_result["is_duplicate"]:
            duplicates_quarantined += 1
        if bot_flag:
            bots_quarantined += 1

        if not bot_flag and not dedup_result["is_duplicate"]:
            pending_for_analysis.append(
                {
                    "review": review,
                    "cleaned": cleaned,
                    "raw": raw_text,
                }
            )

        total_processed += 1

    for chunk in _chunked(pending_for_analysis, settings.OLLAMA_BATCH_SIZE):
        cleaned_batch = [item["cleaned"] for item in chunk]
        raw_batch = [item["raw"] for item in chunk]

        absa_results = await run_absa_batch_ollama(cleaned_batch, raw_batch)
        for item, absa_result in zip(chunk, absa_results):
            for insight in _build_aspect_insights(item["review"].id, absa_result):
                db.add(insight)
            insights_generated += absa_result["aspects_found"]

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
    background_tasks: BackgroundTasks,
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
    result = await _process_reviews_bulk(rows, source="csv", db=db)
    background_tasks.add_task(recompute_aggregates_background)
    return result


@router.post(
    "/json",
    response_model=BulkUploadResponse,
    summary="Upload reviews via JSON body",
    status_code=status.HTTP_200_OK,
)
async def ingest_json(
    reviews: List[Dict[str, Any]],
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> BulkUploadResponse:
    if not reviews:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request body must be a non-empty list of review objects.",
        )
    result = await _process_reviews_bulk(reviews, source="json", db=db)
    background_tasks.add_task(recompute_aggregates_background)
    return result


@router.post(
    "/manual",
    response_model=ReviewResponse,
    summary="Submit a single review manually",
    status_code=status.HTTP_201_CREATED,
)
async def ingest_manual(
    review_in: ReviewCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> ReviewResponse:
    norm = normalize_review(review_in.raw_text)
    cleaned = norm["cleaned_text"]

    bot_flag = is_bot_review(review_in.raw_text)

    dedup_result = await _check_duplicate_in_db(
        db=db,
        cleaned_text=cleaned,
        product_id=review_in.product_id,
    )
    is_dup = dedup_result["is_duplicate"]

    review = Review(
        id=uuid.uuid4(),
        product_id=review_in.product_id,
        product_name=review_in.product_name,
        raw_text=review_in.raw_text,
        cleaned_text=cleaned,
        language_detected=norm["language_detected"],
        is_bot=bot_flag,
        is_duplicate=is_dup,
        overall_sentiment=norm["overall_sentiment"],
        overall_score=norm["final_sentiment_score"],
        source=review_in.source,
    )
    db.add(review)

    aspects_response = []
    if not bot_flag and not is_dup:
        absa_result = (await run_absa_batch_ollama([cleaned], [review_in.raw_text]))[0]
        for insight in _build_aspect_insights(review.id, absa_result):
            db.add(insight)
            aspects_response.append(insight)

    await db.flush()
    await db.refresh(review)

    background_tasks.add_task(recompute_aggregates_background, review.product_id)

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
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict:
    if len(reviews) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Real-time feed accepts at most 50 reviews per request.",
        )

    job_id = str(uuid.uuid4())

    await _process_reviews_bulk(reviews, source="api", db=db)
    background_tasks.add_task(recompute_aggregates_background)

    return {"job_id": job_id, "status": "queued", "reviews_received": len(reviews)}


@router.get(
    "/ollama-health",
    summary="Check Ollama connectivity and JSON generation",
    status_code=status.HTTP_200_OK,
)
async def ollama_health_check() -> dict:
    prompt = (
        "Return strict JSON with this shape: "
        '{"ok": true, "model": "name", "note": "short"}'
    )

    try:
        result = await generate_json(prompt)
        return {
            "status": "ok",
            "ollama_base_url": settings.OLLAMA_BASE_URL,
            "primary_model": settings.OLLAMA_MODEL_PRIMARY,
            "fallback_model": settings.OLLAMA_MODEL_FALLBACK,
            "response": result,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Ollama check failed: {exc}",
        ) from exc
