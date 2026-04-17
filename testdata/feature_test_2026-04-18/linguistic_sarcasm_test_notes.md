# Linguistic + Sarcasm Test Notes

## Files
- linguistic_sarcasm_eval.csv: bulk ingestion file with 30 labeled samples.
- linguistic_sarcasm_manual_payloads.json: manual endpoint payloads with expected outputs.

## Coverage
- Languages: English, Hinglish transliterated, Hindi script, Tamil script, Kannada script.
- Sarcasm: explicit regex-trigger examples matching backend sarcasm patterns.
- Sentiment: positive, negative, neutral, and emoji-influenced statements.

## Suggested Run Order
1. Ingest `linguistic_sarcasm_eval.csv` through CSV upload.
2. Submit each object in `linguistic_sarcasm_manual_payloads.json` through manual endpoint.
3. Validate in reviews list:
   - `language_detected`
   - `overall_sentiment`
   - aspect-level `is_sarcastic`

## Success Criteria
- Script-language rows should map to `hi`, `ta`, `kn`.
- Sarcasm rows should set `is_sarcastic` true on generated aspects.
- Non-sarcastic rows should keep `is_sarcastic` false.
- Positive/negative/neutral should broadly align with expected labels.
