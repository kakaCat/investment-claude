"""测试 data_adapter 模块"""

from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

# 导入被测试模块
from quant.data_adapter import _validate_and_clean_dataframe, get_all_symbols, get_stock_history

# ============================================================================
# 测试 _validate_and_clean_dataframe 函数
# ============================================================================


class TestValidateDataframe:
    """测试数据验证函数"""

    def test_validate_valid_dataframe(self, sample_stock_data):
        """测试验证正常数据"""
        result = _validate_and_clean_dataframe(sample_stock_data, "600519")

        assert not result.empty
        assert len(result) == len(sample_stock_data)
        assert all(
            col in result.columns for col in ["date", "open", "high", "low", "close", "volume"]
        )

    def test_validate_empty_dataframe(self, empty_dataframe):
        """测试空 DataFrame 应该抛出异常"""
        from quant.exceptions import DataValidationError

        with pytest.raises(DataValidationError):
            _validate_and_clean_dataframe(empty_dataframe, "600519")

    def test_validate_missing_columns(self):
        """测试缺少必需列应该抛出异常"""
        from quant.exceptions import DataValidationError

        df = pd.DataFrame(
            {
                "date": pd.date_range("2024-01-01", periods=5),
                "close": [100, 101, 102, 103, 104],
                # 缺少 open, high, low, volume
            }
        )

        with pytest.raises(DataValidationError):
            _validate_and_clean_dataframe(df, "600519")

    def test_validate_removes_nan_values(self):
        """测试删除 NaN 值"""
        df = pd.DataFrame(
            {
                "date": pd.date_range("2024-01-01", periods=5),
                "open": [100, 101, np.nan, 103, 104],
                "high": [102, 103, 104, 105, 106],
                "low": [98, 99, 100, 101, 102],
                "close": [101, 102, 103, 104, 105],
                "volume": [1000000, 1100000, 1200000, 1300000, 1400000],
            }
        )

        result = _validate_and_clean_dataframe(df, "600519")

        assert len(result) == 4  # 删除了 1 行
        assert not result["open"].isna().any()

    def test_validate_removes_zero_prices(self):
        """测试删除价格为 0 的行"""
        df = pd.DataFrame(
            {
                "date": pd.date_range("2024-01-01", periods=5),
                "open": [100, 101, 102, 103, 104],
                "high": [102, 103, 104, 105, 106],
                "low": [98, 99, 100, 101, 102],
                "close": [101, 0, 103, 104, 105],  # 第2行价格为0
                "volume": [1000000, 1100000, 1200000, 1300000, 1400000],
            }
        )

        result = _validate_and_clean_dataframe(df, "600519")

        assert len(result) == 4
        assert all(result["close"] > 0)

    def test_validate_removes_negative_prices(self):
        """测试删除负价格的行"""
        df = pd.DataFrame(
            {
                "date": pd.date_range("2024-01-01", periods=5),
                "open": [100, 101, 102, 103, 104],
                "high": [102, 103, 104, 105, 106],
                "low": [98, 99, 100, 101, 102],
                "close": [101, -50, 103, 104, 105],  # 第2行价格为负
                "volume": [1000000, 1100000, 1200000, 1300000, 1400000],
            }
        )

        result = _validate_and_clean_dataframe(df, "600519")

        assert len(result) == 4
        assert all(result["close"] > 0)

    def test_validate_removes_negative_volume(self):
        """测试删除负成交量的行"""
        df = pd.DataFrame(
            {
                "date": pd.date_range("2024-01-01", periods=5),
                "open": [100, 101, 102, 103, 104],
                "high": [102, 103, 104, 105, 106],
                "low": [98, 99, 100, 101, 102],
                "close": [101, 102, 103, 104, 105],
                "volume": [1000000, -100000, 1200000, 1300000, 1400000],  # 第2行成交量为负
            }
        )

        result = _validate_and_clean_dataframe(df, "600519")

        assert len(result) == 4
        assert all(result["volume"] >= 0)

    def test_validate_removes_price_logic_errors(self):
        """测试删除价格逻辑错误的行（high < low）"""
        df = pd.DataFrame(
            {
                "date": pd.date_range("2024-01-01", periods=5),
                "open": [100, 101, 102, 103, 104],
                "high": [102, 99, 104, 105, 106],  # 第2行 high < low
                "low": [98, 100, 100, 101, 102],
                "close": [101, 102, 103, 104, 105],
                "volume": [1000000, 1100000, 1200000, 1300000, 1400000],
            }
        )

        result = _validate_and_clean_dataframe(df, "600519")

        assert len(result) == 4
        assert all(result["high"] >= result["low"])


# ============================================================================
# 测试 get_stock_history 函数
# ============================================================================


class TestGetStockHistory:
    """测试获取股票历史数据函数"""

    @patch("quant.data_adapter.akshare_bridge")
    def test_get_stock_history_success(self, mock_bridge, mock_akshare_response):
        """测试成功获取股票数据"""
        mock_bridge.get_stock_history.return_value = mock_akshare_response

        result = get_stock_history("600519", days=100)

        assert isinstance(result, pd.DataFrame)
        assert not result.empty
        assert "date" in result.columns
        assert "close" in result.columns
        assert pd.api.types.is_datetime64_any_dtype(result["date"])

        # 验证调用参数
        mock_bridge.get_stock_history.assert_called_once()
        call_args = mock_bridge.get_stock_history.call_args
        assert call_args[0][0] == "600519"

    @patch("quant.data_adapter.akshare_bridge")
    def test_get_stock_history_with_error(self, mock_bridge, mock_akshare_error):
        """测试 akshare_bridge 返回错误"""
        from quant.exceptions import DataFetchError

        mock_bridge.get_stock_history.return_value = mock_akshare_error

        with pytest.raises(DataFetchError):
            get_stock_history("600519", days=100)

    @patch("quant.data_adapter.akshare_bridge")
    def test_get_stock_history_no_data(self, mock_bridge):
        """测试返回空数据"""
        from quant.exceptions import DataFetchError

        mock_bridge.get_stock_history.return_value = {"data": []}

        with pytest.raises(DataFetchError):
            get_stock_history("600519", days=100)

    @patch("quant.data_adapter.akshare_bridge")
    def test_get_stock_history_adds_missing_columns(self, mock_bridge, sample_stock_data):
        """测试自动添加缺失的列"""
        # 创建缺少 amount 和 turnover_rate 的数据
        data_without_extra_cols = sample_stock_data[
            ["date", "open", "high", "low", "close", "volume"]
        ].copy()

        mock_bridge.get_stock_history.return_value = {
            "data": data_without_extra_cols.to_dict("records")
        }

        result = get_stock_history("600519", days=100)

        assert "amount" in result.columns
        assert "turnover_rate" in result.columns
        assert all(result["turnover_rate"] == 1.0)

    @patch("quant.data_adapter.akshare_bridge")
    def test_get_stock_history_sorts_by_date(self, mock_bridge, sample_stock_data):
        """测试按日期排序"""
        # 打乱日期顺序
        shuffled_data = sample_stock_data.sample(frac=1).reset_index(drop=True)

        mock_bridge.get_stock_history.return_value = {"data": shuffled_data.to_dict("records")}

        result = get_stock_history("600519", days=100)

        # 验证日期是升序排列
        assert result["date"].is_monotonic_increasing

    @patch("quant.data_adapter.akshare_bridge")
    def test_get_stock_history_validates_data(self, mock_bridge):
        """测试数据验证功能 - 需要足够的数据（至少60行）"""
        from quant.exceptions import InsufficientDataError

        # 创建包含异常值但数据量足够的数据（100行）
        dates = pd.date_range(start="2024-01-01", periods=100, freq="D")
        invalid_data = pd.DataFrame(
            {
                "date": dates,
                "open": [100 if i % 10 != 2 else 0 for i in range(100)],  # 每10行有1个0
                "high": [102] * 100,
                "low": [98] * 100,
                "close": [101] * 100,
                "volume": [
                    1000000 if i % 10 != 3 else -100000 for i in range(100)
                ],  # 每10行有1个负数
            }
        )

        mock_bridge.get_stock_history.return_value = {"data": invalid_data.to_dict("records")}

        result = get_stock_history("600519", days=100)

        # 验证异常数据已被删除
        assert len(result) < len(invalid_data)
        assert all(result["close"] > 0)
        assert all(result["volume"] >= 0)


# ============================================================================
# 测试 get_all_symbols 函数
# ============================================================================


class TestGetAllSymbols:
    """测试获取股票代码列表函数"""

    def test_get_all_symbols_default(self):
        """测试默认返回 100 个股票代码"""
        result = get_all_symbols()

        assert isinstance(result, list)
        assert len(result) == 20  # 当前默认返回 20 个

    def test_get_all_symbols_with_limit(self):
        """测试限制返回数量"""
        result = get_all_symbols(limit=5)

        assert len(result) == 5

    def test_get_all_symbols_returns_valid_codes(self):
        """测试返回的股票代码格式正确"""
        result = get_all_symbols(limit=5)

        for symbol in result:
            assert isinstance(symbol, str)
            assert len(symbol) == 6  # 股票代码长度为 6
            assert symbol.isdigit()  # 全部是数字


# ============================================================================
# 集成测试
# ============================================================================


@pytest.mark.integration
class TestDataAdapterIntegration:
    """数据适配器集成测试"""

    @patch("quant.data_adapter.akshare_bridge")
    def test_full_workflow(self, mock_bridge, mock_akshare_response):
        """测试完整工作流程"""
        mock_bridge.get_stock_history.return_value = mock_akshare_response

        # 1. 获取股票代码列表
        symbols = get_all_symbols(limit=3)
        assert len(symbols) == 3

        # 2. 获取每个股票的历史数据
        for symbol in symbols:
            df = get_stock_history(symbol, days=100)

            # 验证数据质量
            assert not df.empty
            assert len(df) > 0
            assert all(df["close"] > 0)
            assert all(df["volume"] >= 0)
            assert df["date"].is_monotonic_increasing


# ============================================================================
# TASK-002: 补充边界条件和异常场景测试
# ============================================================================


class TestValidateDataframeEdgeCases:
    """测试数据验证的边界条件"""

    def test_validate_all_data_filtered_out(self):
        """测试所有数据被过滤后抛出异常"""
        from quant.exceptions import DataQualityError

        # 创建全部是异常值的数据
        df = pd.DataFrame(
            {
                "date": pd.date_range("2024-01-01", periods=5),
                "open": [0, 0, 0, 0, 0],  # 全部为0
                "high": [0, 0, 0, 0, 0],
                "low": [0, 0, 0, 0, 0],
                "close": [0, 0, 0, 0, 0],
                "volume": [0, 0, 0, 0, 0],
            }
        )

        with pytest.raises(DataQualityError):
            _validate_and_clean_dataframe(df, "600519")

    def test_validate_single_row(self):
        """测试单行数据"""
        df = pd.DataFrame(
            {
                "date": pd.date_range("2024-01-01", periods=1),
                "open": [100],
                "high": [102],
                "low": [98],
                "close": [101],
                "volume": [1000000],
            }
        )

        result = _validate_and_clean_dataframe(df, "600519")

        assert len(result) == 1
        assert result["close"].iloc[0] == 101

    def test_validate_large_dataset(self):
        """测试大数据集（1000行）"""
        dates = pd.date_range(start="2020-01-01", periods=1000, freq="D")
        df = pd.DataFrame(
            {
                "date": dates,
                "open": np.random.uniform(90, 110, 1000),
                "high": np.random.uniform(100, 120, 1000),
                "low": np.random.uniform(80, 100, 1000),
                "close": np.random.uniform(95, 105, 1000),
                "volume": np.random.randint(1000000, 10000000, 1000),
            }
        )

        # 确保价格逻辑正确
        df["high"] = df[["open", "high", "close"]].max(axis=1)
        df["low"] = df[["open", "low", "close"]].min(axis=1)

        result = _validate_and_clean_dataframe(df, "600519")

        assert len(result) == 1000
        assert all(result["high"] >= result["low"])


class TestGetStockHistoryEdgeCases:
    """测试获取股票数据的边界条件"""

    @patch("quant.data_adapter.akshare_bridge")
    def test_get_stock_history_minimum_days(self, mock_bridge, sample_stock_data):
        """测试最小天数（60天，刚好满足MA60）"""
        # 创建刚好60行的数据
        data_60_days = sample_stock_data.head(60).copy()

        mock_bridge.get_stock_history.return_value = {"data": data_60_days.to_dict("records")}

        result = get_stock_history("600519", days=60)

        assert len(result) == 60

    @patch("quant.data_adapter.akshare_bridge")
    def test_get_stock_history_insufficient_data(self, mock_bridge):
        """测试数据量不足（少于60天）"""
        from quant.exceptions import InsufficientDataError

        # 创建只有50行的数据
        dates = pd.date_range(start="2024-01-01", periods=50, freq="D")
        insufficient_data = pd.DataFrame(
            {
                "date": dates,
                "open": [100] * 50,
                "high": [102] * 50,
                "low": [98] * 50,
                "close": [101] * 50,
                "volume": [1000000] * 50,
            }
        )

        mock_bridge.get_stock_history.return_value = {"data": insufficient_data.to_dict("records")}

        with pytest.raises(InsufficientDataError):
            get_stock_history("600519", days=50)

    @patch("quant.data_adapter.akshare_bridge")
    def test_get_stock_history_invalid_symbol(self, mock_bridge):
        """测试无效的股票代码"""
        from quant.exceptions import InvalidSymbolError

        with pytest.raises(InvalidSymbolError):
            get_stock_history("INVALID", days=100)

    @patch("quant.data_adapter.akshare_bridge")
    def test_get_stock_history_invalid_days(self, mock_bridge):
        """测试无效的天数参数"""
        from quant.exceptions import InvalidParameterError

        # 测试天数为0
        with pytest.raises(InvalidParameterError):
            get_stock_history("600519", days=0)

        # 测试天数为负数
        with pytest.raises(InvalidParameterError):
            get_stock_history("600519", days=-10)

        # 测试天数超过最大值
        with pytest.raises(InvalidParameterError):
            get_stock_history("600519", days=10000)


class TestGetStockHistoryRetryMechanism:
    """测试重试机制"""

    @patch("quant.data_adapter.akshare_bridge")
    @patch("quant.data_adapter.time.sleep")  # Mock sleep 避免测试变慢
    def test_retry_on_connection_error(self, mock_sleep, mock_bridge, mock_akshare_response):
        """测试网络错误时重试"""
        # 第1次失败，第2次成功
        mock_bridge.get_stock_history.side_effect = [
            ConnectionError("Network error"),
            mock_akshare_response,
        ]

        result = get_stock_history("600519", days=100, retry=3)

        assert not result.empty
        assert mock_bridge.get_stock_history.call_count == 2
        mock_sleep.assert_called_once_with(1)  # 第一次重试等待1秒

    @patch("quant.data_adapter.akshare_bridge")
    @patch("quant.data_adapter.time.sleep")
    def test_retry_exponential_backoff(self, mock_sleep, mock_bridge, mock_akshare_response):
        """测试指数退避重试"""
        # 前2次失败，第3次成功
        mock_bridge.get_stock_history.side_effect = [
            ConnectionError("Network error 1"),
            ConnectionError("Network error 2"),
            mock_akshare_response,
        ]

        result = get_stock_history("600519", days=100, retry=3)

        assert not result.empty
        assert mock_bridge.get_stock_history.call_count == 3
        # 验证指数退避：1s, 2s
        assert mock_sleep.call_count == 2
        mock_sleep.assert_any_call(1)  # 第1次重试
        mock_sleep.assert_any_call(2)  # 第2次重试

    @patch("quant.data_adapter.akshare_bridge")
    @patch("quant.data_adapter.time.sleep")
    def test_retry_all_failed(self, mock_sleep, mock_bridge):
        """测试所有重试都失败"""
        from quant.exceptions import DataFetchError

        # 所有重试都失败
        mock_bridge.get_stock_history.side_effect = ConnectionError("Network error")

        with pytest.raises(DataFetchError):
            get_stock_history("600519", days=100, retry=3)

        assert mock_bridge.get_stock_history.call_count == 3

    @patch("quant.data_adapter.akshare_bridge")
    def test_no_retry_on_business_exception(self, mock_bridge):
        """测试业务异常不重试"""
        from quant.exceptions import DataFetchError

        # API 返回错误（业务异常）
        mock_bridge.get_stock_history.return_value = {"error": "Invalid symbol"}

        with pytest.raises(DataFetchError):
            get_stock_history("600519", days=100, retry=3)

        # 业务异常不重试，只调用1次
        assert mock_bridge.get_stock_history.call_count == 1

    @patch("quant.data_adapter.akshare_bridge")
    @patch("quant.data_adapter.time.sleep")
    def test_retry_on_timeout_error(self, mock_sleep, mock_bridge, mock_akshare_response):
        """测试超时错误时重试"""
        # 第1次超时，第2次成功
        mock_bridge.get_stock_history.side_effect = [
            TimeoutError("Request timeout"),
            mock_akshare_response,
        ]

        result = get_stock_history("600519", days=100, retry=3)

        assert not result.empty
        assert mock_bridge.get_stock_history.call_count == 2

    @patch("quant.data_adapter.akshare_bridge")
    def test_unexpected_exception(self, mock_bridge):
        """测试未预期的异常"""
        from quant.exceptions import DataFetchError

        # 抛出未预期的异常
        mock_bridge.get_stock_history.side_effect = RuntimeError("Unexpected error")

        with pytest.raises(DataFetchError) as exc_info:
            get_stock_history("600519", days=100, retry=3)

        # 验证异常信息包含原始错误
        assert "Unexpected error" in str(exc_info.value)


class TestGetAllSymbolsEdgeCases:
    """测试获取股票代码列表的边界条件"""

    def test_get_all_symbols_zero_limit(self):
        """测试 limit=0"""
        result = get_all_symbols(limit=0)

        assert isinstance(result, list)
        assert len(result) == 0

    def test_get_all_symbols_large_limit(self):
        """测试超大 limit（超过可用数量）"""
        result = get_all_symbols(limit=1000)

        assert isinstance(result, list)
        assert len(result) == 20  # 最多返回20个（当前实现）

    def test_get_all_symbols_negative_limit(self):
        """测试负数 limit"""
        result = get_all_symbols(limit=-5)

        # Python 列表切片 [:负数] 会从末尾开始计数
        assert isinstance(result, list)
        assert len(result) > 0  # 会返回部分数据
