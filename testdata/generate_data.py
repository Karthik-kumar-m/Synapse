import csv
import json
import random
from datetime import datetime, timedelta

# Configuration
products = [
    {"id": "FP1001", "name": "Personal Care", "cat": "Personal Care"},
    {"id": "FP1002", "name": "Home Care", "cat": "Home Care"},
    {"id": "FP1003", "name": "Food & Beverage", "cat": "Food & Beverage"},
    {"id": "FP1004", "name": "Software Services", "cat": "Software Services"}
]

aspect_keywords = {
    "battery": ["battery life", "charging", "backup"],
    "speed": ["fast", "slow", "performance", "lag"],
    "packaging": ["box", "delivery", "shipping", "packed"],
    "camera": ["photo", "video", "lens", "clear"],
    "display": ["screen", "colors", "brightness"],
    "price": ["expensive", "cheap", "worth", "money"],
    "support": ["customer service", "helpdesk", "refund"],
    "delivery": ["late", "ontime", "courier"],
    "software": ["update", "bugs", "app", "interface"]
}

sentiments = ["positive", "negative", "neutral"]
hinglish = ["bohot badiya product hai", "waste of money hai", "quality achi nahi hai", "superb packing", "theek thaak hai"]
emojis = ["😊", "🔥", "👍", "😞", "😡", "👎", "🤮"]
sarcasm = ["yeah right, very durable", "thanks for nothing", "what a great camera... not", "totally great screen, broken in 2 days"]
spam = ["buy now limited offer", "click here http://spam.ex", "use promo code SAVE20", "contact me for discount"]
bot = ["BAD", "GOOD", "AWFUL", "REALLY BAD REALLY BAD", "OK OK OK"]

reviews_data = []
start_date = datetime(2026, 3, 1)

for p in products:
    p_reviews = []
    for i in range(200):
        review_id = f"R-{p['id']}-{i:03d}"
        created_at = (start_date + timedelta(days=i * 45 / 200, hours=random.randint(0,23))).strftime("%Y-%m-%d %H:%M:%S")
        rating = random.randint(1, 5)
        firmware = f"v{random.randint(1, 3)}.{random.randint(0, 9)}"
        component = random.choice(list(aspect_keywords.keys()))
        
        # Diversity logic
        if i % 10 == 0:
            text = random.choice(hinglish)
        elif i % 15 == 0:
            text = random.choice(sarcasm)
        elif i % 20 == 0:
            text = random.choice(spam)
        elif i % 25 == 0:
            text = random.choice(bot)
        elif i % 12 == 0:
            text = f"{random.choice(aspect_keywords[component])} is {random.choice(['great', 'bad', 'okay'])} {random.choice(emojis)}"
        else:
            text = f"The {component} of this {p['name']} is {random.choice(['excellent', 'poor', 'decent'])}. {random.choice(aspect_keywords[component])} performance is noted."

        # Add duplicate for every 50th
        if i > 0 and i % 50 == 0:
            text = p_reviews[-1][2]

        p_reviews.append([p['id'], p['name'], text, p['cat'], 'csv', created_at, review_id, rating, firmware, component])
    
    reviews_data.extend(p_reviews)

# Save CSV
with open('E:/Synapse/testdata/final_phase_2026-04-18/final_phase_reviews.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['product_id','product_name','text','category','source','created_at','review_id','rating','firmware_version','component_focus'])
    writer.writerows(reviews_data)

# JSON Payload (30 records)
json_payload = []
for i in range(30):
    p = random.choice(products)
    json_payload.append({
        "product_id": p['id'],
        "product_name": p['name'],
        "text": f"JSON review {i}: {random.choice(hinglish)}",
        "category": p['cat'],
        "source": "json",
        "rating": random.randint(1,5)
    })
with open('E:/Synapse/testdata/final_phase_2026-04-18/final_phase_json_payload.json', 'w', encoding='utf-8') as f:
    json.dump(json_payload, f, indent=2)

# Manual Payload (15 objects)
manual_payload = []
for i in range(15):
    p = random.choice(products)
    manual_payload.append({
        "product_id": p['id'],
        "product_name": p['name'],
        "raw_text": f"Manual input {i}: {random.choice(sarcasm)}",
        "source": "manual"
    })
with open('E:/Synapse/testdata/final_phase_2026-04-18/final_phase_manual_payloads.json', 'w', encoding='utf-8') as f:
    json.dump(manual_payload, f, indent=2)

# Realtime Payload (20 objects)
realtime_payload = []
for i in range(20):
    p = random.choice(products)
    realtime_payload.append({
        "product_id": p['id'],
        "stream_id": f"RT-{i}",
        "content": f"Realtime feed {i}: {random.choice(spam)}",
        "metadata": {"firmware": "v4.0"}
    })
with open('E:/Synapse/testdata/final_phase_2026-04-18/final_phase_realtime_payloads.json', 'w', encoding='utf-8') as f:
    json.dump(realtime_payload, f, indent=2)

print("Data generation complete.")
