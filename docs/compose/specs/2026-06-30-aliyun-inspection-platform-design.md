# 阿里云巡检平台设计文档

## [S1] 概述

### 项目目标
构建一个阿里云日常巡检平台，通过云监控 SDK 自动检测各类云资源的使用情况，当 CPU、内存、磁盘等指标超过阈值时标记为异常，并提供直观的前端界面进行配置和结果查看。

### 核心价值
- **自动化巡检**：定时自动检测，减少人工巡检成本
- **多账号支持**：支持配置多个阿里云账号，统一管理
- **可视化展示**：现代化前端界面，清晰展示巡检结果
- **灵活配置**：支持自定义告警阈值和定时任务

---

## [S2] 技术架构

### 技术栈
| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 后端 | Python + FastAPI | 高性能异步框架 |
| 前端 | React + Ant Design | 现代化 UI 组件库 |
| 数据库 | SQLite | 轻量级本地存储 |
| 定时任务 | APScheduler | Python 定时任务框架 |
| 阿里云 SDK | alibabacloud_cms20190101 | 云监控 API |

### 架构图
```
┌─────────────────────────────────────────────────────────────────┐
│                         用户浏览器                               │
│                   React + Ant Design 前端                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       FastAPI 后端服务                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   API 路由    │  │  定时调度器   │  │  静态文件服务  │          │
│  │  /api/*      │  │ APScheduler  │  │  /static/*   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                    │                    │
                    ▼                    ▼
        ┌──────────────────┐  ┌──────────────────┐
        │   SQLite 数据库   │  │  阿里云 CMS SDK   │
        │                  │  │                  │
        │ • 巡检任务记录    │  │ • 资源列表查询    │
        │ • 巡检结果存储    │  │ • 指标数据获取    │
        │ • 配置信息存储    │  │ • 多地域支持      │
        └──────────────────┘  └──────────────────┘
                                    │
                                    ▼
                        ┌──────────────────────┐
                        │     阿里云 API        │
                        │  ECS / RDS / SLB ...  │
                        └──────────────────────┘
```

---

## [S3] 数据模型

### cloud_accounts 表（云账号配置）
```sql
CREATE TABLE cloud_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                    -- 账号名称
    access_key_id TEXT NOT NULL,           -- Access Key ID
    access_key_secret TEXT NOT NULL,       -- Access Key Secret (加密存储)
    regions TEXT,                          -- 监控地域 JSON 数组
    resource_types TEXT,                   -- 监控资源类型 JSON 数组
    is_enabled BOOLEAN DEFAULT 1,          -- 是否启用
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### alert_thresholds 表（告警阈值配置）
```sql
CREATE TABLE alert_thresholds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                    -- 阈值名称
    cpu_threshold REAL DEFAULT 90.0,       -- CPU 阈值 (%)
    memory_threshold REAL DEFAULT 90.0,    -- 内存阈值 (%)
    disk_threshold REAL DEFAULT 90.0,      -- 磁盘阈值 (%)
    is_default BOOLEAN DEFAULT 0,          -- 是否默认阈值
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### inspection_tasks 表（巡检任务）
```sql
CREATE TABLE inspection_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trigger_type TEXT NOT NULL,            -- 触发类型: manual/cron
    status TEXT DEFAULT 'running',         -- 状态: running/completed/failed
    started_at DATETIME NOT NULL,          -- 开始时间
    completed_at DATETIME,                 -- 完成时间
    total_resources INTEGER DEFAULT 0,     -- 资源总数
    normal_count INTEGER DEFAULT 0,        -- 正常数量
    abnormal_count INTEGER DEFAULT 0,      -- 异常数量
    error_message TEXT                     -- 错误信息
);
```

### inspection_results 表（巡检结果）
```sql
CREATE TABLE inspection_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,              -- 关联任务 ID
    account_id INTEGER NOT NULL,           -- 关联账号 ID
    resource_type TEXT NOT NULL,           -- 资源类型
    resource_id TEXT NOT NULL,             -- 资源 ID
    resource_name TEXT,                    -- 资源名称
    region TEXT NOT NULL,                  -- 地域
    cpu_usage REAL,                        -- CPU 使用率 (%)
    memory_usage REAL,                     -- 内存使用率 (%)
    disk_usage REAL,                       -- 磁盘使用率 (%)
    is_abnormal BOOLEAN DEFAULT 0,         -- 是否异常
    abnormal_metrics TEXT,                 -- 异常指标 JSON
    inspected_at DATETIME NOT NULL,        -- 巡检时间
    FOREIGN KEY (task_id) REFERENCES inspection_tasks(id),
    FOREIGN KEY (account_id) REFERENCES cloud_accounts(id)
);
```

### cron_configs 表（定时任务配置）
```sql
CREATE TABLE cron_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                    -- 任务名称
    cron_expression TEXT NOT NULL,         -- Cron 表达式
    is_enabled BOOLEAN DEFAULT 1,          -- 是否启用
    last_run_at DATETIME,                  -- 上次运行时间
    next_run_at DATETIME,                  -- 下次运行时间
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## [S4] API 设计

### 账号管理 /api/accounts
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/accounts | 获取所有账号列表 |
| POST | /api/accounts | 创建新账号 |
| PUT | /api/accounts/{id} | 更新账号配置 |
| DELETE | /api/accounts/{id} | 删除账号 |
| POST | /api/accounts/{id}/test | 测试账号连接 |

### 巡检任务 /api/inspections
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/inspections/trigger | 手动触发巡检 |
| GET | /api/inspections/tasks | 获取任务列表（分页） |
| GET | /api/inspections/tasks/{id} | 获取任务详情 |
| GET | /api/inspections/results | 获取巡检结果（支持筛选） |
| GET | /api/inspections/results/export | 导出巡检报告 |

### 阈值配置 /api/thresholds
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/thresholds | 获取阈值配置列表 |
| POST | /api/thresholds | 创建阈值配置 |
| PUT | /api/thresholds/{id} | 更新阈值配置 |

### 定时任务 /api/cron
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/cron | 获取定时任务配置 |
| POST | /api/cron | 创建定时任务 |
| PUT | /api/cron/{id} | 更新定时任务 |
| GET | /api/dashboard/stats | 获取仪表盘统计数据 |

---

## [S5] 前端设计

### 页面结构
1. **Dashboard（巡检总览）**
   - 面包屑导航：首页 / 巡检总览
   - 统计卡片：监控资源数、正常数、异常数、下次巡检时间
   - 异常资源列表表格

2. **Configuration（配置中心）**
   - 左侧边栏导航
   - 云账号管理：支持多账号 CRUD
   - 告警阈值设置：CPU/内存/磁盘阈值
   - 定时任务管理：Cron 表达式配置

3. **Inspection Results（巡检结果）**
   - 多维度筛选：资源类型、状态、地域、账号
   - 资源类型标签页切换
   - 详细指标数据表格
   - 支持导出 Excel/PDF

### 主题支持
- **深色模式**：Zinc 色系，适合夜间使用
- **浅色模式**：纯净白底，适合日间使用
- **主题切换**：右上角一键切换，localStorage 持久化
- **自动检测**：首次访问跟随系统主题

### 配色方案
- 主色：蓝紫渐变 (#3b82f6 → #8b5cf6)
- 状态色：绿色(正常)、红色(异常)、黄色(警告)
- 中性色：Zinc 色系

---

## [S6] 核心功能

### 巡检引擎
1. **资源发现**：通过 CMS SDK 获取所有监控资源
2. **指标采集**：并行获取 CPU、内存、磁盘等指标
3. **阈值对比**：与配置的阈值进行比较
4. **结果记录**：将巡检结果写入数据库

### 支持的资源类型
- ECS（云服务器）
- RDS（关系型数据库）
- SLB（负载均衡）
- OSS（对象存储）
- Redis（缓存服务）
- NAT（网关）
- 更多由 CMS SDK 支持的资源类型

### 告警阈值
- 默认阈值：90%
- 支持自定义：CPU、内存、磁盘分别设置
- 预设模板：80%、90%、95%

---

## [S7] 部署方案

### 单仓单服务架构
- FastAPI 同时服务 API 和前端静态文件
- 前端打包后放入 `static/` 目录
- 单进程部署，适合中小规模使用

### 启动方式
```bash
# 后端
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000

# 前端开发
cd frontend && npm start

# 前端打包
cd frontend && npm run build
```

---

## [S8] 安全考虑

### 凭证安全
- AK/SK 加密存储（使用 Fernet 对称加密）
- 前端不显示完整 AK，仅显示脱敏版本
- 测试连接时使用临时凭证

### 访问控制
- 无需用户认证（适合个人/小团队）
- 可选：简单密码保护

---

## [S9] 后续扩展

### 可扩展方向
- 支持更多云厂商（AWS、Azure）
- 增加告警通知（钉钉、飞书、邮件）
- 历史趋势图表
- 资源成本分析
- 自动化修复建议
