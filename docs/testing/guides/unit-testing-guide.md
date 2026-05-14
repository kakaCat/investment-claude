# 单元测试指南

> 如何编写高质量的单元测试

**版本**: v1.0
**更新日期**: 2026-04-14

---

## 📋 目录

1. [什么是单元测试](#什么是单元测试)
2. [编写第一个测试](#编写第一个测试)
3. [使用 Fixtures](#使用-fixtures)
4. [使用 Mock](#使用-mock)
5. [参数化测试](#参数化测试)
6. [测试异常](#测试异常)
7. [最佳实践](#最佳实践)

---

## 什么是单元测试

单元测试是测试**单个函数或类**的功能，确保其在各种输入下都能正确工作。

### 特点

- **快速**: 每个测试 < 100ms
- **独立**: 不依赖其他测试或外部系统
- **可重复**: 任何时候运行结果一致
- **聚焦**: 只测试一个功能点

### 单元测试 vs 集成测试

| 特性 | 单元测试 | 集成测试 |
|------|---------|---------|
| 测试范围 | 单个函数/类 | 多个模块协同 |
| 外部依赖 | Mock 掉 | 使用真实依赖 |
| 执行速度 | 快（< 100ms） | 慢（< 1s） |
| 数量 | 多（80%） | 少（15%） |

---

## 编写第一个测试

### 1. 创建测试文件

测试文件命名规则：`test_<module_name>.py`

```bash
# 被测试的模块
python/quant/data_adapter.py

# 对应的测试文件
tests/unit/backend/test_data_adapter.py
```

### 2. 编写简单测试

```python
# tests/unit/backend/test_data_adapter.py
import pytest
import pandas as pd
from quant.data_adapter import get_stock_history

def test_get_stock_history_returns_dataframe():
    """测试 get_stock_history 返回 DataFrame"""
    # Arrange - 准备
    symbol = "600519"
    days = 100

    # Act - 执行
    result = get_stock_history(symbol, days)

    # Assert - 验证
    assert isinstance(result, pd.DataFrame)
    assert not result.empty
    assert len(result) > 0
```

### 3. 运行测试

```bash
# 运行单个测试文件
pytest tests/unit/backend/test_data_adapter.py -v

# 运行单个测试函数
pytest tests/unit/backend/test_data_adapter.py::test_get_stock_history_returns_dataframe -v
```

---

## 使用 Fixtures

Fixtures 是 pytest 提供的测试数据准备机制，用于复用测试数据。

### 内置 Fixtures

项目在 `tests/conftest.py` 中定义了常用 fixtures：

```python
def test_with_sample_data(sample_stock_data):
    """使用预定义的样本数据"""
    assert len(sample_stock_data) == 100
    assert 'close' in sample_stock_data.columns
```

**可用 Fixtures**:
- `sample_stock_data` - 100 天的正常股票数据
- `invalid_stock_data` - 包含异常值的数据
- `empty_dataframe` - 空 DataFrame
- `sample_symbols` - 股票代码列表
- `mock_akshare_response` - 模拟 API 响应
- `mock_akshare_error` - 模拟错误响应

### 自定义 Fixtures

```python
import pytest
import pandas as pd

@pytest.fixture
def sample_prices():
    """创建样本价格数据"""
    return pd.Series([100, 102, 101, 103, 105])

def test_calculate_returns(sample_prices):
    """使用自定义 fixture"""
    returns = sample_prices.pct_change()
    assert len(returns) == len(sample_prices)
```

### Fixture 作用域

```python
@pytest.fixture(scope="function")  # 默认，每个测试函数运行一次
def function_fixture():
    return create_data()

@pytest.fixture(scope="class")  # 每个测试类运行一次
def class_fixture():
    return create_expensive_data()

@pytest.fixture(scope="module")  # 每个模块运行一次
def module_fixture():
    return load_model()

@pytest.fixture(scope="session")  # 整个测试会话运行一次
def session_fixture():
    return connect_to_database()
```

### Fixture 清理

```python
@pytest.fixture
def temp_file():
    """创建临时文件，测试后自动清理"""
    # Setup
    file_path = "/tmp/test_data.csv"
    create_file(file_path)

    yield file_path  # 提供给测试使用

    # Teardown - 测试后执行
    if os.path.exists(file_path):
        os.remove(file_path)

def test_with_temp_file(temp_file):
    """测试会自动清理临时文件"""
    assert os.path.exists(temp_file)
    process_file(temp_file)
```

---

## 使用 Mock

Mock 用于隔离外部依赖，让测试更快、更稳定。

### 为什么需要 Mock？

```python
# ❌ 不好的测试 - 依赖真实 API
def test_get_stock_history():
    result = get_stock_history("600519", days=100)
    # 问题：
    # 1. 依赖网络连接
    # 2. API 可能限流
    # 3. 数据可能变化
    # 4. 测试很慢
    assert not result.empty

# ✅ 好的测试 - 使用 Mock
@patch('quant.data_adapter.akshare_bridge')
def test_get_stock_history(mock_bridge):
    mock_bridge.get_stock_history.return_value = {
        'data': [{'date': '2024-01-01', 'close': 100}]
    }

    result = get_stock_history("600519", days=100)

    # 优点：
    # 1. 不依赖网络
    # 2. 快速执行
    # 3. 结果可预测
    # 4. 可以测试边界情况
    assert not result.empty
```

### 基本 Mock 用法

```python
from unittest.mock import patch, MagicMock

# 1. Mock 函数返回值
@patch('module.function')
def test_with_mock(mock_func):
    mock_func.return_value = 42
    result = call_function_that_uses_function()
    assert result == 42

# 2. Mock 类
@patch('module.MyClass')
def test_with_mock_class(MockClass):
    mock_instance = MockClass.return_value
    mock_instance.method.return_value = "mocked"

    result = use_my_class()
    assert result == "mocked"

# 3. Mock 多个对象
@patch('module.function2')
@patch('module.function1')
def test_multiple_mocks(mock_func1, mock_func2):
    # 注意：装饰器顺序与参数顺序相反
    mock_func1.return_value = 1
    mock_func2.return_value = 2
```

### Mock 实战示例

```python
from unittest.mock import patch, MagicMock
import pytest

class TestGetStockHistory:
    """测试 get_stock_history 函数"""

    @patch('quant.data_adapter.akshare_bridge')
    def test_successful_fetch(self, mock_bridge, mock_akshare_response):
        """测试成功获取数据"""
        # Arrange
        mock_bridge.get_stock_history.return_value = mock_akshare_response

        # Act
        result = get_stock_history("600519", days=100)

        # Assert
        assert not result.empty
        assert len(result) == 100
        mock_bridge.get_stock_history.assert_called_once_with("600519", count=100)

    @patch('quant.data_adapter.akshare_bridge')
    def test_api_error(self, mock_bridge):
        """测试 API 错误"""
        # Arrange
        mock_bridge.get_stock_history.return_value = {'error': 'API Error'}

        # Act & Assert
        with pytest.raises(DataFetchError, match="API returned error"):
            get_stock_history("600519", days=100)

    @patch('quant.data_adapter.akshare_bridge')
    def test_retry_on_network_error(self, mock_bridge):
        """测试网络错误重试"""
        # Arrange - 前两次失败，第三次成功
        mock_bridge.get_stock_history.side_effect = [
            ConnectionError("Network error"),
            ConnectionError("Network error"),
            {'data': [{'date': '2024-01-01', 'close': 100}]}
        ]

        # Act
        result = get_stock_history("600519", days=100, retry=3)

        # Assert
        assert not result.empty
        assert mock_bridge.get_stock_history.call_count == 3
```

### Mock 断言

```python
# 验证 mock 被调用
mock_func.assert_called()
mock_func.assert_called_once()
mock_func.assert_called_with(arg1, arg2)
mock_func.assert_called_once_with(arg1, arg2)

# 验证调用次数
assert mock_func.call_count == 3

# 验证未被调用
mock_func.assert_not_called()

# 获取调用参数
args, kwargs = mock_func.call_args
```

---

## 参数化测试

参数化测试用于用不同参数测试同一个函数。

### 基本用法

```python
@pytest.mark.parametrize("symbol,days", [
    ("600519", 100),
    ("000858", 200),
    ("600036", 300),
])
def test_get_stock_history_multiple_symbols(symbol, days):
    """测试多个股票代码"""
    result = get_stock_history(symbol, days)
    assert not result.empty
    assert len(result) <= days
```

### 多参数组合

```python
@pytest.mark.parametrize("symbol", ["600519", "000858"])
@pytest.mark.parametrize("days", [100, 200, 300])
def test_combinations(symbol, days):
    """测试所有组合（2 * 3 = 6 个测试）"""
    result = get_stock_history(symbol, days)
    assert not result.empty
```

### 参数化异常测试

```python
@pytest.mark.parametrize("invalid_symbol,error_msg", [
    ("", "Symbol cannot be empty"),
    ("12345", "Symbol must be 6 digits"),
    ("abcdef", "Symbol must be numeric"),
    ("1234567", "Symbol must be 6 digits"),
])
def test_invalid_symbols(invalid_symbol, error_msg):
    """测试无效股票代码"""
    with pytest.raises(InvalidSymbolError, match=error_msg):
        get_stock_history(invalid_symbol, days=100)
```

### 使用 pytest.param 添加标记

```python
@pytest.mark.parametrize("symbol,days", [
    ("600519", 100),
    ("000858", 200),
    pytest.param("600036", 1000, marks=pytest.mark.slow),  # 标记为慢速测试
])
def test_with_marks(symbol, days):
    result = get_stock_history(symbol, days)
    assert not result.empty
```

---

## 测试异常

### 基本异常测试

```python
def test_raises_exception():
    """测试函数抛出异常"""
    with pytest.raises(ValueError):
        validate_symbol("")
```

### 验证异常消息

```python
def test_exception_message():
    """测试异常消息"""
    with pytest.raises(ValueError, match="Symbol cannot be empty"):
        validate_symbol("")
```

### 捕获异常对象

```python
def test_exception_details():
    """测试异常详细信息"""
    with pytest.raises(DataFetchError) as exc_info:
        get_stock_history("invalid", days=100)

    # 验证异常属性
    assert exc_info.value.symbol == "invalid"
    assert exc_info.value.days == 100
```

### 测试不抛出异常

```python
def test_does_not_raise():
    """测试函数不抛出异常"""
    try:
        result = get_stock_history("600519", days=100)
        assert not result.empty
    except Exception as e:
        pytest.fail(f"Unexpected exception: {e}")
```

---

## 最佳实践

### 1. 测试命名

```python
# ✅ 好的命名 - 描述测试内容
def test_validate_dataframe_removes_rows_with_nan_values():
    pass

def test_calculate_rsi_returns_values_between_0_and_100():
    pass

def test_get_stock_history_raises_error_for_invalid_symbol():
    pass

# ❌ 不好的命名
def test1():
    pass

def test_function():
    pass
```

### 2. 一个测试一个断言（原则上）

```python
# ✅ 好的测试 - 聚焦单一行为
def test_dataframe_has_required_columns():
    result = get_stock_history("600519", days=100)
    assert 'close' in result.columns

def test_dataframe_not_empty():
    result = get_stock_history("600519", days=100)
    assert not result.empty

# ⚠️ 可接受 - 相关的多个断言
def test_dataframe_structure():
    result = get_stock_history("600519", days=100)
    assert isinstance(result, pd.DataFrame)
    assert not result.empty
    assert 'close' in result.columns
```

### 3. 使用描述性的断言消息

```python
# ✅ 好的断言
assert len(result) > 0, f"Expected non-empty result, got {len(result)} rows"
assert result['close'].mean() > 0, "Average close price should be positive"

# ❌ 不好的断言
assert len(result) > 0
assert result['close'].mean() > 0
```

### 4. 测试边界条件

```python
def test_edge_cases():
    """测试边界条件"""
    # 最小值
    result = get_stock_history("600519", days=1)
    assert len(result) >= 1

    # 最大值
    result = get_stock_history("600519", days=1000)
    assert len(result) <= 1000

    # 空输入
    with pytest.raises(ValueError):
        get_stock_history("", days=100)
```

### 5. 避免测试实现细节

```python
# ❌ 不好 - 测试实现细节
def test_implementation():
    result = calculate_ma(data, period=5)
    # 不应该测试内部如何计算
    assert result.iloc[4] == (data.iloc[0:5].sum() / 5)

# ✅ 好 - 测试行为
def test_behavior():
    result = calculate_ma(data, period=5)
    # 测试结果的属性
    assert len(result) == len(data)
    assert result.iloc[-1] > 0
    assert not result.isnull().any()
```

### 6. 保持测试独立

```python
# ❌ 不好 - 测试相互依赖
class TestBad:
    def test_step1(self):
        self.data = create_data()  # 共享状态

    def test_step2(self):
        process(self.data)  # 依赖 test_step1

# ✅ 好 - 测试独立
class TestGood:
    def test_step1(self):
        data = create_data()
        assert data is not None

    def test_step2(self):
        data = create_data()  # 独立创建
        result = process(data)
        assert result is not None
```

### 7. 使用测试类组织相关测试

```python
class TestValidateDataframe:
    """测试数据验证函数"""

    def test_valid_data(self, sample_stock_data):
        result = validate_dataframe(sample_stock_data, "600519")
        assert not result.empty

    def test_removes_nan_values(self, invalid_stock_data):
        result = validate_dataframe(invalid_stock_data, "600519")
        assert not result.isnull().any()

    def test_removes_negative_prices(self):
        data = create_data_with_negative_prices()
        result = validate_dataframe(data, "600519")
        assert all(result['close'] > 0)
```

---

## 常见模式

### 测试数据转换

```python
def test_data_transformation():
    """测试数据转换"""
    # Given
    input_data = create_input_data()

    # When
    output_data = transform(input_data)

    # Then
    assert len(output_data) == len(input_data)
    assert output_data.columns.tolist() == expected_columns
    assert output_data['new_column'].dtype == 'float64'
```

### 测试计算逻辑

```python
def test_calculation():
    """测试计算逻辑"""
    # Given
    prices = pd.Series([100, 102, 101, 103, 105])

    # When
    returns = calculate_returns(prices)

    # Then
    assert len(returns) == len(prices)
    assert returns.iloc[0] == 0  # 第一个值为 0
    assert abs(returns.iloc[1] - 0.02) < 0.001  # 2% 涨幅
```

### 测试状态变化

```python
def test_state_change():
    """测试状态变化"""
    # Given
    trainer = SignalTrainer()
    assert trainer.model is None

    # When
    trainer.train(data)

    # Then
    assert trainer.model is not None
    assert trainer.is_trained
```

---

## 运行测试

```bash
# 运行所有单元测试
pytest tests/unit/ -v

# 运行特定模块
pytest tests/unit/backend/test_data_adapter.py -v

# 运行特定测试类
pytest tests/unit/backend/test_data_adapter.py::TestValidateDataframe -v

# 运行特定测试函数
pytest tests/unit/backend/test_data_adapter.py::test_get_stock_history -v

# 使用标记运行
pytest -m unit -v

# 显示覆盖率
pytest tests/unit/ --cov=python/quant --cov-report=term-missing
```

---

## 参考资料

- [pytest 文档](https://docs.pytest.org/)
- [pytest fixtures](https://docs.pytest.org/en/stable/fixture.html)
- [unittest.mock 文档](https://docs.python.org/3/library/unittest.mock.html)

---

**维护者**: test-engineer
**最后更新**: 2026-04-14
