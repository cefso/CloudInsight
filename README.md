# CloudInsight

阿里云资源巡检平台 — 自动化巡检 ECS、RDS、Redis、SLB 等云资源，支持 AI 智能分析。

## 功能特性

- **多账号管理** — 阿里云 AK/SK 加密存储，支持多账号配置
- **资源巡检** — ECS、RDS、Redis、SLB 指标监控（CPU、内存、磁盘）
- **到期预警** — 付费实例到期时间监控，7 天内到期告警
- **系统事件** — 云平台 CRITICAL/WARN 级别事件监控
- **AI 分析** — 接入通义千问/OpenAI，自动生成巡检报告，支持智能问答
- **定时任务** — Cron 表达式配置，自动定时巡检
- **告警阈值** — 按资源类型自定义 CPU/内存/磁盘告警阈值
- **数据导出** — 巡检结果导出 Excel

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Python 3.14 + FastAPI + SQLAlchemy + SQLite |
| 前端 | React 19 + TypeScript + Vite + Ant Design |
| AI | OpenAI 兼容 API（通义千问/OpenAI/Ollama） |
| 部署 | Docker + Nginx |

## 快速开始

### 开发环境

**后端：**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 填写 ENCRYPTION_KEY
uvicorn main:app --reload
```

**前端：**

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173

### Docker 部署

```bash
# 先配置后端密钥
cd backend
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# 将输出写入 .env 文件的 ENCRYPTION_KEY=

cd ..
docker compose up -d
```

访问 http://localhost

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ENCRYPTION_KEY` | 加密密钥（必填） | — |
| `DATABASE_URL` | 数据库地址 | `sqlite:///./inspection.db` |
| `DEBUG` | 调试模式 | `false` |
| `CORS_ORIGINS` | CORS 允许源 | `["http://localhost:5173"]` |

## 项目结构

```
CloudInsight/
├── backend/
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库初始化
│   ├── models/              # SQLAlchemy 模型
│   ├── schemas/             # Pydantic schema
│   ├── routers/             # API 路由
│   ├── services/            # 业务逻辑
│   │   ├── clients/         # 阿里云 SDK 封装
│   │   └── inspectors/      # 巡检引擎
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/             # API 调用
│   │   ├── pages/           # 页面组件
│   │   ├── components/      # 共享组件
│   │   ├── types/           # TypeScript 类型
│   │   └── styles/          # 主题样式
│   └── package.json
├── docker-compose.yml
└── README.md
```

## License

MIT
