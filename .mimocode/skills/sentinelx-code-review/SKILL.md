---
name: sentinelx-code-review
description: "SentinelX 代码审查：全面检查前后端代码，发现 bug、冗余代码、安全问题和可优化项"
---

# SentinelX 代码审查

对 SentinelX 项目进行全面代码审查的流程。项目路径：`/Users/cefso/code/SentinelX`

## 项目结构

```
SentinelX/
├── backend/          # Python 3.12 + FastAPI + SQLAlchemy + PostgreSQL
│   ├── apps/
│   │   ├── alert/    # 告警管理（dispatcher, models, routers）
│   │   ├── auth/     # 认证授权（dependencies, JWT）
│   │   ├── callback/ # Webhook 回调（router, 签名验证）
│   │   ├── core/     # 核心模块（config, redis, mq, middleware, security）
│   │   ├── notify/   # 通知系统（channels, worker, sender）
│   │   ├── rule/     # 规则引擎（engine, routers, schemas）
│   │   └── tenant/   # 多租户
│   ├── alembic/      # 数据库迁移
│   ├── main.py       # 应用入口
│   └── requirements.txt
├── frontend/         # React 18 + TypeScript + Vite + Tailwind + shadcn/ui
│   ├── src/
│   │   ├── components/  # UI 组件（condition/, layout/, ui/）
│   │   ├── pages/       # 页面（alerts, rules, channels, settings, templates）
│   │   ├── services/    # API 客户端（api.ts）
│   │   ├── stores/      # Zustand 状态管理
│   │   └── schemas/     # Zod 验证 schema
│   ├── package.json
│   └── vite.config.ts
├── docker/           # Docker 构建配置
│   ├── Dockerfile           # 后端镜像
│   ├── Dockerfile.frontend  # 前端镜像
│   ├── Dockerfile.pg        # PostgreSQL + PGMQ
│   ├── docker-compose.yml
│   ├── docker-compose.build.yml
│   └── init-db.sh
└── .github/workflows/  # CI/CD
    ├── ci.yml
    └── cd.yml
```

## 审查维度

### 后端检查清单

1. **Bug 修复**
   - 缺失的 import（如 `hmac, hashlib, base64`）
   - Jinja2 模板语法（`{{severity.upper}}` → `{{severity.upper()}}`）
   - 模型字段引用错误（如 `latest_alert_id` 不存在）
   - 竞态条件（单例锁、并发安全）

2. **安全**
   - 硬编码密码/密钥（如 `Admin@123456`）
   - AES 加密盐值
   - API Key 暴露

3. **代码质量**
   - 死代码（未使用的函数/变量）
   - 单例模式锁保护（redis.py, mq.py）
   - 异步/同步混用
   - 资源泄漏（连接池、会话）

4. **日志**
   - 关键操作缺少日志
   - 错误日志缺少 `exc_info=True`
   - 敏感信息脱敏

5. **MQ/Redis**
   - PGMQ 队列配置正确性
   - Redis 键 TTL 设置
   - 消费者 ack/nack 处理

### 前端检查清单

1. **Bug 修复**
   - Token 刷新竞态（isRefreshing 锁）
   - 路由竞态（SystemAdminRoute）
   - API 调用一致性（apiClient vs fetch）

2. **代码结构**
   - 大文件拆分（>500 行）
   - 组件提取（SeverityBadge, StatusBadge）
   - 常量提取（VARIABLE_DOCS 等）

3. **UI 一致性**
   - shadcn/ui 组件使用
   - Modal 替换（手写 → Dialog）
   - 表单验证（react-hook-form + zod）

4. **TypeScript**
   - 类型错误（`npm run build` 检查）
   - 未使用的变量

### CI/CD 检查

- Dockerfile 与 CI 环境一致性
- 构建镜像标签
- GitHub Actions 配置

## 执行流程

1. 先读取关键配置文件理解项目当前状态
2. 按维度逐项检查
3. 汇总发现，按优先级排序（P0/P1/P2）
4. 提供修复建议和代码片段
