import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, String
from sqlalchemy.dialects.postgresql import UUID

from database import Base


class AnomalyAlert(Base):
    __tablename__ = "anomaly_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(String(255), nullable=False, index=True)
    aspect = Column(String(100), nullable=False)
    baseline_pct = Column(Float, nullable=False)
    current_pct = Column(Float, nullable=False)
    spike_delta = Column(Float, nullable=False)
    triggered_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    severity = Column(String(20), nullable=False)
    is_resolved = Column(Boolean, default=False, nullable=False)
