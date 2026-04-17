"""Synapse API – Customer Review Intelligence Platform."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from routers.ingestion import router as ingestion_router
from routers.dashboard import router as dashboard_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
