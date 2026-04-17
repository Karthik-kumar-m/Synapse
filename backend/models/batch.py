import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, JSON, String
from sqlalchemy.orm import relationship

from database import Base


class IngestionBatch(Base):
    __tablename__ = "ingestion_batches"

    batch_id = Column(String(100), primary_key=True)
    upload_time = Column(DateTime(timezone=True), nullable=True)
    total_images = Column(Integer, nullable=False, default=0)
    source = Column(String(50), nullable=False, default="json")
    batch_metadata = Column(JSON, nullable=False, default=dict)
    aggregated_insights = Column(JSON, nullable=False, default=dict)
    recommendations = Column(JSON, nullable=False, default=list)
    raw_payload = Column(JSON, nullable=False, default=dict)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    reviews = relationship("Review", back_populates="batch")
