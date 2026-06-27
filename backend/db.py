from sqlalchemy import create_engine
import pandas as pd

# الأفضل تستعمل env variable
DB_URL = "postgresql://postgres:74pyX3D1nYoC55ai@db.mgjqtzhwexzvnhtzbvai.supabase.co:5432/postgres"

engine = create_engine(DB_URL)


def insert_solar_data(df: pd.DataFrame):
    df = df.copy()
    df["datetime"] = pd.to_datetime(df["datetime"])
    df = df.drop_duplicates(subset=["datetime"])
    df.to_sql("solar_data", engine, if_exists="append", index=False)


def get_last_96h():
    query = """
        SELECT *
        FROM (
            SELECT *
            FROM solar_data
            ORDER BY datetime DESC
            LIMIT 96
        ) sub
        ORDER BY datetime ASC
    """

    with engine.connect() as conn:
        return pd.read_sql(query, conn)

def get_last_n(n=72):
    query = f"""
        SELECT *
        FROM solar_data
        ORDER BY datetime DESC
        LIMIT {n}
    """
    df = pd.read_sql(query, engine)
    return df.sort_values("datetime")