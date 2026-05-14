# 测试文档

> 量化项目测试框架和测试指南

**版本**: v1.0
**更新日期**: 2026-04-14
**测试覆盖率目标**: 80%+

---

## 📋 目录

1. [测试框架概述](#测试框架概述)
2. [目录结构](#目录结构)
3. [快速开始](#快速开始)
4. [测试类型](#测试类型)
5. [编写测试](#编写测试)
6. [运行测试](#运行测试)
7. [测试覆盖率](#测试覆盖率)
8. [最佳实践](#最佳实践)

---

## 测试框架概述

本项目使用 **pytest** 作为测试框架，配合以下工具：

- **pytest**: 测试框架核心
- **pytest-cov**: 测试覆盖率报告
- **pytest-mock**: Mock 和 Patch 支持
- **pytest-asyncio**: 异步测试支持

### 核心特性

✅ 自动测试发现
✅ 丰富的 fixtures 支持
✅ 详细的测试报告
✅ 覆盖率统计和报告
✅ 并行测试执行
✅ 自动标记和分类

---

## 目录结构

```
tests/
├── __init__.py
├── conftest.py              # 全局 fixtures 和配置
├── README.md                # 本文档
│
├── unit/                    # 单元测试
│   ├── __init__.py
│   ├── backend/             # 后端单元测试
│   │   ├── __init__.py
│   │   ├── test_data_adapter.py      # 数据适配器测试
│   │   ├── test_technical.py         # 技术指标测试
│   │   ├── test_ml_pipeline.py       # ML 流水线测试
│   │   └── ...
│   └── frontend/            # 前端单元测试（未来）
│
├── integration/             # 集成测试
│   ├── __init__.py
│   ├── backend/
│   │   ├── test_training_pipeline.py # 训练流程集成测试
│   │   └── test_prediction_flow.py   # 预测流程集成测试
│   └── frontend/
│
├── e2e/                     # 端到端测试
│   ├── __init__.py
│   └── test_full_workflow.py         # 完整工作流测试
│
└── performance/             # 性能测试
    ├── __init__.py
    ├── backend/
    │   ├── test_data_loading.py      # 数据加载性能
    │   └── test_prediction_speed.py  # 预测速度测试
    └── frontend/
```

---

## 快速开始

### 1. 安装依赖

```bash
# 进入项目目录
cd /Users/mac/Documents/ai/investment-claude

# 安装测试依赖
pip install -r python/quant/requirements.txt
```

### 2. 运行所有测试

```bash
# 运行所有测试
pytest

# 运行并显示覆盖率
pytest --cov=python/quant --cov-report=term-missing
```

### 3. 查看测试报告

```bash
# 生成 HTML 覆盖率报告
pytest --cov=python/quant --cov-report=html

# 在浏览器中打开
open htmlcov/index.html
```

---

## 测试类型

### 1. 单元测试 (Unit Tests)

**目的**: 测试单个函数或类的功能
**位置**: `tests/unit/`
**标记**: `@pytest.mark.unit`

**示例**:
```python
def test_validate_dataframe(sample_stock_data):
    """测试数据验证函数"""
    result = validate_dataframe(sample_stock_data, "600519")
    assert not result.empty
```

**运行**:
```bash
pytest tests/unit/ -v
# 或使用标记
pytest -m unit
```

### 2. 集成测试 (Integration Tests)

**目的**: 测试多个模块协同工作
**位置**: `tests/integration/`
**标记**: `@pytest.mark.integration`

**示例**:
```python
@pytest.mark.integration
def test_training_pipeline():
    """测试完整训练流程"""
    # 数据获取 -> 特征工程 -> 模型训练
    pass
```

**运行**:
```bash
pytest tests/integration/ -v
# 或使用标记
pytest -m integration
```

### 3. 端到端测试 (E2E Tests)

**目的**: 测试完整的用户场景
**位置**: `tests/e2e/`
**标记**: `@pytest.mark.e2e`

**运行**:
```bash
pytest tests/e2e/ -v
pytest -m e2e
```

### 4. 性能测试 (Performance Tests)

**目的**: 测试系统性能和响应时间
**位置**: `tests/performance/`
**标记**: `@pytest.mark.performance`

**运行**:
```bash
pytest tests/performance/ -v
pytest -m performance
```

---

## 编写测试

### 使用 Fixtures

`conftest.py` 提供了常用的 fixtures：

```python
def test_example(sample_stock_data, sample_symbols):
    """使用 fixtures 的测试示例"""
    # sample_stock_data: 模拟股票数据
    # sample_symbols: 股票代码列表
    assert len(sample_stock_data) > 0
```

**可用 Fixtures**:
- `sample_stock_data`: 100 天的模拟股票数据
- `invalid_stock_data`: 包含异常值的数据
- `empty_dataframe`: 空 DataFrame
- `sample_symbols`: 股票代码列表
- `mock_akshare_response`: 模拟 akshare_bridge 响应
- `mock_akshare_error`: 模拟错误响应

### 使用 Mock

```python
from unittest.mock import patch

@patch('quant.data_adapter.akshare_bridge')
def test_with_mock(mock_bridge, mock_akshare_response):
    """使用 mock 的测试"""
    mock_bridge.get_stock_history.return_value = mock_akshare_response

    result = get_stock_history("600519", days=100)

    assert not result.empty
    mock_bridge.get_stock_history.assert_called_once()
```

### 测试异常

```python
def test_exception():
    """测试异常抛出"""
    with pytest.raises(ValueError, match="Empty dataframe"):
        validate_dataframe(pd.DataFrame(), "600519")
```

### 参数化测试

```python
@pytest.mark.parametrize("symbol,days", [
    ("600519", 100),
    ("000858", 200),
    ("600036", 300),
])
def test_multiple_symbols(symbol, days):
    """测试多个股票代码"""
    result = get_stock_history(symbol, days)
    assert not result.empty
```

---

## 运行测试

### 基本命令

```bash
# 运行所有测试
pytest

# 详细输出
pytest -v

# 显示 print 输出
pytest -s

# 运行特定文件
pytest tests/unit/backend/test_data_adapter.py

# 运行特定测试
pytest tests/unit/backend/test_data_adapter.py::TestValidateDataframe::test_validate_valid_dataframe

# 运行特定类
pytest tests/unit/backend/test_data_adapter.py::TestValidateDataframe
```

### 使用标记

```bash
# 只运行单元测试
pytest -m unit

# 只运行集成测试
pytest -m integration

# 排除慢速测试
pytest -m "not slow"

# 组合标记
pytest -m "unit and not slow"
```

### 并行执行

```bash
# 安装 pytest-xdist
pip install pytest-xdist

# 使用 4 个进程并行运行
pytest -n 4
```

### 失败时停止

```bash
# 第一个失败后停止
pytest -x

# 两个失败后停止
pytest --maxfail=2
```

### 重新运行失败的测试

```bash
# 只运行上次失败的测试
pytest --lf

# 先运行失败的，再运行其他的
pytest --ff
```

---

## 测试覆盖率

### 生成覆盖率报告

```bash
# 终端输出
pytest --cov=python/quant --cov-report=term-missing

# HTML 报告
pytest --cov=python/quant --cov-report=html

# XML 报告（用于 CI）
pytest --cov=python/quant --cov-report=xml
```

### 覆盖率目标

| 模块 | 当前覆盖率 | 目标覆盖率 |
|------|-----------|-----------|
| data_adapter.py | 0% → 85% | 85%+ |
| features/technical.py | 0% → 80% | 80%+ |
| ml_pipeline.py | 0% → 75% | 75%+ |
| models/ | 0% → 70% | 70%+ |
| **总体** | **0%** | **80%+** |

### 查看覆盖率报告

```bash
# 生成 HTML 报告
pytest --cov=python/quant --cov-report=html

# 在浏览器中打开
open htmlcov/index.html
```

---

## 最佳实践

### 1. 测试命名

```python
# ✅ 好的命名
def test_validate_dataframe_removes_nan_values():
    """测试删除 NaN 值"""
    pass

# ❌ 不好的命名
def test1():
    pass
```

### 2. 测试组织

```python
# ✅ 使用类组织相关测试
class TestValidateDataframe:
    """测试数据验证函数"""

    def test_valid_data(self):
        pass

    def test_invalid_data(self):
        pass
```

### 3. 测试独立性

```python
# ✅ 每个测试独立
def test_a():
    data = create_data()
    assert process(data) == expected

def test_b():
    data = create_data()  # 不依赖 test_a
    assert process(data) == expected
```

### 4. 使用 Fixtures

```python
# ✅ 使用 fixture 复用代码
@pytest.fixture
def sample_data():
    return create_data()

def test_a(sample_data):
    assert process(sample_data) == expected
```

### 5. 清晰的断言

```python
# ✅ 清晰的断言
assert len(result) == 10
assert result['close'].mean() > 100

# ❌ 模糊的断言
assert result
```

### 6. 测试边界条件

```python
def test_edge_cases():
    """测试边界条件"""
    # 空数据
    assert process([]) == []

    # 单个元素
    assert process([1]) == [1]

    # 大量数据
    assert len(process(range(10000))) == 10000
```

### 7. 使用 Mock 隔离外部依赖

```python
# ✅ Mock 外部 API
@patch('module.external_api')
def test_with_mock(mock_api):
    mock_api.return_value = {'data': []}
    result = function_that_calls_api()
    assert result is not None
```

---

## CI/CD 集成

### GitHub Actions 示例

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          pip install -r python/quant/requirements.txt
      - name: Run tests
        run: |
          pytest --cov=python/quant --cov-report=xml
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

---

## 故障排查

### 常见问题

**1. 导入错误**
```bash
# 确保项目根目录在 PYTHONPATH
export PYTHONPATH=/Users/mac/Documents/ai/investment-claude:$PYTHONPATH
pytest
```

**2. Fixture 未找到**
```bash
# 确保 conftest.py 在正确位置
tests/conftest.py
```

**3. 覆盖率不准确**
```bash
# 清除缓存
pytest --cache-clear
rm -rf .pytest_cache htmlcov .coverage
```

---

## 下一步

- [ ] 编写 `test_technical.py` (技术指标测试)
- [ ] 编写 `test_ml_pipeline.py` (ML 流水线测试)
- [ ] 编写集成测试
- [ ] 达到 80% 覆盖率目标
- [ ] 配置 CI/CD 自动测试

---

## 参考资料

- [pytest 官方文档](https://docs.pytest.org/)
- [pytest-cov 文档](https://pytest-cov.readthedocs.io/)
- [测试最佳实践](https://docs.python-guide.org/writing/tests/)

---

**维护者**: test-engineer
**最后更新**: 2026-04-14
