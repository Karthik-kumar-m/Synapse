
import csv
import random
import datetime
import os

products = [
    ("P1001", "SparkleShine Shampoo", "Personal Care"),
    ("P1002", "MaxClean Detergent", "Home Care"),
    ("P1003", "CrispBite Biscuits", "Food & Beverage"),
    ("P1004", "FreshSip Coffee", "Food & Beverage"),
    ("P1005", "ToothSure Toothpaste", "Personal Care"),
    ("T2001", "GigaCharge Phone", "Electronics"),
    ("T2002", "LiteTab Tablet", "Electronics")
]

reviews_per_product = 200
output_dir = r"E:\Synapse\testdata\synthetic_pack_2026-04-18"
output_file = os.path.join(output_dir, "synthetic_reviews.csv")

headers = [
    "product_id", "product_name", "category", "review_id", "date", 
    "source", "rating", "text", "firmware_version", 
    "component_focus", "is_sarcastic"
]

positive_texts = [
    "Amazing product, works like a charm!", "Love it, will buy again.", 
    "Best purchase this year!", "Exceeded my expectations.", "Very good quality."
]
negative_texts = [
    "Waste of money.", "Doesn't work as advertised.", 
    "Poor quality, very disappointed.", "Terrible experience.", "Avoid this product."
]
neutral_texts = [
    "It's okay, does the job.", "Average quality, nothing special.", 
    "Decent for the price.", "Fine, but I've seen better.", "Not bad, not great."
]
hinglish_texts = [
    "Boht accha product hai, maza aa gaya.", "Quality thodi weak hai, better ho sakti thi.",
    "Kam paise me badiya cheez hai.", "Delivery late thi, lekin product sahi hai.", "Bilkul bakwas hai, mat lena."
]
edge_cases = [
    "Buy now limited offer click here http://spam.example", # Spam
    "Great product!!! \U0001f602\U0001f525\U0001f4af", # Emojis
    "Oh, I just LOVE when it breaks down after two days. Fantastic.", # Sarcasm
    "Duplicate review text for testing." # Candidate for duplicate
]

rows = []
review_id_counter = 10000

for pid, pname, cat in products:
    for i in range(reviews_per_product):
        review_id = f"R{review_id_counter}"
        review_id_counter += 1
        
        r = random.random()
        if r < 0.4: text = random.choice(positive_texts)
        elif r < 0.7: text = random.choice(negative_texts)
        elif r < 0.85: text = random.choice(neutral_texts)
        elif r < 0.95: text = random.choice(hinglish_texts)
        else: text = random.choice(edge_cases)
        
        is_sarcastic = "1" if "LOVE when it breaks" in text else "0"
        rating = random.randint(1, 5)
        date = (datetime.date(2026, 1, 1) + datetime.timedelta(days=random.randint(0, 100))).isoformat()
        
        rows.append({
            "product_id": pid,
            "product_name": pname,
            "category": cat,
            "review_id": review_id,
            "date": date,
            "source": random.choice(["amazon", "flipkart", "direct"]),
            "rating": rating,
            "text": text,
            "firmware_version": f"v{random.randint(1, 5)}.{random.randint(0, 9)}",
            "component_focus": random.choice(["General", "UI", "Power", "Packaging"]),
            "is_sarcastic": is_sarcastic
        })

with open(output_file, "w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=headers)
    writer.writeheader()
    writer.writerows(rows)

print(f"Successfully wrote {len(rows)} rows to {output_file}")

