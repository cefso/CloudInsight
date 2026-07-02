import json
import logging
from typing import AsyncGenerator

from sqlalchemy.orm import Session
from openai import AsyncOpenAI

from models.ai_report import AiReport
from models.ai_conversation import AiConversation
from models.inspection_result import InspectionResult
from services.ai_config_service import AiConfigService
from services.mcp_manager import mcp_manager

logger = logging.getLogger(__name__)


class AiService:
    def __init__(self, db: Session):
        self.db = db
        self.config_service = AiConfigService(db)

    def _get_client(self) -> AsyncOpenAI | None:
        """获取 OpenAI 兼容客户端"""
        config = self.config_service.get_decrypted_config()
        if not config or not config.get("api_key"):
            return None
        return AsyncOpenAI(
            api_key=config["api_key"],
            base_url=config["base_url"],
        )

    def _get_inspection_context(self, task_id: int) -> str:
        """获取巡检数据作为上下文"""
        results = self.db.query(InspectionResult).filter(
            InspectionResult.task_id == task_id
        ).all()

        if not results:
            return "暂无巡检数据"

        # 统计信息
        total = len(results)
        abnormal = sum(1 for r in results if r.status == "abnormal")
        warning = sum(1 for r in results if r.status == "warning")
        normal = sum(1 for r in results if r.status == "normal")

        # 按资源类型分组
        by_type: dict[str, list] = {}
        for r in results:
            if r.resource_type not in by_type:
                by_type[r.resource_type] = []
            by_type[r.resource_type].append({
                "id": r.resource_id,
                "name": r.resource_name,
                "region": r.region,
                "cpu": r.cpu_usage,
                "memory": r.memory_usage,
                "disk": r.disk_usage,
                "status": r.status,
            })

        context = f"""巡检任务 #{task_id} 数据摘要：
- 总资源数: {total}
- 正常: {normal}, 警告: {warning}, 异常: {abnormal}

各资源类型详情：
"""
        for rtype, items in by_type.items():
            context += f"\n{rtype} ({len(items)} 个):\n"
            for item in items[:10]:  # 限制每个类型最多10条
                context += (
                    f"  - {item['name']} ({item['id']}): "
                    f"CPU={item['cpu']}%, 内存={item['memory']}%, "
                    f"磁盘={item['disk']}%, 状态={item['status']}\n"
                )

        return context

    async def analyze(self, task_id: int, focus: str = None) -> AsyncGenerator:
        """生成 AI 分析报告（流式）"""
        client = self._get_client()
        if not client:
            yield json.dumps({"type": "error", "content": "请先配置 AI 服务"}) + "\n"
            return

        config = self.config_service.get_decrypted_config()
        context = self._get_inspection_context(task_id)

        system_prompt = """你是一个云资源巡检分析专家。根据巡检数据，生成详细的分析报告。

报告格式：
## 巡检概览
总结整体健康状况

## 异常分析
列出所有异常资源，分析可能的根因

## 优化建议
针对每个异常给出具体的优化建议

## 风险提示
指出潜在的风险和需要关注的资源"""

        if focus:
            system_prompt += f"\n\n重点关注：{focus}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"请分析以下巡检数据：\n\n{context}"},
        ]

        full_content = ""
        try:
            stream = await client.chat.completions.create(
                model=config["model"],
                messages=messages,
                max_tokens=config["max_tokens"],
                stream=True,
            )

            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_content += content
                    yield json.dumps({"type": "token", "content": content}) + "\n"

            # 保存报告
            report = AiReport(
                task_id=task_id,
                content=full_content,
                model=config["model"],
            )
            self.db.add(report)
            self.db.commit()

            yield json.dumps({"type": "done", "report_id": report.id}) + "\n"

        except Exception as e:
            logger.error(f"AI 分析失败: {e}")
            yield json.dumps({"type": "error", "content": f"分析失败: {str(e)}"}) + "\n"

    async def chat(self, task_id: int, message: str) -> AsyncGenerator:
        """AI 对话（流式）"""
        client = self._get_client()
        if not client:
            yield json.dumps({"type": "error", "content": "请先配置 AI 服务"}) + "\n"
            return

        config = self.config_service.get_decrypted_config()
        context = self._get_inspection_context(task_id)

        # 保存用户消息
        self.db.add(AiConversation(task_id=task_id, role="user", content=message))
        self.db.commit()

        # 获取历史对话
        history = self.db.query(AiConversation).filter(
            AiConversation.task_id == task_id
        ).order_by(AiConversation.created_at).all()

        messages = [
            {
                "role": "system",
                "content": (
                    f"你是一个云资源巡检助手。用户正在查看巡检任务 #{task_id} 的结果。\n\n"
                    f"当前巡检数据：\n{context}\n\n"
                    "你可以回答关于巡检结果的问题，也可以调用工具查询更多阿里云数据。"
                ),
            },
        ]

        # 添加历史对话（最近10条）
        for h in history[-10:]:
            messages.append({"role": h.role, "content": h.content})

        # 添加当前用户消息
        messages.append({"role": "user", "content": message})

        tools = mcp_manager.get_tools()
        full_content = ""

        try:
            stream = await client.chat.completions.create(
                model=config["model"],
                messages=messages,
                tools=tools if tools else None,
                max_tokens=config["max_tokens"],
                stream=True,
            )

            async for chunk in stream:
                delta = chunk.choices[0].delta

                # 处理工具调用
                if delta.tool_calls:
                    for tool_call in delta.tool_calls:
                        yield json.dumps({
                            "type": "tool_call",
                            "id": tool_call.id,
                            "name": tool_call.function.name,
                            "arguments": tool_call.function.arguments,
                        }) + "\n"

                # 处理文本内容
                if delta.content:
                    content = delta.content
                    full_content += content
                    yield json.dumps({"type": "token", "content": content}) + "\n"

            # 保存助手回复
            self.db.add(AiConversation(
                task_id=task_id,
                role="assistant",
                content=full_content,
            ))
            self.db.commit()

            yield json.dumps({"type": "done"}) + "\n"

        except Exception as e:
            logger.error(f"AI 对话失败: {e}")
            yield json.dumps({"type": "error", "content": f"对话失败: {str(e)}"}) + "\n"
