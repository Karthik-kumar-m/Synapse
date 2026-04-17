import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from database import Base


class Review(Base):
    __tablename__ = "reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(String(255), nullable=False, index=True)
    product_name = Column(String(500), nullable=False)
    raw_text = Column(Text, nullable=False)
    cleaned_text = Column(Text, nullable=True)
    language_detected = Column(String(10), nullable=True)
    is_bot = Column(Boolean, default=False, nullable=False)
    is_duplicate = Column(Boolean, default=False, nullable=False)
    overall_sentiment = Column(String(20), nullable=True)
    overall_score = Column(Float, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    source = Column(
        Enum("csv", "json", "api", "manual", name="review_source_enum"),
        nullable=False,
    )

    aspects = relationship(
        "AspectInsight", back_populates="review", cascade="all, delete-orphan"
    )


class AspectInsight(Base):
    __tablename__ = "aspect_insights"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_id = Column(
        UUID(as_uuid=True), ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    aspect = Column(String(100), nullable=False)
    sentiment = Column(String(20), nullable=False)
    score = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False)
    is_sarcastic = Column(Boolean, default=False, nullable=False)
    flagged_for_review = Column(Boolean, default=False, nullable=False)

    review = relationship("Review", back_populates="aspects")
