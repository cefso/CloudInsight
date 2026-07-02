import logging

logger = logging.getLogger(__name__)


class MCPManager:
    """MCP Manager - 简化版，仅保留基本接口"""

    def __init__(self):
        self._connected = False

    async def connect_all(self):
        """初始化"""
        self._connected = True
        logger.info("MCP Manager 初始化完成")

    def get_tools(self) -> list:
        """获取工具列表（已禁用）"""
        return []

    def get_skills_context(self) -> str:
        """获取 Skills 上下文（已禁用）"""
        return ""


# 全局单例
mcp_manager = MCPManager()
