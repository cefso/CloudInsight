from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
from config import get_settings
from database import init_db
from models import CloudAccount, AlertThreshold, InspectionTask, InspectionResult, CronConfig, AiConfig, AiReport, AiConversation  # noqa: F401 — 触发 SQLAlchemy 模型注册
from routers import accounts, inspections, thresholds, cron, dashboard, ai
from services.scheduler import task_scheduler

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    task_scheduler.start()
    yield
    task_scheduler.stop()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan
)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.status_code, "message": exc.detail, "data": None}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"未处理异常: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"code": 500, "message": "服务器内部错误，请稍后重试", "data": None}
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router)
app.include_router(inspections.router)
app.include_router(thresholds.router)
app.include_router(cron.router)
app.include_router(dashboard.router)
app.include_router(ai.router)


@app.get("/")
async def root():
    return {
        "code": 200,
        "message": "success",
        "data": {"name": settings.app_name, "version": settings.app_version}
    }

@app.get("/api/health")
async def health_check():
    return {"code": 200, "message": "ok", "data": {"status": "healthy"}}
