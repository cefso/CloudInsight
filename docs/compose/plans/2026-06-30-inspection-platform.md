# 阿里云巡检平台实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个阿里云资源日常巡检平台，支持多账号配置、定时巡检、阈值告警和可视化展示

**Architecture:** 单仓单服务架构，FastAPI 后端同时服务 API 和前端静态文件，SQLite 存储数据，APScheduler 处理定时任务

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy, APScheduler, alibabacloud_cms20190101, React 18, Ant Design 5, Vite

## Global Constraints

- Python 版本 >= 3.11
- FastAPI 版本 >= 0.104.0
- Node.js 版本 >= 18
- AK/SK 必须加密存储（使用 cryptography.fernet）
- 所有 API 响应遵循统一格式：`{"code": 200, "message": "success", "data": {...}}`
- 前端支持深色/浅色主题切换
- 代码注释使用中文

---

## 文件结构

```
aliyun/
├── backend/
│   ├── main.py                    # FastAPI 入口
│   ├── config.py                  # 配置管理
│   ├── database.py                # 数据库连接
│   ├── models/                    # SQLAlchemy 模型
│   ├── schemas/                   # Pydantic 模型
│   ├── routers/                   # API 路由
│   ├── services/                  # 业务服务
│   ├── utils/                     # 工具函数
│   └── requirements.txt
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── api/                   # API 调用
│       ├── components/            # 通用组件
│       ├── pages/                 # 页面组件
│       ├── hooks/                 # 自定义 Hook
│       └── styles/                # 样式配置
└── docs/
```

---

> **注意：** 由于计划内容较长，详细的任务步骤请参见以下分文件：
> - `docs/compose/plans/2026-06-30-inspection-platform/tasks-01-05.md` - 后端基础任务
> - `docs/compose/plans/2026-06-30-inspection-platform/tasks-06-10.md` - 后端 API 任务
> - `docs/compose/plans/2026-06-30-inspection-platform/tasks-11-15.md` - 前端任务
