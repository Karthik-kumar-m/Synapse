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
from logic.preprocessing import compute_similarity, is_bot_review, is_spam_review, normalize_review
from models.batch import IngestionBatch
from models.review import AspectInsight, Review
from schemas.review import BulkUploadResponse, ReviewCreate, ReviewResponse

router = APIRouter(prefix="/api/ingest", tags=["Ingestion"])

_REQUIRED_CSV_COLUMNS = {"product_id", "product_name", "text"}

_CSV_COLUMN_ALIASES = {
    "product_id": ["product_id", "product", "productid", "id", "sku"],
    "product_name": ["product_name", "productname", "product", "name", "title"],
    "text": ["text", "raw_text", "review_text", "comment", "content", "message"],
    "category": ["category", "segment", "vertical", "product_category"],
}

_DEFAULT_CATEGORY = "Uncategorized"
_KNOWN_CATEGORIES = {
    "consumer electronics": "Consumer Electronics",
    "home appliances": "Home Appliances",
    "software services": "Software Services",
}


def _canonical_category(raw_category: Any) -> str:
    if raw_category is None:
        return _DEFAULT_CATEGORY
    raw = str(raw_category).strip()
    if not raw:
        return _DEFAULT_CATEGORY
    mapped = _KNOWN_CATEGORIES.get(raw.lower())
    return mapped if mapped else raw


def _infer_category(product_name: str, component_focus: str | None, raw_text: str) -> str:
    haystack = f"{product_name} {component_focus or ''} {raw_text}".lower()

    software_terms = {
        "app", "ui", "software", "portal", "subscription", "api", "login", "dashboard", "saas",
    }
    appliance_terms = {
        "fridge", "refrigerator", "washing", "machine", "microwave", "ac", "air conditioner", "mixer", "oven",
    }
    electronics_terms = {
        "phone", "mobile", "laptop", "earbuds", "headphone", "camera", "display", "battery", "bluetooth",
    }

    if any(term in haystack for term in software_terms):
        return "Software Services"
    if any(term in haystack for term in appliance_terms):
        return "Home Appliances"
    if any(term in haystack for term in electronics_terms):
        return "Consumer Electronics"
    return _DEFAULT_CATEGORY


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
    exact_match_id = exact_match.scalar_one_or_none()
    if exact_match_id is not None:
        return {
            "is_duplicate": True,
            "similarity_score": 1.0,
            "reason": "exact_text_match",
            "matched_review_id": str(exact_match_id),
        }

    candidates_result = await db.execute(
        select(Review.id, Review.cleaned_text)
        .where(
            Review.product_id == product_id,
            Review.cleaned_text.is_not(None),
            Review.cleaned_text != cleaned_text,
        )
        .order_by(Review.created_at.desc())
        .limit(settings.DEDUPE_CANDIDATE_LIMIT)
    )
    candidates = [(str(row[0]), row[1]) for row in candidates_result.fetchall() if row[1]]

    best_similarity = 0.0
    best_match_review_id: str | None = None
    for candidate_review_id, candidate_text in candidates:
        similarity = compute_similarity(cleaned_text, candidate_text)
        if similarity > best_similarity:
            best_similarity = similarity
            best_match_review_id = candidate_review_id
        if best_similarity >= settings.DEDUPE_SIMILARITY_THRESHOLD:
            return {
                "is_duplicate": True,
                "similarity_score": round(best_similarity, 4),
                "reason": "cosine_similarity_above_threshold",
                "matched_review_id": best_match_review_id,
            }

    return {
        "is_duplicate": False,
        "similarity_score": round(best_similarity, 4),
        "reason": "unique",
        "matched_review_id": None,
    }


def _parse_created_at(row: Dict[str, Any]) -> datetime | None:
    raw = row.get("created_at") or row.get("date") or row.get("upload_time")
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


def _normalize_review_source(raw_source: Any, default: str = "json") -> str:
    source = str(raw_source).strip().lower() if raw_source is not None else default
    return source if source in {"csv", "json", "api", "manual"} else default


def _normalize_csv_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    renamed = {column: column.strip().lower().lstrip("\ufeff") for column in df.columns}
    df = df.rename(columns=renamed)

    resolved_columns: dict[str, str] = {}
    available_columns = list(df.columns)

    for canonical_name, aliases in _CSV_COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in available_columns:
                resolved_columns[canonical_name] = alias
                break

    if "product_id" not in resolved_columns:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Missing required columns: product_id",
        )

    if "text" not in resolved_columns:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Missing required columns: text",
        )

    if "product_name" not in resolved_columns:
        df["product_name"] = df[resolved_columns["product_id"]].astype(str).str.strip()

    if "source" not in df.columns:
        df["source"] = "csv"

    if "created_at" not in df.columns and "date" not in df.columns:
        df["created_at"] = None

    if "category" not in resolved_columns and "category" not in df.columns:
        df["category"] = _DEFAULT_CATEGORY

    df["product_id"] = df[resolved_columns["product_id"]].astype(str).str.strip()
    df["text"] = df[resolved_columns["text"]].astype(str).str.strip()

    if "product_name" not in df.columns or df["product_name"].isna().all():
        df["product_name"] = df[resolved_columns["product_id"]].astype(str).str.strip()

    if "category" in resolved_columns:
        df["category"] = df[resolved_columns["category"]].astype(str).str.strip()
    df["category"] = df["category"].apply(_canonical_category)

    return df


def _compose_multimodal_text(image: Dict[str, Any]) -> str:
    review_block = image.get("review") or {}
    text_en = str(review_block.get("text_en", "")).strip()
    text_hinglish = str(review_block.get("text_hinglish", "")).strip()

    if text_en and text_hinglish:
        return f"{text_en}\nHinglish: {text_hinglish}"
    return text_en or text_hinglish


def _first_non_empty(*values: Any) -> str | None:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def _infer_review_row(item: Dict[str, Any], default_source: str = "json") -> Dict[str, Any]:
    product = item.get("product") or {}
    review_block = item.get("review") or {}
    analysis = item.get("analysis") or {}
    issues = analysis.get("issues") or []
    first_issue = issues[0] if issues and isinstance(issues[0], dict) else {}

    product_id = _first_non_empty(
        item.get("product_id"),
        product.get("product_id"),
        item.get("id"),
    ) or "unknown"

    product_name = _first_non_empty(
        item.get("product_name"),
        product.get("name"),
        product.get("product_name"),
        analysis.get("detected_product"),
        item.get("detected_product"),
        item.get("name"),
    ) or "Unknown Product"

    text_value = _first_non_empty(
        item.get("text"),
        item.get("raw_text"),
        review_block.get("text_en"),
        review_block.get("text_hinglish"),
    )
    if text_value is None and (review_block.get("text_en") or review_block.get("text_hinglish")):
        text_value = _compose_multimodal_text(item)

    component_focus = _first_non_empty(
        item.get("component_focus"),
        analysis.get("detected_product"),
        first_issue.get("type"),
        product.get("category"),
    )

    raw_category = _first_non_empty(
        item.get("category"),
        product.get("category"),
        analysis.get("category"),
    )
    category = _canonical_category(raw_category)
    if category == _DEFAULT_CATEGORY and text_value is not None:
        category = _infer_category(product_name, component_focus, text_value)

    return {
        "product_id": product_id,
        "product_name": product_name,
        "text": text_value,
        "review_id": _first_non_empty(item.get("review_id"), review_block.get("review_id")),
        "created_at": _first_non_empty(item.get("timestamp"), item.get("created_at"), review_block.get("timestamp")),
        "source": _normalize_review_source(_first_non_empty(item.get("source"), default_source)),
        "category": category,
        "component_focus": component_focus,
        "rating": item.get("rating"),
        "firmware_version": _first_non_empty(item.get("firmware_version"), review_block.get("firmware_version")),
    }


def _normalise_json_payload(payload: Any, batch_id: str | None = None) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        normalized_rows = [_infer_review_row(item) for item in payload if isinstance(item, dict)]
        if batch_id:
            for row in normalized_rows:
                row["batch_id"] = batch_id
        return normalized_rows

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="JSON body must be a list of review objects or an envelope with an 'images' array.",
        )

    images = payload.get("images")
    if not isinstance(images, list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="JSON body must include an 'images' array when using the batch envelope format.",
        )

    batch_source = (payload.get("batch_metadata") or {}).get("source", "json")
    rows: List[Dict[str, Any]] = []

    for image in images:
        if not isinstance(image, dict):
            continue

        inferred_row = _infer_review_row(image, default_source=batch_source)
        if inferred_row.get("text") is None:
            continue
        if batch_id:
            inferred_row["batch_id"] = batch_id
        rows.append(inferred_row)

    return rows


def _build_batch_record(payload: Dict[str, Any]) -> IngestionBatch:
    batch_metadata = payload.get("batch_metadata") or {}
    images = payload.get("images") or []
    batch_id = str(batch_metadata.get("batch_id") or payload.get("batch_id") or uuid.uuid4())
    upload_time = _parse_created_at(batch_metadata) or _parse_created_at(payload) or datetime.now(timezone.utc)

    return IngestionBatch(
        batch_id=batch_id,
        upload_time=upload_time,
        total_images=int(batch_metadata.get("total_images") or len(images) or 0),
        source=str(batch_metadata.get("source") or payload.get("source") or "json"),
        batch_metadata=batch_metadata,
        aggregated_insights=payload.get("aggregated_insights") or {},
        recommendations=payload.get("recommendations") or [],
        raw_payload=payload,
    )


def _build_file_batch_record(filename: str | None, rows: List[Dict[str, Any]], source: str) -> IngestionBatch:
    batch_id = str(uuid.uuid4())
    return IngestionBatch(
        batch_id=batch_id,
        upload_time=datetime.now(timezone.utc),
        total_images=len(rows),
        source=source,
        batch_metadata={
            "source": source,
            "filename": filename,
            "row_count": len(rows),
        },
        aggregated_insights={},
        recommendations=[],
        raw_payload={
            "filename": filename,
            "rows": rows,
        },
    )


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
    spam_flag: bool = False,
    spam_reason: str | None = None,
    batch_id: str | None = None,
    source_review_id: str | None = None,
    rating: float | None = None,
    firmware_version: str | None = None,
    component_focus: str | None = None,
    category: str = _DEFAULT_CATEGORY,
) -> Review:
    return Review(
        id=uuid.uuid4(),
        batch_id=batch_id,
        product_id=product_id,
        product_name=product_name,
        category=_canonical_category(category),
        raw_text=raw_text,
        cleaned_text=norm["cleaned_text"],
        language_detected=norm["language_detected"],
        is_bot=bot_flag,
        is_spam=spam_flag,
        spam_reason=spam_reason,
        is_duplicate=dedup_result["is_duplicate"],
        duplicate_cluster_id=dedup_result.get("matched_review_id"),
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
    batch_id: str | None = None,
) -> BulkUploadResponse:
    total_processed = 0
    duplicates_quarantined = 0
    bots_quarantined = 0
    spam_quarantined = 0
    insights_generated = 0

    pending_for_analysis: List[dict] = []

    for row in rows:
        if batch_id and not row.get("batch_id"):
            row["batch_id"] = batch_id

        raw_text = str(row.get("text", row.get("raw_text", ""))).strip()
        product_id = str(row.get("product_id", "unknown"))
        product_name = str(row.get("product_name", "Unknown Product"))

        if not raw_text:
            continue

        norm = normalize_review(raw_text)
        cleaned = norm["cleaned_text"]

        bot_flag = is_bot_review(raw_text)
        spam_flag, spam_reason = is_spam_review(raw_text)
        dedup_result = await _check_duplicate_in_db(
            db=db,
            cleaned_text=cleaned,
            product_id=product_id,
        )
        created_at = _parse_created_at(row)

        # Extract optional enriched fields from CSV
        batch_id = row.get("batch_id")
        if batch_id:
            batch_id = str(batch_id).strip()

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

        category = _canonical_category(row.get("category"))
        if category == _DEFAULT_CATEGORY:
            category = _infer_category(product_name, component_focus, raw_text)

        review = _build_review_orm(
            product_id=product_id,
            product_name=product_name,
            raw_text=raw_text,
            source=source,
            created_at=created_at,
            norm=norm,
            dedup_result=dedup_result,
            bot_flag=bot_flag,
            spam_flag=spam_flag,
            spam_reason=spam_reason,
            batch_id=batch_id,
            source_review_id=source_review_id,
            rating=rating,
            firmware_version=firmware_version,
            component_focus=component_focus,
            category=category,
        )
        db.add(review)
        await db.flush()

        if dedup_result["is_duplicate"]:
            duplicates_quarantined += 1
        if bot_flag:
            bots_quarantined += 1
        if spam_flag:
            spam_quarantined += 1

        if not bot_flag and not spam_flag and not dedup_result["is_duplicate"]:
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
        spam_quarantined=spam_quarantined,
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

    df = _normalize_csv_dataframe(df)
    rows = df.to_dict(orient="records")
    batch_record = _build_file_batch_record(file.filename, rows, source="csv")
    db.add(batch_record)
    await db.flush()

    result = await _process_reviews_bulk(rows, source="csv", db=db, batch_id=batch_record.batch_id)
    background_tasks.add_task(recompute_aggregates_background)
    return result


@router.post(
    "/json",
    response_model=BulkUploadResponse,
    summary="Upload reviews via JSON body",
    status_code=status.HTTP_200_OK,
)
async def ingest_json(
    reviews: List[Dict[str, Any]] | Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> BulkUploadResponse:
    batch_record = None
    batch_id = None
    if isinstance(reviews, dict):
        batch_record = _build_batch_record(reviews)
        batch_id = batch_record.batch_id
        db.add(batch_record)
        await db.flush()

    normalized_rows = _normalise_json_payload(reviews, batch_id=batch_id)
    if not normalized_rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request body must be a non-empty list of review objects.",
        )
    result = await _process_reviews_bulk(normalized_rows, source="json", db=db)
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
    spam_flag, spam_reason = is_spam_review(review_in.raw_text)

    dedup_result = await _check_duplicate_in_db(
        db=db,
        cleaned_text=cleaned,
        product_id=review_in.product_id,
    )
    is_dup = dedup_result["is_duplicate"]

    batch_record = IngestionBatch(
        batch_id=str(uuid.uuid4()),
        upload_time=datetime.now(timezone.utc),
        total_images=1,
        source="manual",
        batch_metadata={
            "source": "manual",
            "product_id": review_in.product_id,
            "product_name": review_in.product_name,
        },
        aggregated_insights={},
        recommendations=[],
        raw_payload={
            "review": review_in.model_dump(),
        },
    )
    db.add(batch_record)
    await db.flush()

    review = Review(
        id=uuid.uuid4(),
        batch_id=batch_record.batch_id,
        product_id=review_in.product_id,
        product_name=review_in.product_name,
        category=_canonical_category(review_in.category)
        if review_in.category
        else _infer_category(review_in.product_name, None, review_in.raw_text),
        raw_text=review_in.raw_text,
        cleaned_text=cleaned,
        language_detected=norm["language_detected"],
        is_bot=bot_flag,
        is_spam=spam_flag,
        spam_reason=spam_reason,
        is_duplicate=is_dup,
        duplicate_cluster_id=dedup_result.get("matched_review_id"),
        overall_sentiment=norm["overall_sentiment"],
        overall_score=norm["final_sentiment_score"],
        source=review_in.source,
    )
    db.add(review)

    aspects_response = []
    if not bot_flag and not spam_flag and not is_dup:
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
        category=review.category,
        raw_text=review.raw_text,
        cleaned_text=review.cleaned_text,
        language_detected=review.language_detected,
        is_bot=review.is_bot,
        is_spam=review.is_spam,
        spam_reason=review.spam_reason,
        is_duplicate=review.is_duplicate,
        duplicate_cluster_id=review.duplicate_cluster_id,
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
