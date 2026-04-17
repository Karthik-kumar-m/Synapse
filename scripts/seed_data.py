"""Seed script – populates the DB with 200 synthetic reviews.

Usage:
    DB_URL=postgresql://postgres:postgres@localhost:5432/synapse python scripts/seed_data.py

The script uses asyncpg directly (no SQLAlchemy ORM) for simplicity.
"""

from __future__ import annotations

import asyncio
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DB_URL: str = os.getenv(
    "DB_URL", "postgresql://postgres:postgres@localhost:5432/synapse"
)

# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------
PRODUCTS = [
    {"product_id": "iphone-15-pro", "product_name": "iPhone 15 Pro"},
    {"product_id": "samsung-s24", "product_name": "Samsung Galaxy S24"},
    {"product_id": "oneplus-12", "product_name": "OnePlus 12"},
]

# ---------------------------------------------------------------------------
# Review templates
# ---------------------------------------------------------------------------
NORMAL_REVIEW_TEMPLATES = [
    # Battery
    "The battery life on this phone is {battery_adj}. I {battery_verb} it.",
    "Battery backup is {battery_adj} - lasts {battery_hours} hours easily.",
    "Bahut {battery_adj} battery hai, {battery_verb} kiya isko.",
    # Speed
    "Performance is {speed_adj}. Apps open {speed_adv} and no lag at all.",
    "The speed is {speed_adj}, very {speed_adv} in daily use.",
    "Ekdum {speed_adj} hai performance, bahut smooth experience.",
    # Camera
    "Camera quality is {camera_adj}. Photos come out {camera_result}.",
    "The camera takes {camera_adj} pictures, especially in low light.",
    "Camera {camera_adj} hai, selfies aur photos {camera_result} aate hain.",
    # Display
    "The display is {display_adj}, colors look {display_color}.",
    "Screen quality is {display_adj} with {display_color} color reproduction.",
    "Display ekdum {display_adj} hai, bright aur {display_color}.",
    # Build Quality
    "Build quality feels {build_adj}. The device is {build_feel}.",
    "The phone feels {build_adj} in hand, very {build_feel}.",
    "Build quality {build_adj} hai, solid aur {build_feel} lagti hai.",
    # Price
    "For this price, the value is {value_adj}. {value_comment}.",
    "At this price point, it offers {value_adj} value for money.",
    "Is price mein {value_adj} hai, paisa {value_comment}.",
    # Delivery
    "Delivery was {delivery_adj}. Package arrived {delivery_time}.",
    "Shipping was {delivery_adj} and the phone arrived {delivery_time}.",
    "Delivery {delivery_adj} thi, {delivery_time} mila product.",
    # Software
    "The UI is {software_adj} and easy to navigate.",
    "Software experience is {software_adj} with regular updates.",
    "UI/Software {software_adj} hai, smooth aur {software_feel} experience.",
    # Customer Support
    "Customer support was {support_adj}. They {support_action}.",
    "Support team was {support_adj} and resolved my issue {support_speed}.",
    "Customer service {support_adj} hai, problem {support_speed} solve ki.",
]

PACKAGING_COMPLAINT_TEMPLATES = [
    "The packaging was terrible! The box arrived completely crushed and damaged.",
    "Very disappointed - the package was dented and the phone box was open.",
    "Packaging is pathetic. Product came in a broken box, seal was tampered.",
    "Received a damaged package. The delivery box was crushed beyond recognition.",
    "Box arrived in a terrible condition, packaging completely damaged.",
    "The package was so badly wrapped that the phone box was dented.",
    "Horrible packaging! Box was open, wrapper was torn, seal broken.",
    "Package arrived crushed. The box inside was also damaged. Very bad.",
    "Packaging bekar hai! Toot hua box aaya, damaged condition mein.",
    "Delivery box was badly dented, internal packaging was also crushed.",
    "Packaging ki quality bahut kharab hai. Toot ke aaya saman.",
    "Received tampered package! Box was open and resealed improperly.",
    "The wrapper was torn, packaging was damaged and box was crushed.",
    "Very poor packaging. The box was dented and the product wrapper was torn.",
    "Shocked to see damaged package! Box completely crushed, seal broken.",
]

SARCASTIC_TEMPLATES = [
    "Yeah right, great phone that crashes every 5 minutes. Love it!",
    "Oh sure, the camera is 'amazing' - takes blurry photos even in daylight. Wow.",
    "Thanks for nothing! Support team totally solved my problem... NOT.",
    "Great job team, the battery drains in 2 hours. Absolutely brilliant.",
    "Love how the software doesn't even update properly. Fantastic experience!",
    "Totally amazing speed - lags every single time I open an app. So impressed.",
    "Oh wow, the display is so bright I can barely see anything in sunlight. Perfect.",
]

# ---------------------------------------------------------------------------
# Template fillers
# ---------------------------------------------------------------------------
FILLERS = {
    "battery_adj": ["great", "excellent", "decent", "poor", "terrible", "amazing", "bad"],
    "battery_verb": ["love", "recommend", "am happy with", "regret buying", "appreciate"],
    "battery_hours": ["18", "24", "36", "12", "8", "48"],
    "speed_adj": ["excellent", "fast", "average", "sluggish", "blazing fast", "slow", "smooth"],
    "speed_adv": ["quickly", "smoothly", "seamlessly", "slowly", "instantly"],
    "camera_adj": ["stunning", "excellent", "average", "poor", "incredible", "mediocre"],
    "camera_result": ["sharp", "clear", "blurry", "vibrant", "detailed", "grainy"],
    "display_adj": ["stunning", "vivid", "bright", "dim", "excellent", "mediocre"],
    "display_color": ["vivid", "accurate", "oversaturated", "dull", "vibrant"],
    "build_adj": ["premium", "solid", "cheap", "sturdy", "flimsy", "robust"],
    "build_feel": ["well-built", "durable", "fragile", "reliable", "quality"],
    "value_adj": ["excellent", "good", "fair", "poor", "outstanding", "average"],
    "value_comment": ["well spent", "wasted", "worth every rupee", "not worth it"],
    "delivery_adj": ["fast", "on time", "delayed", "quick", "slow", "prompt"],
    "delivery_time": ["in 2 days", "on the expected date", "3 days late", "early", "ahead of schedule"],
    "software_adj": ["intuitive", "clean", "bloated", "responsive", "laggy", "polished"],
    "software_feel": ["pleasant", "frustrating", "satisfying", "annoying"],
    "support_adj": ["helpful", "responsive", "slow", "excellent", "terrible", "professional"],
    "support_action": ["resolved my issue quickly", "were unhelpful", "provided great guidance"],
    "support_speed": ["immediately", "within 24 hours", "after 3 days", "very quickly"],
}


def fill_template(template: str) -> str:
    result = template
    for key, values in FILLERS.items():
        placeholder = "{" + key + "}"
        if placeholder in result:
            result = result.replace(placeholder, random.choice(values))
    return result


def make_normal_review() -> str:
    return fill_template(random.choice(NORMAL_REVIEW_TEMPLATES))


def make_packaging_complaint() -> str:
    return random.choice(PACKAGING_COMPLAINT_TEMPLATES)


def make_sarcastic_review() -> str:
    return random.choice(SARCASTIC_TEMPLATES)


# ---------------------------------------------------------------------------
# Async seed logic
# ---------------------------------------------------------------------------

async def seed(conn: asyncpg.Connection) -> None:
    print("Starting seed...")

    now = datetime.now(timezone.utc)
    review_records = []
    insight_records = []

    sarcastic_indices = random.sample(range(150), k=5)

    # --- First 150 reviews: normal distribution ---
    for i in range(150):
        rand = random.random()
        if i in sarcastic_indices:
            raw_text = make_sarcastic_review()
        elif rand < 0.08:
            raw_text = make_packaging_complaint()
        else:
            raw_text = make_normal_review()

        product = random.choice(PRODUCTS)
        days_ago = random.randint(8, 60)
        created_at = now - timedelta(days=days_ago)

        review_id = str(uuid.uuid4())
        review_records.append(
            {
                "id": review_id,
                "product_id": product["product_id"],
                "product_name": product["product_name"],
                "raw_text": raw_text,
                "cleaned_text": raw_text.lower(),
                "language_detected": "en",
                "is_bot": False,
                "is_duplicate": False,
                "overall_sentiment": random.choice(["positive", "negative", "neutral"]),
                "overall_score": round(random.uniform(-0.8, 0.9), 4),
                "created_at": created_at,
                "source": random.choice(["csv", "json", "api", "manual"]),
            }
        )

        # Aspect insights
        if random.random() < 0.85:
            aspects_to_add = random.sample(
                [
                    "Battery Life", "Speed", "Camera", "Display",
                    "Build Quality", "Price/Value", "Delivery", "Software/UI",
                ],
                k=random.randint(1, 3),
            )
            for aspect in aspects_to_add:
                score = round(random.uniform(-0.8, 0.9), 4)
                if score > 0.1:
                    sentiment = "positive"
                elif score < -0.1:
                    sentiment = "negative"
                else:
                    sentiment = "neutral"

                insight_records.append(
                    {
                        "id": str(uuid.uuid4()),
                        "review_id": review_id,
                        "aspect": aspect,
                        "sentiment": sentiment,
                        "score": score,
                        "confidence": round(random.uniform(0.3, 0.95), 4),
                        "is_sarcastic": i in sarcastic_indices,
                        "flagged_for_review": False,
                    }
                )

        # Normal packaging complaint for non-sarcastic reviews at ~8%
        if "packaging" in raw_text.lower() or "package" in raw_text.lower() or "box" in raw_text.lower():
            insight_records.append(
                {
                    "id": str(uuid.uuid4()),
                    "review_id": review_id,
                    "aspect": "Packaging",
                    "sentiment": "negative" if "terrible" in raw_text.lower() or "damaged" in raw_text.lower() or "crushed" in raw_text.lower() else "neutral",
                    "score": round(random.uniform(-0.7, -0.2), 4),
                    "confidence": round(random.uniform(0.5, 0.9), 4),
                    "is_sarcastic": False,
                    "flagged_for_review": False,
                }
            )

    # --- Last 50 reviews: iPhone 15 Pro packaging spike (~38%) ---
    iphone = PRODUCTS[0]
    for j in range(50):
        rand = random.random()
        if rand < 0.38:
            raw_text = make_packaging_complaint()
            is_packaging = True
        else:
            raw_text = make_normal_review()
            is_packaging = False

        days_ago = random.randint(0, 6)
        created_at = now - timedelta(days=days_ago, hours=random.randint(0, 23))

        review_id = str(uuid.uuid4())
        review_records.append(
            {
                "id": review_id,
                "product_id": iphone["product_id"],
                "product_name": iphone["product_name"],
                "raw_text": raw_text,
                "cleaned_text": raw_text.lower(),
                "language_detected": "en",
                "is_bot": False,
                "is_duplicate": False,
                "overall_sentiment": "negative" if is_packaging else random.choice(["positive", "neutral"]),
                "overall_score": round(random.uniform(-0.8, -0.3) if is_packaging else random.uniform(0.1, 0.8), 4),
                "created_at": created_at,
                "source": random.choice(["csv", "json", "api"]),
            }
        )

        if is_packaging:
            insight_records.append(
                {
                    "id": str(uuid.uuid4()),
                    "review_id": review_id,
                    "aspect": "Packaging",
                    "sentiment": "negative",
                    "score": round(random.uniform(-0.85, -0.4), 4),
                    "confidence": round(random.uniform(0.65, 0.95), 4),
                    "is_sarcastic": False,
                    "flagged_for_review": False,
                }
            )
        else:
            aspects_to_add = random.sample(
                ["Battery Life", "Speed", "Camera", "Display", "Software/UI"],
                k=random.randint(1, 2),
            )
            for aspect in aspects_to_add:
                score = round(random.uniform(-0.3, 0.9), 4)
                if score > 0.1:
                    sentiment = "positive"
                elif score < -0.1:
                    sentiment = "negative"
                else:
                    sentiment = "neutral"
                insight_records.append(
                    {
                        "id": str(uuid.uuid4()),
                        "review_id": review_id,
                        "aspect": aspect,
                        "sentiment": sentiment,
                        "score": score,
                        "confidence": round(random.uniform(0.3, 0.9), 4),
                        "is_sarcastic": False,
                        "flagged_for_review": False,
                    }
                )

    # Insert reviews
    print(f"Inserting {len(review_records)} reviews...")
    await conn.executemany(
        """
        INSERT INTO reviews
            (id, product_id, product_name, raw_text, cleaned_text, language_detected,
             is_bot, is_duplicate, overall_sentiment, overall_score, created_at, source)
        VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (id) DO NOTHING
        """,
        [
            (
                r["id"],
                r["product_id"],
                r["product_name"],
                r["raw_text"],
                r["cleaned_text"],
                r["language_detected"],
                r["is_bot"],
                r["is_duplicate"],
                r["overall_sentiment"],
                r["overall_score"],
                r["created_at"],
                r["source"],
            )
            for r in review_records
        ],
    )

    print(f"Inserting {len(insight_records)} aspect insights...")
    await conn.executemany(
        """
        INSERT INTO aspect_insights
            (id, review_id, aspect, sentiment, score, confidence, is_sarcastic, flagged_for_review)
        VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (id) DO NOTHING
        """,
        [
            (
                ins["id"],
                ins["review_id"],
                ins["aspect"],
                ins["sentiment"],
                ins["score"],
                ins["confidence"],
                ins["is_sarcastic"],
                ins["flagged_for_review"],
            )
            for ins in insight_records
        ],
    )

    # Print summary statistics
    total = await conn.fetchval("SELECT COUNT(*) FROM reviews")
    total_insights = await conn.fetchval("SELECT COUNT(*) FROM aspect_insights")
    packaging_recent = await conn.fetchval(
        """
        SELECT COUNT(*) FROM aspect_insights
        WHERE aspect = 'Packaging'
          AND review_id IN (
            SELECT id FROM reviews
            WHERE product_id = 'iphone-15-pro'
              AND created_at > NOW() - INTERVAL '7 days'
          )
        """
    )
    total_recent_iphone = await conn.fetchval(
        """
        SELECT COUNT(*) FROM reviews
        WHERE product_id = 'iphone-15-pro'
          AND created_at > NOW() - INTERVAL '7 days'
        """
    )

    print("\n=== Seed Summary ===")
    print(f"Total reviews inserted:         {total}")
    print(f"Total aspect insights inserted: {total_insights}")
    print(
        f"iPhone 15 Pro recent packaging: {packaging_recent}/{total_recent_iphone} "
        f"({int(packaging_recent/max(total_recent_iphone,1)*100)}%)"
    )
    print("Seeding complete!")


async def main() -> None:
    conn = await asyncpg.connect(DB_URL)
    try:
        await seed(conn)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
