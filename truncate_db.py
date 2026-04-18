import psycopg2
try:
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/synapse")
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
    tables = [row[0] for row in cur.fetchall()]
    print(f"Found tables: {', '.join(tables)}")
    for table in tables:
        cur.execute(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE;')
        print(f"Truncated {table}")
    conn.commit()
    for table in tables:
        cur.execute(f'SELECT COUNT(*) FROM "{table}";')
        count = cur.fetchone()[0]
        print(f"{table} count: {count}")
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
