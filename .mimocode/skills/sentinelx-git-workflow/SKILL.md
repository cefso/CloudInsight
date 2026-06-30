---
name: sentinelx-git-workflow
description: "SentinelX 项目 Git 工作流：切换分支、创建修复/优化分支、提交推送代码、创建 PR、清理本地分支"
---

# SentinelX Git 工作流

SentinelX 项目的标准 Git 操作流程。项目路径：`/Users/cefso/code/SentinelX`

## 常用操作

### 1. 切换到 main 并获取最新代码

```bash
git checkout main && git pull origin main
```

### 2. 创建新分支

根据任务类型选择分支前缀：

| 任务类型 | 前缀 | 示例 |
|---------|------|------|
| Bug 修复 | `fix/` | `fix/sidebar-dropdown-z-index` |
| 功能开发 | `feat/` | `feat/dingtalk-markdown` |
| 重构 | `refactor/` | `refactor/mq-integration` |
| 优化 | `optimize/` | `optimize/alert-list-display` |

```bash
git checkout -b <prefix>/<descriptive-name>
```

### 3. 提交代码

```bash
git add -A && git commit -m "<type>: <description>"
```

类型：`fix`, `feat`, `refactor`, `chore`, `docs`, `style`, `perf`

### 4. 推送到远程

```bash
git push -u origin <branch-name>
```

### 5. 创建 PR

```bash
gh pr create --title "<title>" --body "<description>"
```

### 6. 合并后清理本地分支

```bash
git checkout main && git pull origin main
git branch --merged main | grep -v "main" | xargs -n 1 git branch -d
```

### 7. 创建 tag

```bash
git tag <tag-name> && git push origin <tag-name>
```

## 注意事项

- 提交前先 `git status` 和 `git diff` 检查变更
- 不要自动推送到远程，除非用户明确要求
- PR 描述应包含变更摘要和测试说明
- CI 检查：前端用 `npm run build`，后端用 `docker compose -f docker/docker-compose.build.yml build backend`
