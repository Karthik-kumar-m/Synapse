from __future__ import annotations

import argparse
import asyncio
from typing import Sequence

from sqlalchemy import select

from database import AsyncSessionLocal
from logic.preprocessing import normalize_review
from models.review import Review


async def backfill(batch_size: int, dry_run: bool) -> None:
    processed = 0
    updated = 0

    async with AsyncSessionLocal() as session:
        while True:
            rows = await session.execute(
                select(Review)
                .where(Review.translated_text.is_(None))
                .order_by(Review.created_at.asc())
                .limit(batch_size)
            )
            reviews: Sequence[Review] = rows.scalars().all()
            if not reviews:
                break

            for review in reviews:
                processed += 1
                norm = normalize_review(review.raw_text)
                translated = norm.get("translated_text")
                if translated and translated != review.translated_text:
                    updated += 1
                    if not dry_run:
                        review.translated_text = translated
                        # Keep cleaned text in sync for older rows that may have stale values.
                        review.cleaned_text = norm.get("cleaned_text")
                        review.language_detected = norm.get("language_detected")

            if not dry_run:
                await session.commit()
            else:
                await session.rollback()

            print(f"Processed {processed} rows so far; pending updates: {updated}")

    mode = "DRY RUN" if dry_run else "APPLIED"
    print(f"[{mode}] Backfill complete. Processed={processed}, Updated={updated}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill translated_text for existing reviews")
    parser.add_argument("--batch-size", type=int, default=200, help="Rows to process per batch")
    parser.add_argument("--dry-run", action="store_true", help="Calculate updates without saving")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    asyncio.run(backfill(batch_size=max(args.batch_size, 1), dry_run=args.dry_run))
