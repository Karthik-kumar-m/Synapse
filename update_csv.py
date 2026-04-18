import pandas as pd
import numpy as np

file_path = r"E:\Synapse\testdata\synthetic_pack_2026-04-18\synthetic_reviews.csv"
df = pd.read_csv(file_path)

# Dictionary to map product_id to a specific category-style main type
# If there are many product_ids, we can use a cycle or some logic
categories = ["Personal Care", "Home Care", "Food & Beverage", "Electronics", "Software Services"]
unique_ids = df["product_id"].unique()
id_to_type = {pid: categories[i % len(categories)] for i, pid in enumerate(unique_ids)}

# Update product_name based on the mapping
df["product_name"] = df["product_id"].map(id_to_type)

# Save back to CSV
df.to_csv(file_path, index=False)

# Verification
print(f"Columns: {df.columns.tolist()}")
print("Counts per product_id and product_name:")
counts = df.groupby(["product_id", "product_name"]).size().reset_index(name="count")
print(counts)
