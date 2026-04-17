"""Synapse API – Customer Review Intelligence Platform."""

from __future__ import annotations

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from database import Base, engine
from config import settings
from routers.ingestion import router as ingestion_router
from routers.dashboard import router as dashboard_router


class _HealthAccessFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        return '"GET /health HTTP/1.1"' not in message


def _configure_access_log_filter() -> None:
    access_logger = logging.getLogger("uvicorn.access")
    if any(isinstance(existing_filter, _HealthAccessFilter) for existing_filter in access_logger.filters):
        return
    access_logger.addFilter(_HealthAccessFilter())


async def _ensure_legacy_schema() -> None:
    async with engine.begin() as conn:
        def _migrate(sync_conn):
            inspector = inspect(sync_conn)
            review_columns = {column["name"] for column in inspector.get_columns("reviews")}

            if "batch_id" not in review_columns:
                sync_conn.execute(text("ALTER TABLE reviews ADD COLUMN batch_id VARCHAR(100)"))
            if "is_spam" not in review_columns:
                sync_conn.execute(text("ALTER TABLE reviews ADD COLUMN is_spam BOOLEAN NOT NULL DEFAULT FALSE"))
            if "spam_reason" not in review_columns:
                sync_conn.execute(text("ALTER TABLE reviews ADD COLUMN spam_reason VARCHAR(255)"))
            if "duplicate_cluster_id" not in review_columns:
                sync_conn.execute(text("ALTER TABLE reviews ADD COLUMN duplicate_cluster_id VARCHAR(255)"))
            if "category" not in review_columns:
                sync_conn.execute(text("ALTER TABLE reviews ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT 'Uncategorized'"))

            indexes = {index["name"] for index in inspector.get_indexes("reviews")}
            if "ix_reviews_batch_id" not in indexes:
                sync_conn.execute(text("CREATE INDEX ix_reviews_batch_id ON reviews (batch_id)"))
            if "ix_reviews_duplicate_cluster_id" not in indexes:
                sync_conn.execute(text("CREATE INDEX ix_reviews_duplicate_cluster_id ON reviews (duplicate_cluster_id)"))
            if "ix_reviews_category" not in indexes:
                sync_conn.execute(text("CREATE INDEX ix_reviews_category ON reviews (category)"))

        await conn.run_sync(_migrate)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _ensure_legacy_schema()
    yield
    await engine.dispose()


app = FastAPI(
    title="Synapse API",
    description=(
        "Customer Review Intelligence Platform — "
        "real-time ingestion, aspect-based sentiment analysis, "
        "and anomaly detection for product reviews."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

_configure_access_log_filter()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingestion_router)
app.include_router(dashboard_router)


@app.get("/", tags=["Health"])
async def root() -> dict:
    return {"status": "ok", "service": "Synapse API"}


@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    return {"status": "healthy", "version": "1.0.0"}
