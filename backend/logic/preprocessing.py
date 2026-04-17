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
    # Common regional terms and transliterated spellings
    "duddu": "money",
    "beku": "need",
    "illa": "no",
    "chennagide": "good",
    "mosam": "bad",
    "nalla": "good",
    "romba": "very",
    "seri": "okay",
    "venam": "no need",
    "bhalo": "good",
    "kharap": "bad",
    "valo": "good",
    "baje": "bad",
}

INDIC_SCRIPT_MAP: Dict[str, Dict[str, str]] = {
    "hi": {
        "अच्छा": "good",
        "बढ़िया": "good",
        "शानदार": "excellent",
        "खराब": "bad",
        "बेकार": "useless",
        "धीमा": "slow",
        "तेज़": "fast",
        "महंगा": "expensive",
        "सस्ता": "cheap",
        "सेवा": "service",
    },
    "ta": {
        "நல்ல": "good",
        "சிறப்பு": "excellent",
        "கெட்ட": "bad",
        "மோசம்": "bad",
        "வேகம்": "speed",
        "மெதுவாக": "slow",
        "விலை": "price",
        "சேவை": "service",
    },
    "kn": {
        "ಒಳ್ಳೆಯ": "good",
        "ಚೆನ್ನಾಗಿದೆ": "good",
        "ಕೆಟ್ಟ": "bad",
        "ವೇಗ": "speed",
        "ನಿಧಾನ": "slow",
        "ಸೇವೆ": "service",
        "ಬೆಲೆ": "price",
    },
}

INDIC_SENTIMENT_LEXICON: Dict[str, Dict[str, set[str]]] = {
    "hi": {
        "positive": {"अच्छा", "बढ़िया", "शानदार", "मस्त", "सही"},
        "negative": {"खराब", "बेकार", "बुरा", "धीमा", "महंगा"},
    },
    "ta": {
        "positive": {"நல்ல", "சிறப்பு", "அருமை", "சூப்பர்"},
        "negative": {"கெட்ட", "மோசம்", "பிரச்சனை", "மெதுவாக"},
    },
    "kn": {
        "positive": {"ಒಳ್ಳೆಯ", "ಚೆನ್ನಾಗಿದೆ", "ಉತ್ತಮ"},
        "negative": {"ಕೆಟ್ಟ", "ಸಮಸ್ಯೆ", "ನಿಧಾನ"},
    },
}


TYPO_MAP: Dict[str, str] = {
    "btry": "battery",
    "battry": "battery",
    "chargng": "charging",
    "pakaging": "packaging",
    "delivr": "delivery",
    "suport": "support",
    "custmer": "customer",
    "qualty": "quality",
}


def normalize_hinglish(text: str) -> str:
    """Tokenize by whitespace, map tokens via HINGLISH_MAP (case-insensitive)."""
    tokens = text.split()
    normalized = []
    for token in tokens:
        lower = token.lower()
        lower = TYPO_MAP.get(lower, lower)
        # Reduce over-elongated tokens (e.g., gooood -> good)
        lower = re.sub(r"(.)\\1{2,}", r"\\1\\1", lower)
        normalized.append(HINGLISH_MAP.get(lower, lower))
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
_SPECIAL_CHARS_PATTERN = re.compile(r"[^\w\s.,!?\'\"-]", re.UNICODE)
_WHITESPACE_PATTERN = re.compile(r"\s+")


def detect_script_language(text: str) -> str | None:
    for char in text:
        code = ord(char)
        if 0x0900 <= code <= 0x097F:
            return "hi"
        if 0x0B80 <= code <= 0x0BFF:
            return "ta"
        if 0x0C80 <= code <= 0x0CFF:
            return "kn"
    return None


def normalize_indic_script(text: str) -> str:
    normalized = text
    for language_map in INDIC_SCRIPT_MAP.values():
        for original, replacement in language_map.items():
            normalized = normalized.replace(original, replacement)
    return normalized


def _compute_indic_sentiment(text: str, language_detected: str | None) -> float:
    if not language_detected:
        return 0.0
    lexicon = INDIC_SENTIMENT_LEXICON.get(language_detected)
    if not lexicon:
        return 0.0

    tokens = re.findall(r"\w+", text.lower(), flags=re.UNICODE)
    if not tokens:
        return 0.0

    positive = sum(1 for token in tokens if token in lexicon["positive"])
    negative = sum(1 for token in tokens if token in lexicon["negative"])
    if positive == 0 and negative == 0:
        return 0.0

    raw = (positive - negative) / max(positive + negative, 1)
    return max(-1.0, min(1.0, raw))


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
    script_language = detect_script_language(raw_text)
    hinglish_normalized = normalize_hinglish(raw_text)
    script_normalized = normalize_indic_script(hinglish_normalized)
    cleaned = clean_text(script_normalized)

    try:
        language_detected = detect(cleaned) if len(cleaned.split()) >= 3 else (script_language or "en")
    except LangDetectException:
        language_detected = script_language or "en"

    if script_language in {"hi", "ta", "kn"}:
        language_detected = script_language

    blob = TextBlob(cleaned)
    textblob_polarity: float = blob.sentiment.polarity
    textblob_subjectivity: float = blob.sentiment.subjectivity
    indic_sentiment = _compute_indic_sentiment(raw_text, language_detected)

    if indic_sentiment != 0.0:
        final_score = round(0.55 * textblob_polarity + 0.25 * emoji_sentiment + 0.2 * indic_sentiment, 4)
    else:
        final_score = round(0.7 * textblob_polarity + 0.3 * emoji_sentiment, 4)

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


def is_spam_review(text: str) -> tuple[bool, str | None]:
    """Heuristic spam detection separate from bot detection."""
    lower = text.lower()
    spam_patterns = [
        r"buy\\s+now",
        r"limited\\s+offer",
        r"promo\\s*code",
        r"click\\s+here",
        r"visit\\s+our",
        r"whatsapp\\s+\\+?\\d",
        r"https?://",
    ]
    for pattern in spam_patterns:
        if re.search(pattern, lower):
            return True, "promotional_or_link_pattern"
    if sum(ch.isdigit() for ch in lower) > max(8, len(lower) // 3):
        return True, "excessive_numeric_content"
    return False, None


