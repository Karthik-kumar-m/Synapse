import pandas as pd
file_path = r"E:\Synapse\testdata\synthetic_pack_2026-04-18\synthetic_reviews.csv"
df = pd.read_csv(file_path)
print(f"Header: {', '.join(df.columns)}")
counts = df.groupby(["product_id", "product_name"]).size()
print("Product IDs, Names, and Counts:")
print(counts)
print(f"Total rows: {len(df)}")
