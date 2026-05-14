# 代码质量工具配置文档

## 概述

本项目使用以下代码质量工具确保代码规范和质量：

- **Black**: 代码格式化工具
- **isort**: import 语句排序
- **Pylint**: 静态代码分析
- **Mypy**: 类型检查
- **pre-commit**: Git hooks 自动化

## 安装

### 1. 安装所有工具

```bash
pip install black pylint mypy pre-commit isort
```

或者使用项目 requirements:

```bash
pip install -r requirements-dev.txt
```

### 2. 安装 pre-commit hooks

```bash
pre-commit install
```

## 工具说明

### Black (代码格式化)

**配置文件**: `pyproject.toml`

**手动运行**:
```bash
# 格式化所有 Python 文件
black .

# 检查但不修改
black --check .

# 格式化特定文件
black python/quant/
```

**配置**:
- 行长度: 100 字符
- Python 版本: 3.11
- 自动排除 `.git`, `__pycache__` 等目录

### isort (import 排序)

**配置文件**: `pyproject.toml`

**手动运行**:
```bash
# 排序所有 import
isort .

# 检查但不修改
isort --check-only .
```

**配置**:
- 使用 black 兼容模式
- 行长度: 100 字符

### Pylint (静态分析)

**配置文件**: `.pylintrc`

**手动运行**:
```bash
# 检查所有 Python 文件
pylint python/quant/

# 检查特定文件
pylint python/quant/ml_pipeline.py

# 生成报告
pylint python/quant/ --output-format=text > pylint-report.txt
```

**已禁用的检查**:
- `C0111`: missing-docstring (文档字符串可选)
- `C0103`: invalid-name (允许灵活命名)
- `C0301`: line-too-long (由 black 处理)
- `R0903`: too-few-public-methods
- `R0913`: too-many-arguments
- `W0212`: protected-access
- `E1101`: no-member (避免误报)

**评分标准**:
- 目标: >= 8.0/10
- 当前代码应该先修复高优先级问题

### Mypy (类型检查)

**配置文件**: `pyproject.toml`

**手动运行**:
```bash
# 检查所有文件
mypy python/quant/

# 检查特定文件
mypy python/quant/ml_pipeline.py

# 显示详细错误
mypy --show-error-codes python/quant/
```

**配置**:
- Python 版本: 3.11
- 忽略第三方库缺失的类型定义 (sklearn, xgboost)
- 检查未标注类型的函数
- 警告冗余类型转换

**类型注解示例**:
```python
from typing import List, Dict, Optional

def process_data(data: List[Dict], threshold: float = 0.5) -> Optional[Dict]:
    """处理数据并返回结果"""
    if not data:
        return None
    return {"result": threshold}
```

## Pre-commit Hooks

**配置文件**: `.pre-commit-config.yaml`

### 自动执行的检查

每次 `git commit` 时自动运行：

1. **基础检查**:
   - 删除行尾空格
   - 确保文件以换行符结尾
   - 检查 YAML/JSON/TOML 语法
   - 检查大文件 (>1MB)
   - 检查合并冲突标记
   - 检查 debug 语句

2. **代码格式化**:
   - Black 自动格式化
   - isort 自动排序 import

3. **代码质量**:
   - Pylint 静态分析
   - Mypy 类型检查

### 手动运行所有 hooks

```bash
# 对所有文件运行
pre-commit run --all-files

# 对暂存文件运行
pre-commit run

# 运行特定 hook
pre-commit run black --all-files
pre-commit run pylint --all-files
```

### 跳过 hooks (不推荐)

```bash
# 跳过所有 hooks
git commit --no-verify -m "message"

# 跳过特定 hook
SKIP=pylint git commit -m "message"
```

## 工作流程

### 日常开发

1. **编写代码**
2. **手动格式化** (可选):
   ```bash
   black python/quant/
   isort python/quant/
   ```
3. **提交代码**:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```
4. **自动检查**: pre-commit 自动运行所有检查
5. **修复问题**: 如果检查失败，修复后重新提交

### CI/CD 集成

在 CI 流程中添加：

```yaml
- name: Install dependencies
  run: pip install black pylint mypy isort

- name: Run Black
  run: black --check .

- name: Run Pylint
  run: pylint python/quant/

- name: Run Mypy
  run: mypy python/quant/
```

## 配置文件位置

```
project/
├── .pylintrc                    # Pylint 配置
├── pyproject.toml               # Black, isort, Mypy 配置
├── .pre-commit-config.yaml      # Pre-commit hooks 配置
└── docs/
    └── CODE_QUALITY.md          # 本文档
```

## 常见问题

### Q: Black 和 Pylint 冲突？
A: 已在 `.pylintrc` 中禁用 `C0301` (line-too-long)，由 Black 统一处理。

### Q: Mypy 报告第三方库类型错误？
A: 已在 `pyproject.toml` 中配置忽略 sklearn 和 xgboost 的类型检查。

### Q: Pre-commit 太慢？
A: 可以只对修改的文件运行：
```bash
pre-commit run  # 只检查暂存文件
```

### Q: 如何临时禁用某个检查？
A: 在代码中添加注释：
```python
# pylint: disable=invalid-name
x = 1

# type: ignore
result = some_untyped_function()
```

### Q: 如何更新 pre-commit hooks？
A: 运行：
```bash
pre-commit autoupdate
```

## 最佳实践

1. **提交前运行检查**: 养成习惯，避免 CI 失败
2. **逐步改进**: 对旧代码逐步添加类型注解
3. **不要盲目禁用**: 理解警告含义后再决定是否禁用
4. **团队一致**: 所有成员使用相同配置
5. **定期更新**: 保持工具版本更新

## 参考资料

- [Black 文档](https://black.readthedocs.io/)
- [Pylint 文档](https://pylint.readthedocs.io/)
- [Mypy 文档](https://mypy.readthedocs.io/)
- [Pre-commit 文档](https://pre-commit.com/)
- [isort 文档](https://pycqa.github.io/isort/)

---

**维护者**: DevOps Team
**更新日期**: 2026-04-14
