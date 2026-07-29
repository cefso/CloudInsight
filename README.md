# CloudInsight

阿里云资源巡检平台 — 自动化巡检 ECS、RDS、Redis、SLB 等云资源，支持 AI 智能分析。

## 功能特性

- **多账号管理** — 阿里云 AK/SK 加密存储，支持多账号配置
- **资源巡检** — ECS、RDS、Redis、SLB 指标监控（CPU、内存、磁盘）
- **区域过滤** — 按产品自动过滤支持的区域（基于官方文档）
- **到期预警** — 付费实例到期时间监控，7 天内到期告警
- **系统事件** — 云平台 CRITICAL/WARN 级别事件监控
- **AI 分析** — 接入通义千问/OpenAI，自动生成巡检报告，支持自定义提示词
- **AI 助手** — 智能问答，基于巡检数据提供分析建议
- **富文本复制** — AI 分析报告支持富文本复制，可粘贴到 Word、邮件等
- **定时任务** — Cron 表达式配置，自动定时巡检
- **告警阈值** — 按资源类型自定义 CPU/内存/磁盘告警阈值
- **数据导出** — 巡检结果导出 Excel

## 支持的产品和区域

| 产品 | 支持区域数 | 说明 |
|------|-----------|------|
| ECS（云服务器） | 所有区域 | 通过 CMS API 获取监控数据 |
| RDS（关系型数据库） | 11个 | 北京、成都、广州、河源、香港、呼和浩特、青岛、上海、深圳、乌兰察布、张家口 |
| Redis（缓存服务） | 12个 | 北京、成都、福州、广州、香港、呼和浩特、南京、青岛、深圳、武汉、张家口、郑州 |
| SLB（负载均衡） | 16个 | 北京、成都、福州、广州、河源、香港、呼和浩特、南京、青岛、上海、深圳、武汉、乌兰察布、张家口、郑州、中卫 |

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Python 3.12 + FastAPI + SQLAlchemy + SQLite |
| 前端 | React 19 + TypeScript + Vite + Ant Design |
| AI | OpenAI 兼容 API（通义千问/OpenAI/Ollama/MiniMax） |
| 部署 | Docker + Nginx |

## 快速开始

### Docker 部署（推荐）

```bash
# 1. 先配置后端密钥
cd backend
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# 将输出写入 .env 文件的 ENCRYPTION_KEY=

# 2. 启动服务
cd ..
docker compose up -d

# 3. 访问
# http://localhost:5174
```

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
│   │   ├── inspectors/      # 巡检引擎
│   │   ├── ai_service.py    # AI 分析服务
│   │   └── ai_config_service.py  # AI 配置管理
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/             # API 调用
│       ├── pages/           # 页面组件
│       │   ├── Dashboard/   # 仪表盘
│       │   ├── Inspections/ # 巡检结果
│       │   ├── Settings/    # 系统设置
│       │   └── Accounts/    # 账号管理
│       ├── components/      # 共享组件
│       ├── types/           # TypeScript 类型
│       └── styles/          # 主题样式
├── docker-compose.yml
└── README.md
```

## AI 配置

1. 访问 **设置 → AI 设置**
2. 选择服务提供商（阿里云百炼/OpenAI/Ollama/自定义）
3. 填写 API Key 和模型名称
4. 可选：自定义巡检报告分析提示词
5. 点击 **测试连接** 验证配置

## License

MIT
