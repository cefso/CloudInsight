import asyncio
import logging
import subprocess
import json
from pathlib import Path

logger = logging.getLogger(__name__)

# 需要安装的阿里云 Skills
ALIYUN_SKILLS = [
    {"name": "ecs", "skill": "alibabacloud-ecs", "tools": ["search_ecs_instances", "get_ecs_detail"]},
    {"name": "rds", "skill": "alibabacloud-rds", "tools": ["search_rds_instances", "get_rds_detail"]},
    {"name": "slb", "skill": "alibabacloud-slb", "tools": ["search_slb_instances", "get_slb_detail"]},
    {"name": "redis", "skill": "alibabacloud-redis", "tools": ["search_redis_instances", "get_redis_detail"]},
    {"name": "cms", "skill": "alibabacloud-cms", "tools": ["get_metric_data", "get_system_events"]},
]


class MCPManager:
    def __init__(self):
        self.connected = False
        self.tools = []

    async def ensure_skills_installed(self):
        """确保阿里云 Skills 已安装"""
        try:
            result = subprocess.run(
                ["npx", "skills", "ls"],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode != 0:
                logger.warning("Skills CLI 未安装或不可用")
                return False

            # 检查是否已安装阿里云 Skills
            installed = result.stdout
            for skill in ALIYUN_SKILLS:
                if skill["skill"] not in installed:
                    logger.info(f"安装 Skill: {skill['skill']}")
                    subprocess.run(
                        ["npx", "skills", "add", f"aliyun/{skill['skill']}", "-y"],
                        capture_output=True, text=True, timeout=60
                    )
            return True
        except FileNotFoundError:
            logger.error("Node.js 或 npx 未安装")
            return False
        except Exception as e:
            logger.error(f"检查 Skills 安装状态失败: {e}")
            return False

    async def connect_all(self):
        """连接所有已安装的 MCP Server"""
        # 简化实现：直接使用阿里云 CLI 调用
        # 实际 MCP 连接需要更复杂的实现
        self.connected = True
        self.tools = self._get_default_tools()
        logger.info(f"MCP Manager 初始化完成，可用工具: {len(self.tools)}")

    def _get_default_tools(self) -> list:
        """获取默认工具列表（OpenAI function calling 格式）"""
        return [
            {
                "type": "function",
                "function": {
                    "name": "search_ecs_instances",
                    "description": "搜索 ECS 实例列表，可按地域、状态过滤",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "region": {"type": "string", "description": "地域，如 cn-hangzhou"},
                            "status": {"type": "string", "description": "状态过滤，如 Running, Stopped"}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "search_rds_instances",
                    "description": "搜索 RDS 数据库实例列表",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "region": {"type": "string", "description": "地域"},
                            "status": {"type": "string", "description": "状态"}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_metric_data",
                    "description": "获取云监控指标数据",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "namespace": {"type": "string", "description": "指标命名空间，如 acs_ecs_dashboard"},
                            "metric_name": {"type": "string", "description": "指标名称，如 CPUUtilization"},
                            "instance_id": {"type": "string", "description": "实例ID"},
                            "period": {"type": "string", "description": "统计周期，如 60"}
                        },
                        "required": ["namespace", "metric_name", "instance_id"]
                    }
                }
            },
        ]

    async def call_tool(self, tool_name: str, arguments: dict) -> dict:
        """调用 MCP 工具"""
        # 简化实现：返回模拟数据
        # 实际实现需要通过 MCP Client 调用
        logger.info(f"调用工具: {tool_name}, 参数: {arguments}")
        return {"status": "success", "data": []}

    def get_tools(self) -> list:
        """获取可用工具列表"""
        return self.tools


# 全局单例
mcp_manager = MCPManager()
