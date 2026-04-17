import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, JSON, String
from sqlalchemy.dialects.postgresql import UUID

from database import Base


class DashboardAggregate(Base):
    __tablename__ = "dashboard_aggregates"

    id = Column(String(50), primary_key=True, default="global")
    total_reviews = Column(Integer, nullable=False, default=0)
    avg_sentiment_score = Column(Float, nullable=False, default=0.0)
    top_aspects = Column(JSON, nullable=False, default=list)
    active_alerts = Column(Integer, nullable=False, default=0)
    bot_rate = Column(Float, nullable=False, default=0.0)
    sarcasm_rate = Column(Float, nullable=False, default=0.0)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class ProductAspectAggregate(Base):
    __tablename__ = "product_aspect_aggregates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(String(255), nullable=False, index=True)
    aspect = Column(String(100), nullable=False)
    count = Column(Integer, nullable=False, default=0)
    positive = Column(Integer, nullable=False, default=0)
    negative = Column(Integer, nullable=False, default=0)
    neutral = Column(Integer, nullable=False, default=0)
    ambiguous = Column(Integer, nullable=False, default=0)
    avg_score = Column(Float, nullable=False, default=0.0)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class ProductAnomalyAggregate(Base):
    __tablename__ = "product_anomaly_aggregates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(String(255), nullable=False, index=True)
    aspect = Column(String(100), nullable=False)
    baseline_pct = Column(Float, nullable=False)
    current_pct = Column(Float, nullable=False)
    spike_delta = Column(Float, nullable=False)
    severity = Column(String(20), nullable=False)
    is_systemic = Column(Boolean, nullable=False, default=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
