from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from database import Base


class AiConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("inspection_tasks.id"), nullable=False)
    role = Column(String(20), nullable=False)  # user/assistant/tool
    content = Column(Text)
    tool_calls = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())
