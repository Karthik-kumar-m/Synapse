from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: str
    aspect: str
    baseline_pct: float
    current_pct: float
    spike_delta: float
    triggered_at: datetime
    severity: str
    is_resolved: bool


class DashboardSummary(BaseModel):
    total_reviews: int
    avg_sentiment_score: float
    top_aspects: List[Dict[str, Any]]
    active_alerts: int
    bot_rate: float
    sarcasm_rate: float
