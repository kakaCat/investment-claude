"""pytest 全局配置和 fixtures"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# 添加项目根目录到 sys.path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "python"))


# ============================================================================
# 测试数据 Fixtures
# ============================================================================


@pytest.fixture
def sample_stock_data():
    """生成示例股票数据"""
    dates = pd.date_range(start="2024-01-01", periods=100, freq="D")

    # 生成模拟价格数据
    np.random.seed(42)
    base_price = 100.0
    returns = np.random.normal(0.001, 0.02, len(dates))
    close_prices = base_price * np.exp(np.cumsum(returns))

    data = {
        "date": dates,
        "open": close_prices * (1 + np.random.uniform(-0.01, 0.01, len(dates))),
        "high": close_prices * (1 + np.random.uniform(0.01, 0.03, len(dates))),
        "low": close_prices * (1 - np.random.uniform(0.01, 0.03, len(dates))),
        "close": close_prices,
        "volume": np.random.randint(1000000, 10000000, len(dates)),
        "amount": close_prices * np.random.randint(1000000, 10000000, len(dates)),
        "turnover_rate": np.random.uniform(0.5, 5.0, len(dates)),
    }

    df = pd.DataFrame(data)

    # 确保价格逻辑正确
    df["high"] = df[["open", "high", "close"]].max(axis=1)
    df["low"] = df[["open", "low", "close"]].min(axis=1)

    return df


@pytest.fixture
def invalid_stock_data():
    """生成包含异常值的股票数据"""
    dates = pd.date_range(start="2024-01-01", periods=10, freq="D")

    data = {
        "date": dates,
        "open": [100, 101, 0, 103, -5, 105, 106, np.nan, 108, 109],  # 包含0、负数、NaN
        "high": [102, 103, 104, 105, 106, 107, 108, 109, 110, 111],
        "low": [98, 99, 100, 101, 102, 103, 104, 105, 106, 107],
        "close": [101, 102, 103, 104, 105, 106, 107, 108, 109, 110],
        "volume": [
            1000000,
            1100000,
            1200000,
            -100000,
            1400000,
            1500000,
            1600000,
            1700000,
            1800000,
            1900000,
        ],  # 包含负数
    }

    return pd.DataFrame(data)


@pytest.fixture
def empty_dataframe():
    """空 DataFrame"""
    return pd.DataFrame()


@pytest.fixture
def sample_symbols():
    """示例股票代码列表"""
    return ["600519", "000858", "600036", "601318", "000001"]


# ============================================================================
# Mock Fixtures
# ============================================================================


@pytest.fixture
def mock_akshare_response(sample_stock_data):
    """模拟 akshare_bridge 的返回数据"""
    return {
        "data": sample_stock_data.to_dict("records"),
        "symbol": "600519",
        "count": len(sample_stock_data),
    }


@pytest.fixture
def mock_akshare_error():
    """模拟 akshare_bridge 错误响应"""
    return {"error": "Network error: Connection timeout"}


# ============================================================================
# 测试环境配置
# ============================================================================


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """设置测试环境（会话级别，自动执行）"""
    print("\n" + "=" * 70)
    print("🧪 测试环境初始化")
    print("=" * 70)

    # 设置测试环境变量
    import os

    os.environ["TESTING"] = "true"

    yield

    print("\n" + "=" * 70)
    print("✅ 测试环境清理完成")
    print("=" * 70)


@pytest.fixture(autouse=True)
def reset_random_seed():
    """每个测试前重置随机种子（确保测试可重复）"""
    np.random.seed(42)
    yield


# ============================================================================
# 测试标记和钩子
# ============================================================================


def pytest_configure(config):
    """pytest 配置钩子"""
    config.addinivalue_line("markers", "unit: 单元测试")
    config.addinivalue_line("markers", "integration: 集成测试")
    config.addinivalue_line("markers", "e2e: 端到端测试")
    config.addinivalue_line("markers", "performance: 性能测试")


def pytest_collection_modifyitems(config, items):
    """修改测试收集项"""
    for item in items:
        # 根据路径自动添加标记
        if "unit" in str(item.fspath):
            item.add_marker(pytest.mark.unit)
        elif "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
        elif "e2e" in str(item.fspath):
            item.add_marker(pytest.mark.e2e)
        elif "performance" in str(item.fspath):
            item.add_marker(pytest.mark.performance)
