"""测试 features/technical 模块"""

import numpy as np
import pandas as pd
import pytest
from quant.features.technical import (
    INDICATOR_COLUMNS,
    REQUIRED_COLUMNS,
    TechnicalFeatures,
    calculate_indicators,
    clean_data,
    generate_labels,
)

# ============================================================================
# 测试 clean_data 函数
# ============================================================================


class TestCleanData:
    """测试数据清洗函数"""

    def test_clean_valid_data(self, sample_stock_data):
        """测试清洗正常数据"""
        result = clean_data(sample_stock_data)

        assert not result.empty
        assert len(result) == len(sample_stock_data)
        assert all(col in result.columns for col in REQUIRED_COLUMNS)
        assert "amount" in result.columns
        assert "turnover_rate" in result.columns

    def test_clean_empty_dataframe(self, empty_dataframe):
        """测试空 DataFrame"""
        from quant.exceptions import DataValidationError

        with pytest.raises(DataValidationError):
            clean_data(empty_dataframe)

    def test_clean_insufficient_data(self):
        """测试数据量不足（少于60行）"""
        from quant.exceptions import InsufficientDataError

        df = pd.DataFrame(
            {
                "date": pd.date_range("2024-01-01", periods=50),
                "open": [100] * 50,
                "high": [102] * 50,
                "low": [98] * 50,
                "close": [101] * 50,
                "volume": [1000000] * 50,
            }
        )

        with pytest.raises(InsufficientDataError):
            clean_data(df)

    def test_clean_missing_columns(self):
        """测试缺少必需列"""
        from quant.exceptions import DataValidationError

        df = pd.DataFrame(
            {
                "date": pd.date_range("2024-01-01", periods=100),
                "close": [100] * 100,
                # 缺少 open, high, low, volume
            }
        )

        with pytest.raises(DataValidationError):
            clean_data(df)

    def test_clean_invalid_input_type(self):
        """测试无效的输入类型"""
        from quant.exceptions import DataValidationError

        with pytest.raises(DataValidationError):
            clean_data("not a dataframe")

    def test_clean_adds_missing_columns(self, sample_stock_data):
        """测试自动添加缺失的列"""
        # 删除 amount 和 turnover_rate
        df = sample_stock_data[["date", "open", "high", "low", "close", "volume"]].copy()

        result = clean_data(df)

        assert "amount" in result.columns
        assert "turnover_rate" in result.columns
        assert all(result["turnover_rate"] == 0.0)

    def test_clean_sorts_by_date(self, sample_stock_data):
        """测试按日期排序"""
        # 打乱日期顺序
        shuffled = sample_stock_data.sample(frac=1).reset_index(drop=True)

        result = clean_data(shuffled)

        assert result["date"].is_monotonic_increasing

    def test_clean_removes_duplicates(self):
        """测试删除重复日期"""
        dates = pd.date_range("2024-01-01", periods=100)
        df = pd.DataFrame(
            {
                "date": list(dates) + [dates[0]],  # 添加一个重复日期
                "open": [100] * 101,
                "high": [102] * 101,
                "low": [98] * 101,
                "close": [101] * 101,
                "volume": [1000000] * 101,
            }
        )

        result = clean_data(df)

        assert len(result) == 100  # 删除了重复
        assert result["date"].is_unique

    def test_clean_handles_nan_values(self):
        """测试处理 NaN 值"""
        df = pd.DataFrame(
            {
                "date": pd.date_range("2024-01-01", periods=100),
                "open": [100] * 50 + [np.nan] * 50,
                "high": [102] * 100,
                "low": [98] * 100,
                "close": [101] * 100,
                "volume": [1000000] * 100,
            }
        )

        result = clean_data(df)

        # NaN 应该被插值填充
        assert not result["open"].isna().any()

    def test_clean_price_logic(self, sample_stock_data):
        """测试价格逻辑修正（high >= low）"""
        result = clean_data(sample_stock_data)

        assert all(result["high"] >= result["low"])
        assert all(result["high"] >= result["close"])
        assert all(result["low"] <= result["close"])


# ============================================================================
# 测试 calculate_indicators 函数
# ============================================================================


class TestCalculateIndicators:
    """测试技术指标计算函数"""

    def test_calculate_all_indicators(self, sample_stock_data):
        """测试计算所有指标"""
        cleaned = clean_data(sample_stock_data)
        result = calculate_indicators(cleaned)

        # 验证所有指标列都存在
        expected_indicators = [
            "ma5",
            "ma10",
            "ma20",
            "ma60",
            "rsi",
            "macd",
            "macd_signal",
            "macd_hist",
            "bb_middle",
            "bb_std",
            "bb_upper",
            "bb_lower",
            "bb_width",
            "tr",
            "atr",
            "price_change",
            "volume_change",
        ]

        for indicator in expected_indicators:
            assert indicator in result.columns

    def test_calculate_ma_indicators(self, sample_stock_data):
        """测试移动平均线计算"""
        cleaned = clean_data(sample_stock_data)
        result = calculate_indicators(cleaned)

        # MA5 应该是最近5天的平均值
        assert "ma5" in result.columns
        assert "ma10" in result.columns
        assert "ma20" in result.columns
        assert "ma60" in result.columns

        # 验证 MA5 计算正确（第5行开始有值）
        assert pd.isna(result["ma5"].iloc[0:4]).all()
        assert not pd.isna(result["ma5"].iloc[4])

    def test_calculate_rsi(self, sample_stock_data):
        """测试 RSI 计算"""
        cleaned = clean_data(sample_stock_data)
        result = calculate_indicators(cleaned)

        assert "rsi" in result.columns
        # RSI 应该在 0-100 之间
        valid_rsi = result["rsi"].dropna()
        assert all((valid_rsi >= 0) & (valid_rsi <= 100))

    def test_calculate_macd(self, sample_stock_data):
        """测试 MACD 计算"""
        cleaned = clean_data(sample_stock_data)
        result = calculate_indicators(cleaned)

        assert "macd" in result.columns
        assert "macd_signal" in result.columns
        assert "macd_hist" in result.columns

        # MACD histogram = MACD - Signal
        valid_rows = ~result["macd_hist"].isna()
        np.testing.assert_array_almost_equal(
            result.loc[valid_rows, "macd_hist"],
            result.loc[valid_rows, "macd"] - result.loc[valid_rows, "macd_signal"],
            decimal=10,
        )

    def test_calculate_bollinger_bands(self, sample_stock_data):
        """测试布林带计算"""
        cleaned = clean_data(sample_stock_data)
        result = calculate_indicators(cleaned)

        assert "bb_middle" in result.columns
        assert "bb_upper" in result.columns
        assert "bb_lower" in result.columns
        assert "bb_width" in result.columns

        # 上轨应该 >= 中轨 >= 下轨
        valid_rows = ~result["bb_middle"].isna()
        assert all(result.loc[valid_rows, "bb_upper"] >= result.loc[valid_rows, "bb_middle"])
        assert all(result.loc[valid_rows, "bb_middle"] >= result.loc[valid_rows, "bb_lower"])

    def test_calculate_atr(self, sample_stock_data):
        """测试 ATR 计算"""
        cleaned = clean_data(sample_stock_data)
        result = calculate_indicators(cleaned)

        assert "tr" in result.columns
        assert "atr" in result.columns

        # ATR 应该是正数
        valid_atr = result["atr"].dropna()
        assert all(valid_atr >= 0)

    def test_calculate_price_change(self, sample_stock_data):
        """测试价格变化率计算"""
        cleaned = clean_data(sample_stock_data)
        result = calculate_indicators(cleaned)

        assert "price_change" in result.columns
        assert "volume_change" in result.columns

        # 第一行应该是 NaN
        assert pd.isna(result["price_change"].iloc[0])

    def test_calculate_handles_errors(self):
        """测试计算错误处理"""
        from quant.exceptions import FeatureCalculationError

        # 创建会导致计算错误的数据
        df = pd.DataFrame(
            {
                "date": pd.date_range("2024-01-01", periods=100),
                "close": ["invalid"] * 100,  # 无效数据
            }
        )

        with pytest.raises(FeatureCalculationError):
            calculate_indicators(df)


# ============================================================================
# 测试 generate_labels 函数
# ============================================================================


class TestGenerateLabels:
    """测试标签生成函数"""

    def test_generate_labels_default(self, sample_stock_data):
        """测试默认参数生成标签"""
        cleaned = clean_data(sample_stock_data)
        featured = calculate_indicators(cleaned)
        result = generate_labels(featured)

        assert "label" in result.columns
        assert result["label"].dtype == int
        assert all(result["label"].isin([0, 1]))

    def test_generate_labels_custom_params(self, sample_stock_data):
        """测试自定义参数"""
        cleaned = clean_data(sample_stock_data)
        featured = calculate_indicators(cleaned)
        result = generate_labels(featured, lookahead_days=3, threshold=0.01)

        assert "label" in result.columns
        # 数据量应该减少 lookahead_days 行
        assert len(result) == len(featured) - 3

    def test_generate_labels_empty_dataframe(self, empty_dataframe):
        """测试空 DataFrame"""
        from quant.exceptions import DataValidationError

        with pytest.raises(DataValidationError):
            generate_labels(empty_dataframe)

    def test_generate_labels_invalid_lookahead(self, sample_stock_data):
        """测试无效的 lookahead_days"""
        from quant.exceptions import DataValidationError

        cleaned = clean_data(sample_stock_data)
        featured = calculate_indicators(cleaned)

        with pytest.raises(DataValidationError):
            generate_labels(featured, lookahead_days=0)

        with pytest.raises(DataValidationError):
            generate_labels(featured, lookahead_days=-5)

    def test_generate_labels_invalid_threshold(self, sample_stock_data):
        """测试无效的 threshold"""
        from quant.exceptions import DataValidationError

        cleaned = clean_data(sample_stock_data)
        featured = calculate_indicators(cleaned)

        with pytest.raises(DataValidationError):
            generate_labels(featured, threshold=0)

        with pytest.raises(DataValidationError):
            generate_labels(featured, threshold=-0.01)

    def test_generate_labels_logic(self):
        """测试标签生成逻辑"""
        # 创建简单的测试数据
        df = pd.DataFrame(
            {
                "date": pd.date_range("2024-01-01", periods=100),
                "close": [100, 102, 104, 106, 108] * 20,  # 持续上涨
            }
        )

        result = generate_labels(df, lookahead_days=1, threshold=0.01)

        # 大部分应该是标签1（上涨）
        assert result["label"].sum() > len(result) * 0.5


# ============================================================================
# 测试 TechnicalFeatures 类
# ============================================================================


class TestTechnicalFeatures:
    """测试 TechnicalFeatures 类"""

    def test_calculate_all_success(self, sample_stock_data):
        """测试完整流程"""
        result = TechnicalFeatures.calculate_all(sample_stock_data)

        assert not result.empty
        # 验证所有必需列都存在
        for col in REQUIRED_COLUMNS:
            assert col in result.columns

        # 验证技术指标列都存在
        expected_indicators = ["ma5", "ma10", "ma20", "ma60", "rsi", "macd"]
        for indicator in expected_indicators:
            assert indicator in result.columns

        # 验证标签列存在
        assert "label" in result.columns

        # 验证没有 NaN 值
        assert not result.isna().any().any()

    def test_calculate_all_insufficient_data(self):
        """测试数据量不足"""
        from quant.exceptions import InsufficientDataError

        df = pd.DataFrame(
            {
                "date": pd.date_range("2024-01-01", periods=50),
                "open": [100] * 50,
                "high": [102] * 50,
                "low": [98] * 50,
                "close": [101] * 50,
                "volume": [1000000] * 50,
            }
        )

        with pytest.raises(InsufficientDataError):
            TechnicalFeatures.calculate_all(df)

    def test_calculate_all_invalid_data(self, empty_dataframe):
        """测试无效数据"""
        from quant.exceptions import DataValidationError

        with pytest.raises(DataValidationError):
            TechnicalFeatures.calculate_all(empty_dataframe)

    def test_calculate_all_removes_nan(self):
        """测试删除 NaN 值"""
        # 创建包含一些 NaN 的数据
        df = pd.DataFrame(
            {
                "date": pd.date_range("2024-01-01", periods=100),
                "open": [100] * 100,
                "high": [102] * 100,
                "low": [98] * 100,
                "close": [101] * 100,
                "volume": [1000000] * 100,
            }
        )

        result = TechnicalFeatures.calculate_all(df)

        # 结果不应该有 NaN
        assert not result.isna().any().any()

    def test_calculate_all_minimum_valid_data(self):
        """测试最小有效数据量"""
        # 创建刚好足够的数据（60行）
        df = pd.DataFrame(
            {
                "date": pd.date_range("2024-01-01", periods=100),
                "open": np.random.uniform(90, 110, 100),
                "high": np.random.uniform(100, 120, 100),
                "low": np.random.uniform(80, 100, 100),
                "close": np.random.uniform(95, 105, 100),
                "volume": np.random.randint(1000000, 10000000, 100),
            }
        )

        result = TechnicalFeatures.calculate_all(df)

        assert not result.empty
        assert len(result) > 0


# ============================================================================
# 集成测试
# ============================================================================


@pytest.mark.integration
class TestTechnicalFeaturesIntegration:
    """技术特征集成测试"""

    def test_full_pipeline(self, sample_stock_data):
        """测试完整流程"""
        # 1. 清洗数据
        cleaned = clean_data(sample_stock_data)
        assert not cleaned.empty

        # 2. 计算指标
        featured = calculate_indicators(cleaned)
        assert "ma5" in featured.columns
        assert "rsi" in featured.columns

        # 3. 生成标签
        labeled = generate_labels(featured)
        assert "label" in labeled.columns

        # 4. 使用 TechnicalFeatures 一次性完成
        result = TechnicalFeatures.calculate_all(sample_stock_data)
        assert not result.empty
        assert "label" in result.columns

    def test_real_world_scenario(self):
        """测试真实场景"""
        # 模拟真实股票数据
        np.random.seed(42)
        dates = pd.date_range("2023-01-01", periods=200, freq="D")

        # 生成模拟价格数据（随机游走）
        returns = np.random.normal(0.001, 0.02, len(dates))
        close_prices = 100 * np.exp(np.cumsum(returns))

        df = pd.DataFrame(
            {
                "date": dates,
                "open": close_prices * (1 + np.random.uniform(-0.01, 0.01, len(dates))),
                "high": close_prices * (1 + np.random.uniform(0.01, 0.03, len(dates))),
                "low": close_prices * (1 - np.random.uniform(0.01, 0.03, len(dates))),
                "close": close_prices,
                "volume": np.random.randint(1000000, 10000000, len(dates)),
            }
        )

        # 确保价格逻辑正确
        df["high"] = df[["open", "high", "close"]].max(axis=1)
        df["low"] = df[["open", "low", "close"]].min(axis=1)

        result = TechnicalFeatures.calculate_all(df)

        # 验证结果
        assert not result.empty
        assert len(result) > 100  # 应该有足够的有效数据
        assert all(result["label"].isin([0, 1]))

        # 验证技术指标的合理性
        assert result["rsi"].min() >= 0
        assert result["rsi"].max() <= 100
        assert all(result["bb_upper"] >= result["bb_lower"])
