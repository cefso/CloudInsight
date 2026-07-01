from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _migrate_columns():
    """为已有表添加新列（SQLite ALTER TABLE）"""
    import sqlite3
    db_path = settings.database_url.replace("sqlite:///", "")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(inspection_results)")
        columns = {row[1] for row in cursor.fetchall()}
        if "slb_details" not in columns:
            cursor.execute("ALTER TABLE inspection_results ADD COLUMN slb_details TEXT")
        if "expiration_details" not in columns:
            cursor.execute("ALTER TABLE inspection_results ADD COLUMN expiration_details TEXT")
        conn.commit()
        conn.close()
    except Exception:
        pass

def init_db():
    Base.metadata.create_all(bind=engine)
    _migrate_columns()
