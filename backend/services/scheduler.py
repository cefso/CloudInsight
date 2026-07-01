import json
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
from database import SessionLocal
from models import CronConfig
from services.inspection_engine import InspectionEngine

logger = logging.getLogger(__name__)


class TaskScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self._job_ids = {}

    def start(self):
        self.scheduler.start()
        self._load_jobs()

    def stop(self):
        self.scheduler.shutdown()

    def _load_jobs(self):
        db = SessionLocal()
        try:
            configs = db.query(CronConfig).filter(CronConfig.is_enabled == True).all()
            for config in configs:
                self.add_job(config)
        finally:
            db.close()

    def add_job(self, config: CronConfig):
        job_id = f"inspection_{config.id}"
        parts = config.cron_expression.split()
        if len(parts) == 5:
            trigger = CronTrigger(
                minute=parts[0], hour=parts[1],
                day=parts[2], month=parts[3], day_of_week=parts[4]
            )
        else:
            trigger = CronTrigger(minute=0)
        self.scheduler.add_job(
            self._run_inspection, trigger=trigger,
            id=job_id, args=[config.id], replace_existing=True
        )
        self._job_ids[config.id] = job_id

    def remove_job(self, config_id: int):
        job_id = self._job_ids.get(config_id)
        if job_id:
            self.scheduler.remove_job(job_id)
            del self._job_ids[config_id]

    def update_job(self, config: CronConfig):
        self.remove_job(config.id)
        if config.is_enabled:
            self.add_job(config)

    def _run_inspection(self, config_id: int):
        db = SessionLocal()
        try:
            config = db.query(CronConfig).filter(CronConfig.id == config_id).first()
            if config:
                config.last_run_at = datetime.now()
                db.commit()
                account_ids = json.loads(config.account_ids) if config.account_ids else None
            else:
                account_ids = None
            engine = InspectionEngine(db)
            engine.run_inspection(trigger_type="cron", account_ids=account_ids)
        except Exception as e:
            logger.error(f"定时巡检失败: {e}")
        finally:
            db.close()


task_scheduler = TaskScheduler()
