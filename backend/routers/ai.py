import json
import logging
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from services.ai_service import AiService
from services.ai_config_service import AiConfigService
from utils.response import success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI 功能"])


# ========== AI 配置 ==========

@router.get("/config")
def get_config(db: Session = Depends(get_db)):
    """获取 AI 配置"""
    service = AiConfigService(db)
    config = service.get_config()
    return success_response(data=config)


@router.put("/config")
def update_config(data: dict, db: Session = Depends(get_db)):
    """更新 AI 配置"""
    service = AiConfigService(db)
    config = service.update_config(data)
    return success_response(data=config, message="配置已更新")


@router.post("/config/test")
async def test_connection(db: Session = Depends(get_db)):
    """测试 AI 连接"""
    service = AiConfigService(db)
    result = await service.test_connection()
    return success_response(data=result)


# ========== AI 分析报告 ==========

@router.post("/analyze")
async def analyze_inspection(
    task_id: int = Query(...),
    focus: str = Query(None),
    db: Session = Depends(get_db)
):
    """生成 AI 分析报告（SSE 流式）"""
    service = AiService(db)

    async def generate():
        async for chunk in service.analyze(task_id, focus):
            yield f"data: {chunk}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/reports")
def list_reports(
    task_id: int = Query(None),
    db: Session = Depends(get_db)
):
    """获取 AI 报告列表"""
    from models.ai_report import AiReport
    query = db.query(AiReport)
    if task_id:
        query = query.filter(AiReport.task_id == task_id)
    reports = query.order_by(AiReport.created_at.desc()).all()
    return success_response(data=[{
        "id": r.id,
        "task_id": r.task_id,
        "content": r.content,
        "model": r.model,
        "tokens_used": r.tokens_used,
        "created_at": r.created_at,
    } for r in reports])


@router.get("/reports/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db)):
    """获取单个 AI 报告"""
    from models.ai_report import AiReport
    report = db.query(AiReport).filter(AiReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return success_response(data={
        "id": report.id,
        "task_id": report.task_id,
        "content": report.content,
        "model": report.model,
        "tokens_used": report.tokens_used,
        "created_at": report.created_at,
    })


# ========== AI 对话 ==========

@router.post("/chat")
async def chat(
    task_id: int = Query(...),
    message: str = Query(...),
    db: Session = Depends(get_db)
):
    """AI 对话（SSE 流式）"""
    service = AiService(db)

    async def generate():
        async for chunk in service.chat(task_id, message):
            yield f"data: {chunk}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/conversations/{task_id}")
def get_conversations(task_id: int, db: Session = Depends(get_db)):
    """获取对话历史"""
    from models.ai_conversation import AiConversation
    conversations = db.query(AiConversation).filter(
        AiConversation.task_id == task_id
    ).order_by(AiConversation.created_at).all()
    return success_response(data=[{
        "id": c.id,
        "task_id": c.task_id,
        "role": c.role,
        "content": c.content,
        "tool_calls": c.tool_calls,
        "created_at": c.created_at,
    } for c in conversations])


@router.delete("/conversations/{task_id}")
def clear_conversations(task_id: int, db: Session = Depends(get_db)):
    """清空对话历史"""
    from models.ai_conversation import AiConversation
    db.query(AiConversation).filter(
        AiConversation.task_id == task_id
    ).delete()
    db.commit()
    return success_response(message="对话历史已清空")
