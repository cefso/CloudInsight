import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import get_settings

logger = logging.getLogger(__name__)

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
    from sqlalchemy.engine.url import make_url
    db_path = make_url(settings.database_url).database or settings.database_url.replace("sqlite:///", "")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(inspection_results)")
        columns = {row[1] for row in cursor.fetchall()}
        if "slb_details" not in columns:
            cursor.execute("ALTER TABLE inspection_results ADD COLUMN slb_details TEXT")
        if "expiration_details" not in columns:
            cursor.execute("ALTER TABLE inspection_results ADD COLUMN expiration_details TEXT")
        
        # 为 alert_thresholds 添加 resource_type 列
        cursor.execute("PRAGMA table_info(alert_thresholds)")
        th_columns = {row[1] for row in cursor.fetchall()}
        if "resource_type" not in th_columns:
            cursor.execute("ALTER TABLE alert_thresholds ADD COLUMN resource_type VARCHAR(50)")
        
        # 为 cron_configs 添加 account_ids 列
        cursor.execute("PRAGMA table_info(cron_configs)")
        cron_columns = {row[1] for row in cursor.fetchall()}
        if "account_ids" not in cron_columns:
            cursor.execute("ALTER TABLE cron_configs ADD COLUMN account_ids TEXT")
        
        # AI 配置表会在 init_db() 的 create_all() 中自动创建，无需额外迁移

        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"数据库列迁移失败: {e}", exc_info=True)

def _migrate_expiration_data():
    """将旧的 Expiration 记录从 disk_details 迁移到 expiration_details"""
    import sqlite3
    from sqlalchemy.engine.url import make_url
    db_path = make_url(settings.database_url).database or settings.database_url.replace("sqlite:///", "")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE inspection_results SET expiration_details = disk_details "
            "WHERE resource_type = 'Expiration' AND expiration_details IS NULL AND disk_details IS NOT NULL"
        )
        # 将旧的 SLB 记录从 disk_details 迁移到 slb_details
        cursor.execute(
            "UPDATE inspection_results SET slb_details = disk_details "
            "WHERE resource_type = 'SLB' AND slb_details IS NULL AND disk_details IS NOT NULL"
        )
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"数据迁移失败: {e}", exc_info=True)

def init_db():
    Base.metadata.create_all(bind=engine)
    _migrate_columns()
    _migrate_expiration_data()
