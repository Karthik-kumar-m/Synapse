from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReviewCreate(BaseModel):
    product_id: str = Field(..., min_length=1, max_length=255)
    product_name: str = Field(..., min_length=1, max_length=500)
    raw_text: str = Field(..., min_length=1)
    category: Optional[str] = Field(default=None, max_length=100)
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
    category: Optional[str] = None
    raw_text: str
    translated_text: Optional[str] = None
    cleaned_text: Optional[str]
    language_detected: Optional[str]
    is_bot: bool
    is_spam: bool = False
    spam_reason: Optional[str] = None
    is_duplicate: bool
    duplicate_cluster_id: Optional[str] = None
    overall_sentiment: Optional[str]
    overall_score: Optional[float]
    created_at: datetime
    source: str
    source_review_id: Optional[str] = None
    rating: Optional[float] = None
    firmware_version: Optional[str] = None
    component_focus: Optional[str] = None
    aspects: List[AspectInsightResponse] = []


class BulkUploadResponse(BaseModel):
    total_processed: int
    duplicates_quarantined: int
    bots_quarantined: int
    spam_quarantined: int = 0
    insights_generated: int


class LLMInsight(BaseModel):
    feature: str = Field(..., min_length=1)
    sentiment: Literal["Positive", "Negative", "Neutral", "Ambiguous"]


class LLMReviewInsights(BaseModel):
    review_index: int = Field(..., ge=0)
    insights: List[LLMInsight] = Field(default_factory=list)


class LLMExtractionResponse(BaseModel):
    reviews: List[LLMReviewInsights] = Field(default_factory=list)

    @field_validator("reviews")
    @classmethod
    def dedupe_review_indices(cls, value: List[LLMReviewInsights]) -> List[LLMReviewInsights]:
        seen = set()
        for item in value:
            if item.review_index in seen:
                raise ValueError("Duplicate review_index detected in LLM response")
            seen.add(item.review_index)
        return value
