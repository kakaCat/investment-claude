# GitHub Actions CI 配置文档

## 概述

本项目使用 GitHub Actions 实现持续集成（CI），自动运行代码质量检查和测试。

## CI 工作流

### 触发条件

CI 在以下情况自动运行：
- **Push**: 推送到 `main`, `master`, `develop` 分支
- **Pull Request**: 针对 `main`, `master`, `develop` 分支的 PR

### 运行环境

- **操作系统**: Ubuntu Latest
- **Python 版本**: 3.11

## CI 流程

### Job 1: test (测试和代码质量)

完整的测试和代码质量检查流程：

#### 1. 环境准备
```yaml
- Checkout code (检出代码)
- Set up Python 3.11 (配置 Python 环境)
- Install dependencies (安装依赖)
```

#### 2. 代码格式检查
```bash
# Black - 代码格式化检查
black --check python/

# isort - import 排序检查
isort --check-only python/
```

#### 3. 静态分析
```bash
# Pylint - 代码质量检查
pylint python/quant/ --rcfile=.pylintrc --exit-zero

# Mypy - 类型检查
mypy python/quant/ --config-file=pyproject.toml
```

#### 4. 测试执行
```bash
# Pytest - 运行测试并生成覆盖率报告
pytest tests/ -v --cov=python/quant --cov-report=xml --cov-report=term
```

#### 5. 覆盖率上传
```yaml
# 上传覆盖率到 Codecov
codecov/codecov-action@v4
```

### Job 2: lint (代码检查)

独立的代码检查流程，快速反馈代码质量问题：

```yaml
- Black 格式检查
- isort 排序检查
- Pylint 静态分析
- Mypy 类型检查
```

## 配置文件

### 工作流配置
- **文件**: `.github/workflows/ci.yml`
- **语法**: YAML
- **版本**: GitHub Actions v4/v5

### 依赖文件
- `python/quant/requirements.txt` - 项目依赖
- `requirements-dev.txt` - 开发工具依赖

### 配置文件
- `.pylintrc` - Pylint 配置
- `pyproject.toml` - Black/isort/Mypy 配置

## 状态徽章

在 README.md 中添加了以下徽章：

```markdown
[![CI](https://github.com/YOUR_USERNAME/investment-claude/actions/workflows/ci.yml/badge.svg)](...)
[![codecov](https://codecov.io/gh/YOUR_USERNAME/investment-claude/branch/main/graph/badge.svg)](...)
[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](...)
[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](...)
```

**注意**: 需要将 `YOUR_USERNAME` 替换为实际的 GitHub 用户名或组织名。

## 使用说明

### 查看 CI 状态

1. 访问 GitHub 仓库页面
2. 点击 "Actions" 标签
3. 查看最近的工作流运行记录

### 本地运行 CI 检查

在提交代码前，可以本地运行相同的检查：

```bash
# 1. 格式检查
black --check python/
isort --check-only python/

# 2. 静态分析
pylint python/quant/ --rcfile=.pylintrc
mypy python/quant/ --config-file=pyproject.toml

# 3. 运行测试
pytest tests/ -v --cov=python/quant

# 或者使用 pre-commit 一次性运行所有检查
pre-commit run --all-files
```

### CI 失败处理

#### 格式检查失败
```bash
# 自动修复格式问题
black python/
isort python/

# 提交修复
git add .
git commit -m "style: fix code formatting"
```

#### 静态分析失败
```bash
# 查看具体问题
pylint python/quant/ --rcfile=.pylintrc

# 修复代码问题后重新提交
```

#### 类型检查失败
```bash
# 查看类型错误
mypy python/quant/ --config-file=pyproject.toml

# 添加类型注解或修复类型错误
```

#### 测试失败
```bash
# 本地运行测试
pytest tests/ -v

# 修复失败的测试
# 重新运行确认
```

## 配置 Codecov

### 1. 注册 Codecov

访问 [codecov.io](https://codecov.io/) 并使用 GitHub 账号登录。

### 2. 添加仓库

在 Codecov 中添加 `investment-claude` 仓库。

### 3. 获取 Token

Codecov 会自动为公开仓库生成 token。私有仓库需要手动配置。

### 4. 配置 GitHub Secrets (私有仓库)

如果是私有仓库，需要在 GitHub 仓库设置中添加 Secret：

1. 进入仓库 Settings → Secrets and variables → Actions
2. 添加 `CODECOV_TOKEN`
3. 更新 `.github/workflows/ci.yml`:

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    file: ./coverage.xml
```

## 高级配置

### 添加更多 Python 版本

```yaml
strategy:
  matrix:
    python-version: ['3.9', '3.10', '3.11']
```

### 添加缓存加速

```yaml
- name: Cache pip packages
  uses: actions/cache@v3
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements*.txt') }}
```

### 添加通知

```yaml
- name: Notify on failure
  if: failure()
  uses: actions/github-script@v6
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: '❌ CI failed! Please check the logs.'
      })
```

## 最佳实践

1. **提交前本地检查**: 使用 pre-commit hooks 在提交前自动检查
2. **小步提交**: 频繁提交小的改动，便于快速定位问题
3. **关注 CI 状态**: 及时修复 CI 失败，不要积累问题
4. **保持绿色**: 确保 main 分支的 CI 始终通过
5. **覆盖率目标**: 保持测试覆盖率 > 80%

## 故障排查

### Q: CI 运行时间过长？
A:
- 使用缓存加速依赖安装
- 并行运行独立的检查任务
- 优化测试用例

### Q: 依赖安装失败？
A:
- 检查 requirements.txt 格式
- 确认依赖版本兼容性
- 查看 pip 安装日志

### Q: 测试在 CI 中失败但本地通过？
A:
- 检查环境差异（Python 版本、操作系统）
- 确认测试没有依赖本地文件或配置
- 查看 CI 日志获取详细错误信息

## 参考资料

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Codecov 文档](https://docs.codecov.com/)
- [pytest 文档](https://docs.pytest.org/)
- [Black 文档](https://black.readthedocs.io/)
- [Pylint 文档](https://pylint.readthedocs.io/)

---

**维护者**: DevOps Team
**更新日期**: 2026-04-14
