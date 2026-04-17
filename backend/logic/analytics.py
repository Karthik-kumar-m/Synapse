"""Layer 2 – Aspect-Based Sentiment Analysis (ABSA)."""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

from textblob import TextBlob

from config import settings
from logic.ollama_client import generate_json
from schemas.review import LLMExtractionResponse

# ---------------------------------------------------------------------------
# Aspect keyword taxonomy
# ---------------------------------------------------------------------------
ASPECT_KEYWORDS: Dict[str, List[str]] = {
    "Battery Life": [
        "battery", "charge", "charging", "power", "drain", "mah", "backup",
        "standby", "overnight", "unplugged",
    ],
    "Speed": [
        "speed", "fast", "slow", "lag", "performance", "quick", "sluggish",
        "responsive", "freeze", "hang", "stutter", "smooth", "rapid",
    ],
    "Packaging": [
        "packaging", "package", "box", "wrapper", "wrap", "damaged", "broken",
        "dented", "crushed", "delivery box", "open box", "tampered", "seal",
    ],
    "Camera": [
        "camera", "photo", "picture", "image", "video", "megapixel", "lens",
        "shot", "blur", "zoom", "selfie", "night mode", "portrait",
    ],
    "Display": [
        "display", "screen", "brightness", "resolution", "touch", "amoled",
        "lcd", "oled", "refresh", "hdr", "sunlight", "pixel",
    ],
    "Build Quality": [
        "build", "quality", "material", "plastic", "glass", "premium", "cheap",
        "flimsy", "solid", "sturdy", "durable", "finish", "feel", "weight",
    ],
    "Price/Value": [
        "price", "value", "worth", "expensive", "cheap", "money", "cost",
        "budget", "affordable", "overpriced", "deal", "discount",
    ],
    "Customer Support": [
        "support", "service", "customer", "response", "refund", "return",
        "helpdesk", "agent", "complaint", "warranty", "replacement", "escalate",
    ],
    "Delivery": [
        "delivery", "shipping", "arrived", "courier", "logistics", "delayed",
        "late", "early", "dispatch", "tracking", "package received", "on time",
    ],
    "Software/UI": [
        "software", "ui", "app", "interface", "update", "bug", "crash", "os",
        "android", "ios", "bloatware", "notification", "settings", "feature",
    ],
}

# ---------------------------------------------------------------------------
# Sarcasm detection patterns
# ---------------------------------------------------------------------------
SARCASM_PATTERNS: List[str] = [
    r"yeah\s+right",
    r"oh\s+sure",
    r"totally\s+(not|works|great|fine)",
    r"great\s+job.*broken",
    r"love\s+how.*doesn'?t",
    r"thanks\s+for\s+nothing",
    r"wow.*terrible",
    r"oh\s+wow.*awful",
    r"absolutely\s+(love|great).*worst",
    r"so\s+glad.*broken",
    r"what\s+a\s+(great|wonderful|amazing).*not",
    r"really\s+impressed.*joke",
]

_NEGATIVE_KEYWORDS = {
    "bad", "terrible", "awful", "horrible", "broken", "damaged", "useless",
    "worst", "hate", "disappointed", "poor", "pathetic", "disgrace", "trash",
    "garbage", "defective", "waste", "refund", "return", "complaint",
}


def detect_sarcasm(text: str) -> Tuple[bool, float]:
    """
    Detect sarcasm via regex patterns + polarity/keyword mismatch.

    Returns:
        (is_sarcastic: bool, confidence: float)
    """
    lower_text = text.lower()

    pattern_matches = sum(
        1 for pattern in SARCASM_PATTERNS if re.search(pattern, lower_text)
    )

    blob = TextBlob(lower_text)
    polarity = blob.sentiment.polarity

    negative_keyword_count = sum(
        1 for kw in _NEGATIVE_KEYWORDS if kw in lower_text
    )

    mismatch_score = 0.0
    if polarity > 0.3 and negative_keyword_count >= 2:
        mismatch_score = min(1.0, negative_keyword_count * 0.2)

    confidence = min(1.0, pattern_matches * 0.5 + mismatch_score)
    is_sarcastic = confidence >= 0.4

    return is_sarcastic, round(confidence, 4)


# ---------------------------------------------------------------------------
# Per-aspect sentiment analysis
# ---------------------------------------------------------------------------

def analyze_aspect_sentiment(
    text: str, aspect: str, keywords: List[str]
) -> Optional[dict]:
    """
    Extract sentiment for a single aspect from the review text.

    Returns None if no keywords found.
    """
    lower_text = text.lower()
    matched_keywords: List[str] = []
    windows: List[str] = []

    for keyword in keywords:
        if keyword in lower_text:
            matched_keywords.append(keyword)
            start_idx = lower_text.find(keyword)
            while start_idx != -1:
                window_start = max(0, start_idx - 30)
                window_end = min(len(lower_text), start_idx + len(keyword) + 30)
                windows.append(lower_text[window_start:window_end])
                start_idx = lower_text.find(keyword, start_idx + 1)

    if not matched_keywords:
        return None

    combined_window = " ".join(windows)
    blob = TextBlob(combined_window)
    polarity: float = blob.sentiment.polarity

    keyword_match_count = len(matched_keywords)
    confidence = min(1.0, keyword_match_count * 0.4 + abs(polarity) * 0.6)

    if polarity > 0.1:
        sentiment = "positive"
    elif polarity < -0.1:
        sentiment = "negative"
    else:
        sentiment = "neutral"

    return {
        "aspect": aspect,
        "sentiment": sentiment,
        "score": round(polarity, 4),
        "confidence": round(confidence, 4),
        "matched_keywords": matched_keywords,
    }


# ---------------------------------------------------------------------------
# Full ABSA pipeline
# ---------------------------------------------------------------------------

def run_absa(cleaned_text: str, original_text: str) -> dict:
    """
    Run complete Aspect-Based Sentiment Analysis on a review.

    Returns:
        {
            "aspects": list[dict],
            "is_sarcastic": bool,
            "sarcasm_confidence": float,
            "flagged_for_human_review": bool,
            "aspects_found": int,
        }
    """
    is_sarcastic, sarcasm_confidence = detect_sarcasm(original_text)

    blob = TextBlob(cleaned_text)
    overall_polarity = blob.sentiment.polarity

    aspects: List[dict] = []
    for aspect, keywords in ASPECT_KEYWORDS.items():
        result = analyze_aspect_sentiment(cleaned_text, aspect, keywords)
        if result is None:
            continue
        if result["confidence"] < 0.2:
            continue
        aspects.append(result)

    flagged_for_human_review = is_sarcastic and overall_polarity > 0.3

    return {
        "aspects": aspects,
        "is_sarcastic": is_sarcastic,
        "sarcasm_confidence": sarcasm_confidence,
        "flagged_for_human_review": flagged_for_human_review,
        "aspects_found": len(aspects),
    }


_SENTIMENT_TO_SCORE = {
    "positive": 0.7,
    "negative": -0.7,
    "neutral": 0.0,
    "ambiguous": 0.0,
}

_SENTIMENT_TO_CONFIDENCE = {
    "positive": 0.8,
    "negative": 0.8,
    "neutral": 0.7,
    "ambiguous": 0.5,
}


def _format_batch_prompt(reviews_list: List[str]) -> str:
    lines = []
    for idx, text in enumerate(reviews_list):
        lines.append(f"[{idx}] {text}")
    rendered = "\n".join(lines)

    return (
        "You are extracting compact sentiment insights from customer reviews.\n"
        "Input reviews are indexed. For each review, return zero or more feature-level insights.\n"
        "Allowed sentiment values: Positive, Negative, Neutral, Ambiguous.\n"
        "Return strictly valid JSON only with this exact schema:\n"
        "{\"reviews\":[{\"review_index\":0,\"insights\":[{\"feature\":\"battery\",\"sentiment\":\"Negative\"}]}]}\n"
        "Do not add markdown, comments, or extra keys.\n"
        "Reviews:\n"
        f"{rendered}"
    )


def _normalize_llm_item(feature: str, sentiment: str) -> dict:
    sentiment_l = sentiment.strip().lower()
    if sentiment_l not in _SENTIMENT_TO_SCORE:
        sentiment_l = "ambiguous"

    return {
        "aspect": feature.strip() or "General",
        "sentiment": sentiment_l,
        "score": _SENTIMENT_TO_SCORE[sentiment_l],
        "confidence": _SENTIMENT_TO_CONFIDENCE[sentiment_l],
        "matched_keywords": [],
    }


async def run_absa_batch_ollama(
    cleaned_reviews: List[str],
    original_reviews: List[str],
) -> List[dict]:
    """Run extraction for a small batch of reviews via Ollama with strict JSON parsing."""
    if len(cleaned_reviews) != len(original_reviews):
        raise ValueError("cleaned_reviews and original_reviews must have the same length")

    if not cleaned_reviews:
        return []

    if not settings.OLLAMA_ENABLE_EXTRACTION:
        return [run_absa(cleaned, original) for cleaned, original in zip(cleaned_reviews, original_reviews)]

    prompt = _format_batch_prompt(original_reviews)
    deterministic_results = [
        run_absa(cleaned, original)
        for cleaned, original in zip(cleaned_reviews, original_reviews)
    ]

    try:
        parsed = await generate_json(prompt)
        strict = LLMExtractionResponse.model_validate(parsed)

        mapped: Dict[int, List[dict]] = {idx: [] for idx in range(len(cleaned_reviews))}
        for review_block in strict.reviews:
            if review_block.review_index < 0 or review_block.review_index >= len(cleaned_reviews):
                continue
            for insight in review_block.insights:
                mapped[review_block.review_index].append(
                    _normalize_llm_item(insight.feature, insight.sentiment)
                )

        results: List[dict] = []
        for idx in range(len(cleaned_reviews)):
            llm_aspects = mapped[idx]
            deterministic = deterministic_results[idx]

            # If the model returns nothing, keep deterministic ABSA output.
            aspects = llm_aspects if llm_aspects else deterministic["aspects"]
            has_ambiguous = any(a["sentiment"] == "ambiguous" for a in llm_aspects)

            flagged_for_human_review = (
                deterministic["flagged_for_human_review"]
                or has_ambiguous
            )

            results.append(
                {
                    "aspects": aspects,
                    "is_sarcastic": deterministic["is_sarcastic"],
                    "sarcasm_confidence": deterministic["sarcasm_confidence"],
                    "flagged_for_human_review": flagged_for_human_review,
                    "aspects_found": len(aspects),
                }
            )
        return results
    except Exception:
        # Fall back to deterministic local ABSA if Ollama fails.
        return [run_absa(cleaned, original) for cleaned, original in zip(cleaned_reviews, original_reviews)]
