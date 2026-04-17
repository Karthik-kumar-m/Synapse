# CSV & JSON Upload Structures

## CSV Upload Formats

### ✅ Minimal CSV (Required columns only)
```csv
product_id,product_name,text
earbuds-pro,Wireless Earbuds Pro,"Great sound quality, perfect for gym."
earbuds-pro,Wireless Earbuds Pro,"Battery life is disappointing."
earbuds-lite,Earbuds Lite,"Works fine for the price."
```

**Rules:**
- Always quote fields that contain commas, quotes, or newlines
- Use `""` (double quote) to escape quotes inside quoted text
- No spaces after commas in header

---

### ✅ With Dates
```csv
product_id,product_name,date,text
earbuds-pro,Wireless Earbuds Pro,2026-08-20,"Excellent build quality, best purchase ever."
earbuds-pro,Wireless Earbuds Pro,2026-08-21,"Bad connection, keeps disconnecting."
earbuds-lite,Earbuds Lite,2026-08-20,"Average product, nothing special."
```

---

### ✅ Full Featured (All optional fields)
```csv
product_id,product_name,review_id,date,rating,text,firmware_version,component_focus,is_sarcastic
earbuds-pro,Wireless Earbuds Pro,REV001,2026-08-20,5,"Excellent product, best purchase ever!",v1.5,build_quality,False
earbuds-pro,Wireless Earbuds Pro,REV002,2026-08-20,1,"Bricked after update, DO NOT INSTALL v1.4",v1.4,firmware,False
earbuds-pro,Wireless Earbuds Pro,REV003,2026-08-21,2,"Amazing quality, lasts forever, yeah right.",v1.5,battery,True
earbuds-lite,Earbuds Lite,REV004,2026-08-20,4,"Good value for money, works as described.",v1.2,microphone,False
```

---

### 🔴 Common CSV Mistakes to Avoid

❌ **DON'T:** Unquoted commas in text
```csv
product_id,product_name,text
earbuds-pro,Wireless Earbuds Pro,Great sound, perfect for gym.
```
✅ **DO:** Quote text with commas
```csv
product_id,product_name,text
earbuds-pro,Wireless Earbuds Pro,"Great sound, perfect for gym."
```

---

❌ **DON'T:** Unescaped quotes
```csv
product_id,product_name,text
earbuds-pro,Wireless Earbuds Pro,Love the "premium" feel.
```
✅ **DO:** Double quotes to escape
```csv
product_id,product_name,text
earbuds-pro,Wireless Earbuds Pro,"Love the ""premium"" feel."
```

---

❌ **DON'T:** Multiline text without quoting
```csv
product_id,product_name,text
earbuds-pro,Wireless Earbuds Pro,Great product
Works well
Recommended
```
✅ **DO:** Quote multiline text
```csv
product_id,product_name,text
earbuds-pro,Wireless Earbuds Pro,"Great product
Works well
Recommended"
```

---

## JSON Upload Format

### ✅ Minimal JSON
```json
[
  {
    "product_id": "earbuds-pro",
    "product_name": "Wireless Earbuds Pro",
    "text": "Great sound quality, perfect for gym."
  },
  {
    "product_id": "earbuds-pro",
    "product_name": "Wireless Earbuds Pro",
    "text": "Battery life is disappointing."
  },
  {
    "product_id": "earbuds-lite",
    "product_name": "Earbuds Lite",
    "text": "Works fine for the price."
  }
]
```

---

### ✅ With Dates
```json
[
  {
    "product_id": "earbuds-pro",
    "product_name": "Wireless Earbuds Pro",
    "text": "Excellent build quality, best purchase ever.",
    "date": "2026-08-20"
  },
  {
    "product_id": "earbuds-pro",
    "product_name": "Wireless Earbuds Pro",
    "text": "Bad connection, keeps disconnecting.",
    "date": "2026-08-21"
  },
  {
    "product_id": "earbuds-lite",
    "product_name": "Earbuds Lite",
    "text": "Average product, nothing special.",
    "date": "2026-08-20"
  }
]
```

---

### ✅ Full Featured (All optional fields)
```json
[
  {
    "product_id": "earbuds-pro",
    "product_name": "Wireless Earbuds Pro",
    "review_id": "REV001",
    "date": "2026-08-20",
    "rating": 5.0,
    "text": "Excellent product, best purchase ever!",
    "firmware_version": "v1.5",
    "component_focus": "build_quality",
    "is_sarcastic": false
  },
  {
    "product_id": "earbuds-pro",
    "product_name": "Wireless Earbuds Pro",
    "review_id": "REV002",
    "date": "2026-08-20",
    "rating": 1.0,
    "text": "Bricked after update, DO NOT INSTALL v1.4",
    "firmware_version": "v1.4",
    "component_focus": "firmware",
    "is_sarcastic": false
  },
  {
    "product_id": "earbuds-pro",
    "product_name": "Wireless Earbuds Pro",
    "review_id": "REV003",
    "date": "2026-08-21",
    "rating": 2.0,
    "text": "Amazing quality, lasts forever, yeah right.",
    "firmware_version": "v1.5",
    "component_focus": "battery",
    "is_sarcastic": true
  },
  {
    "product_id": "earbuds-lite",
    "product_name": "Earbuds Lite",
    "review_id": "REV004",
    "date": "2026-08-20",
    "rating": 4.0,
    "text": "Good value for money, works as described.",
    "firmware_version": "v1.2",
    "component_focus": "microphone",
    "is_sarcastic": false
  }
]
```

---

## Upload Instructions

### CSV Upload (via UI or API)

**UI:** Navigate to Dashboard → Ingest → CSV Upload tab → Select file → Click "Upload CSV"

**API:**
```bash
curl -X POST "http://localhost:8000/api/ingest/csv" \
  -F "file=@reviews.csv"
```

**Response:**
```json
{
  "total_processed": 8,
  "duplicates_quarantined": 0,
  "bots_quarantined": 0,
  "insights_generated": 12
}
```

---

### JSON Upload (API only)

**Important:** JSON is uploaded as raw JSON body, NOT form-data

**API:**
```bash
curl -X POST "http://localhost:8000/api/ingest/json" \
  -H "Content-Type: application/json" \
  -d @reviews.json
```

**Response:**
```json
{
  "total_processed": 8,
  "duplicates_quarantined": 0,
  "bots_quarantined": 0,
  "insights_generated": 12
}
```

---

## Field Reference

| Field | Required? | Type | Example |
|-------|-----------|------|---------|
| `product_id` | ✅ Yes | String | `earbuds-pro`, `phone-15` |
| `product_name` | ✅ Yes | String | `Wireless Earbuds Pro` |
| `text` | ✅ Yes | String | `Great product!` |
| `date` | ❌ No | String (YYYY-MM-DD) | `2026-08-20` |
| `review_id` | ❌ No | String | `REV001`, `R-12345` |
| `rating` | ❌ No | Float | `4.5`, `5.0` |
| `firmware_version` | ❌ No | String | `v1.5`, `1.2.3` |
| `component_focus` | ❌ No | String | `battery`, `camera` |
| `is_sarcastic` | ❌ No | Boolean | `true`, `false` |

---

## Tips for Success

1. **Always quote text fields** containing special characters
2. **Use YYYY-MM-DD** for dates (e.g., `2026-08-20`)
3. **No trailing commas** in CSV headers or JSON arrays
4. **Consistent fields** — ensure all rows have the same required columns
5. **Validate before uploading** — use a CSV/JSON validator tool
6. **Keep text reasonable** — avoid extremely long reviews (>5000 chars)
