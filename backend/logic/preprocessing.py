"""Layer 1 – Noise Normalization pipeline."""

from __future__ import annotations

import hashlib
import re
from typing import Dict


import emoji
from langdetect import detect, LangDetectException
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from textblob import TextBlob

# ---------------------------------------------------------------------------
# Hinglish → English translation map (~50 common terms)
# ---------------------------------------------------------------------------
HINGLISH_MAP: Dict[str, str] = {
    "accha": "good",
    "achha": "good",
    "acha": "good",
    "bura": "bad",
    "bahut": "very",
    "bohot": "very",
    "theek": "okay",
    "thik": "okay",
    "nahi": "no",
    "nhi": "no",
    "haan": "yes",
    "han": "yes",
    "kharab": "terrible",
    "mast": "great",
    "ekdum": "absolutely",
    "zyada": "more",
    "jyada": "more",
    "kam": "less",
    "jaldi": "fast",
    "dhire": "slow",
    "saman": "goods",
    "paisa": "money",
    "paise": "money",
    "bakwaas": "nonsense",
    "zabardast": "amazing",
    "bekar": "useless",
    "fatafat": "very fast",
    "bilkul": "absolutely",
    "seedha": "directly",
    "ganda": "dirty",
    "sahi": "correct",
    "galat": "wrong",
    "sundar": "beautiful",
    "khraab": "bad",
    "toot": "broken",
    "toota": "broken",
    "chalu": "working",
    "bandh": "closed",
    "asaan": "easy",
    "mushkil": "difficult",
    "pyara": "lovely",
    "lajawab": "superb",
    "wadhiya": "wonderful",
    "shandar": "splendid",
    "bekaar": "useless",
    "alag": "different",
    "purana": "old",
    "naya": "new",
    "sasta": "cheap",
    "mehnga": "expensive",
    "package": "package",
}


def normalize_hinglish(text: str) -> str:
    """Tokenize by whitespace, map tokens via HINGLISH_MAP (case-insensitive)."""
    tokens = text.split()
    normalized = [HINGLISH_MAP.get(token.lower(), token) for token in tokens]
    return " ".join(normalized)


# ---------------------------------------------------------------------------
# Emoji sentiment extraction
# ---------------------------------------------------------------------------
_POSITIVE_EMOJIS = {"😊", "👍", "🔥", "💯", "✨", "🎉", "😍", "🙌", "💪", "😁"}
_NEGATIVE_EMOJIS = {"😞", "👎", "💔", "😠", "😤", "😢", "🤬", "😡", "💀", "🤦"}


def extract_emoji_sentiment(text: str) -> float:
    """Return average emoji sentiment clamped to [-1.0, 1.0]."""
    scores: list[float] = []
    for char in text:
        if emoji.is_emoji(char):
            if char in _POSITIVE_EMOJIS:
                scores.append(0.3)
            elif char in _NEGATIVE_EMOJIS:
                scores.append(-0.3)
            else:
                scores.append(0.0)
    if not scores:
        return 0.0
    avg = sum(scores) / len(scores)
    return max(-1.0, min(1.0, avg))


# ---------------------------------------------------------------------------
# Text cleaning
# ---------------------------------------------------------------------------
_URL_PATTERN = re.compile(r"https?://\S+|www\.\S+")
_SPECIAL_CHARS_PATTERN = re.compile(r"[^a-z0-9\s.,!?'\"-]")
_WHITESPACE_PATTERN = re.compile(r"\s+")


def clean_text(text: str) -> str:
    """Lowercase, remove URLs, remove special chars (keep punctuation), normalize whitespace."""
    text = text.lower()
    text = _URL_PATTERN.sub(" ", text)
    # Remove emojis before special char stripping
    text = emoji.replace_emoji(text, replace=" ")
    text = _SPECIAL_CHARS_PATTERN.sub(" ", text)
    text = _WHITESPACE_PATTERN.sub(" ", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Full normalization pipeline
# ---------------------------------------------------------------------------

def normalize_review(raw_text: str) -> dict:
    """
    Full Layer-1 pipeline.

    Returns a dict with:
        cleaned_text, language_detected, emoji_sentiment, textblob_polarity,
        textblob_subjectivity, final_sentiment_score, overall_sentiment
    """
    emoji_sentiment = extract_emoji_sentiment(raw_text)
    hinglish_normalized = normalize_hinglish(raw_text)
    cleaned = clean_text(hinglish_normalized)

    try:
        language_detected = detect(cleaned) if len(cleaned.split()) >= 3 else "en"
    except LangDetectException:
        language_detected = "en"

    blob = TextBlob(cleaned)
    textblob_polarity: float = blob.sentiment.polarity
    textblob_subjectivity: float = blob.sentiment.subjectivity

    final_score: float = round(0.7 * textblob_polarity + 0.3 * emoji_sentiment, 4)

    if final_score > 0.1:
        overall_sentiment = "positive"
    elif final_score < -0.1:
        overall_sentiment = "negative"
    else:
        overall_sentiment = "neutral"

    return {
        "cleaned_text": cleaned,
        "language_detected": language_detected,
        "emoji_sentiment": emoji_sentiment,
        "textblob_polarity": textblob_polarity,
        "textblob_subjectivity": textblob_subjectivity,
        "final_sentiment_score": final_score,
        "overall_sentiment": overall_sentiment,
    }


# ---------------------------------------------------------------------------
# Deduplication helpers
# ---------------------------------------------------------------------------

def compute_text_hash(text: str) -> str:
    """SHA-256 hash of cleaned, lowercased text for exact deduplication."""
    normalized = text.strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def compute_similarity(text1: str, text2: str) -> float:
    """TF-IDF + cosine similarity between two texts. Returns score in [0, 1]."""
    if not text1 or not text2:
        return 0.0
    try:
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform([text1, text2])
        score = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        return float(score)
    except ValueError:
        return 0.0


# ---------------------------------------------------------------------------
# Bot detection
# ---------------------------------------------------------------------------
_REPETITIVE_PATTERN = re.compile(r"(\b\w+\b)(?:\s+\1){2,}")


def is_bot_review(text: str) -> bool:
    """Heuristic bot detection."""
    words = text.split()
    if len(words) < 5:
        return True
    if text == text.upper() and len(text) > 5:
        return True
    if _REPETITIVE_PATTERN.search(text.lower()):
        return True
    return False


# ---------------------------------------------------------------------------
# Deduplication engine
# ---------------------------------------------------------------------------
_SIMILARITY_THRESHOLD = 0.92


class DeduplicationEngine:
    """Stateful engine that tracks seen reviews for exact and near-duplicate detection."""

    def __init__(self) -> None:
        self._seen_hashes: set[str] = set()
        self._seen_texts: list[str] = []

    def check_and_add(self, cleaned_text: str) -> dict:
        """
        Returns:
            {
                "is_duplicate": bool,
                "similarity_score": float,
                "reason": str,
            }
        """
        text_hash = compute_text_hash(cleaned_text)

        if text_hash in self._seen_hashes:
            return {
                "is_duplicate": True,
                "similarity_score": 1.0,
                "reason": "exact_hash_match",
            }

        best_similarity = 0.0
        for seen in self._seen_texts:
            sim = compute_similarity(cleaned_text, seen)
            if sim > best_similarity:
                best_similarity = sim
            if best_similarity >= _SIMILARITY_THRESHOLD:
                break

        if best_similarity >= _SIMILARITY_THRESHOLD:
            return {
                "is_duplicate": True,
                "similarity_score": round(best_similarity, 4),
                "reason": "cosine_similarity_above_threshold",
            }

        self._seen_hashes.add(text_hash)
        self._seen_texts.append(cleaned_text)
        return {
            "is_duplicate": False,
            "similarity_score": round(best_similarity, 4),
            "reason": "unique",
        }
