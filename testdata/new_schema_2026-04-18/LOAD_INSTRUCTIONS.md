# New Schema Data Load Instructions

## 1) CSV Upload

PowerShell:

curl.exe -s -S -i -X POST http://localhost:8000/api/ingest/csv -F "file=@E:/Synapse/testdata/new_schema_2026-04-18/csv_reviews_new_schema.csv"

## 2) JSON Batch Upload

PowerShell:

curl.exe -s -S -i -X POST http://localhost:8000/api/ingest/json -H "Content-Type: application/json" --data-binary "@E:/Synapse/testdata/new_schema_2026-04-18/json_batch_payload_new_schema.json"

## 3) Realtime Feed Upload

PowerShell:

curl.exe -s -S -i -X POST http://localhost:8000/api/ingest/realtime-feed -H "Content-Type: application/json" --data-binary "@E:/Synapse/testdata/new_schema_2026-04-18/realtime_feed_payloads_new_schema.json"

## 4) Manual Upload Examples

Use entries from:

E:/Synapse/testdata/new_schema_2026-04-18/manual_payloads_new_schema.json

Example single request:

curl.exe -s -S -i -X POST http://localhost:8000/api/ingest/manual -H "Content-Type: application/json" -d "{\"product_id\":\"P7001\",\"product_name\":\"Manual Test Device\",\"raw_text\":\"bahut accha display and camera, paisa vasool\",\"category\":\"Consumer Electronics\",\"source\":\"manual\"}"

## Notes

- This pack targets current schema behavior: English + Hinglish + emoji + sarcasm + spam/bot/duplicate edge cases.
- Category values used: Consumer Electronics, Home Appliances, Software Services, Uncategorized.
