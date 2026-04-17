from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ReviewCreate(BaseModel):
    product_id: str = Field(..., min_length=1, max_length=255)
    product_name: str = Field(..., min_length=1, max_length=500)
    raw_text: str = Field(..., min_length=1)
    source: str = Field(..., pattern="^(csv|json|api|manual)$")


class AspectInsightResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    review_id: uuid.UUID
    aspect: str
    sentiment: str
    score: float
    confidence: float
    is_sarcastic: bool
    flagged_for_review: bool


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: str
    product_name: str
    raw_text: str
    cleaned_text: Optional[str]
    language_detected: Optional[str]
    is_bot: bool
    is_duplicate: bool
    overall_sentiment: Optional[str]
    overall_score: Optional[float]
    created_at: datetime
    source: str
    aspects: List[AspectInsightResponse] = []


class BulkUploadResponse(BaseModel):
    total_processed: int
    duplicates_quarantined: int
    bots_quarantined: int
    insights_generated: int
