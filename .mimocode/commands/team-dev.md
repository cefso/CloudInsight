---
description: "SentinelX 并行开发：创建 team-lead 子代理团队，将任务分配给前后端子代理并行执行"
---

# SentinelX 并行开发

将任务分配给多个子代理并行执行，适用于前后端同步开发场景。

## 使用方式

```
/team-dev <任务描述>
```

## 执行流程

1. **分析任务**：理解需求，拆分为前端和后端子任务
2. **创建子代理**：使用 TeamCreate 创建 team-lead 子代理团队
3. **分配任务**：为每个子代理提供详细的任务描述和文件清单
4. **监控进度**：等待子代理完成任务
5. **验证结果**：检查构建是否成功，代码是否正确

## 子代理命名规范

| 角色 | 名称 | 颜色 | 职责 |
|------|------|------|------|
| 后端 | backend-dev | blue | Python/FastAPI/SQLAlchemy |
| 前端 | frontend-dev | green | React/TypeScript/Vite |
| 安全 | security-agent | red | 安全修复 |
| 性能 | perf-agent | yellow | 性能优化 |
| 架构 | arch-agent | purple | 架构改进 |
| Bug修复 | bugfix-agent | orange | Bug 修复 |
| 基础设施 | infra-agent | gray | 基础设施 |

## 任务分配模板

```json
{
  "type": "task_assignment",
  "taskId": "<task-id>",
  "subject": "<简短描述>",
  "description": "<详细描述，包含文件路径和具体修改>",
  "assignedBy": "team-lead",
  "timestamp": "<ISO timestamp>"
}
```

## 注意事项

- 每个子代理任务应包含具体文件路径和修改内容
- 子代理完成后应运行构建验证
- 使用 TaskUpdate 标记任务完成
- 团队完成后使用 TeamDelete 解散团队
