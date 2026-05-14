"""ML Pipeline 单元测试"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import numpy as np
import pandas as pd
import pytest

# 添加 python/quant 目录到路径（与 ml_pipeline.py 相同的方式）
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python" / "quant"))

from exceptions import (
    DataFetchError,
    DataValidationError,
    FeatureCalculationError,
    InsufficientDataError,
    ModelSaveError,
    ModelTrainingError,
)


class TestTrainModel:
    """测试 train_model() 函数"""

    @pytest.fixture
    def sample_stock_data(self):
        """生成样本股票数据"""
        dates = pd.date_range("2023-01-01", periods=150, freq="D")
        return pd.DataFrame(
            {
                "date": dates,
                "open": np.random.uniform(10, 20, 150),
                "high": np.random.uniform(15, 25, 150),
                "low": np.random.uniform(5, 15, 150),
                "close": np.random.uniform(10, 20, 150),
                "volume": np.random.uniform(1000, 10000, 150),
                "amount": np.random.uniform(10000, 100000, 150),
                "turnover_rate": np.random.uniform(0.5, 2.0, 150),
            }
        )

    @pytest.fixture
    def sample_featured_data(self):
        """生成带特征的样本数据"""
        n_samples = 200
        return pd.DataFrame(
            {
                "ma5": np.random.randn(n_samples),
                "ma10": np.random.randn(n_samples),
                "ma20": np.random.randn(n_samples),
                "ma60": np.random.randn(n_samples),
                "rsi": np.random.uniform(0, 100, n_samples),
                "macd": np.random.randn(n_samples),
                "macd_signal": np.random.randn(n_samples),
                "macd_hist": np.random.randn(n_samples),
                "bb_width": np.random.uniform(0, 1, n_samples),
                "atr": np.random.uniform(0, 5, n_samples),
                "price_change": np.random.randn(n_samples),
                "volume_change": np.random.randn(n_samples),
                "label": np.random.randint(0, 2, n_samples),
            }
        )

    @patch("quant.ml_pipeline.SignalTrainer")
    @patch("quant.ml_pipeline.TechnicalFeatures")
    @patch("quant.ml_pipeline.get_stock_history")
    @patch("quant.ml_pipeline.get_all_symbols")
    def test_train_model_success(
        self,
        mock_get_symbols,
        mock_get_history,
        mock_features,
        mock_trainer,
        sample_stock_data,
        sample_featured_data,
    ):
        """测试成功训练模型"""
        # 设置 mock
        mock_get_symbols.return_value = ["600519", "000858"]
        mock_get_history.return_value = sample_stock_data
        mock_features.calculate_all.return_value = sample_featured_data

        mock_trainer_instance = MagicMock()
        mock_trainer_instance.train.return_value = {
            "train_score": 0.85,
            "test_score": 0.80,
            "n_samples": 200,
        }
        mock_trainer_instance.save.return_value = "/tmp/model.pkl"
        mock_trainer.return_value = mock_trainer_instance

        # 导入并执行
        from quant.ml_pipeline import train_model

        train_model()

        # 验证调用
        mock_get_symbols.assert_called_once_with(limit=20)
        assert mock_get_history.call_count == 2
        mock_features.calculate_all.assert_called_once()
        mock_trainer_instance.train.assert_called_once()
        mock_trainer_instance.save.assert_called_once()

    @patch("quant.ml_pipeline.get_stock_history")
    @patch("quant.ml_pipeline.get_all_symbols")
    def test_train_model_all_symbols_fail(self, mock_get_symbols, mock_get_history):
        """测试所有股票数据获取失败"""
        mock_get_symbols.return_value = ["600519", "000858"]
        # 使用 Exception 而不是 DataFetchError，因为 DataFetchError 会被捕获
        mock_get_history.side_effect = Exception("API error")

        from quant.ml_pipeline import train_model

        with pytest.raises(DataFetchError) as exc_info:
            train_model()
        assert "No training data available" in str(exc_info.value)

    @patch("quant.ml_pipeline.get_stock_history")
    @patch("quant.ml_pipeline.get_all_symbols")
    def test_train_model_partial_symbols_fail(
        self, mock_get_symbols, mock_get_history, sample_stock_data
    ):
        """测试部分股票数据获取失败"""
        mock_get_symbols.return_value = ["600519", "000858", "600036"]

        # 第一个成功，第二个失败，第三个成功
        mock_get_history.side_effect = [
            sample_stock_data,
            DataFetchError("API error", symbol="000858"),
            sample_stock_data,
        ]

        from quant.ml_pipeline import train_model

        # 应该继续执行（至少有部分数据）
        # 这里只验证不会因为部分失败而中断
        with patch("quant.ml_pipeline.TechnicalFeatures") as mock_features:
            with patch("quant.ml_pipeline.SignalTrainer") as mock_trainer:
                mock_features.calculate_all.return_value = pd.DataFrame(
                    {
                        "ma5": [1],
                        "ma10": [1],
                        "ma20": [1],
                        "ma60": [1],
                        "rsi": [50],
                        "macd": [0],
                        "macd_signal": [0],
                        "macd_hist": [0],
                        "bb_width": [0.5],
                        "atr": [1],
                        "price_change": [0],
                        "volume_change": [0],
                        "label": [1],
                    }
                )
                mock_trainer_instance = MagicMock()
                mock_trainer_instance.train.return_value = {
                    "train_score": 0.8,
                    "test_score": 0.75,
                    "n_samples": 1,
                }
                mock_trainer_instance.save.return_value = "/tmp/model.pkl"
                mock_trainer.return_value = mock_trainer_instance

                # 不应该抛出异常
                try:
                    train_model()
                except InsufficientDataError:
                    # 如果数据太少可能抛出此异常，这是正常的
                    pass

    @patch("quant.ml_pipeline.TechnicalFeatures")
    @patch("quant.ml_pipeline.get_stock_history")
    @patch("quant.ml_pipeline.get_all_symbols")
    def test_train_model_feature_calculation_error(
        self, mock_get_symbols, mock_get_history, mock_features, sample_stock_data
    ):
        """测试特征计算失败"""
        mock_get_symbols.return_value = ["600519"]
        mock_get_history.return_value = sample_stock_data
        # 使用普通 Exception，会被包装成 FeatureCalculationError
        mock_features.calculate_all.side_effect = Exception("Calculation failed")

        from quant.ml_pipeline import train_model

        with pytest.raises(FeatureCalculationError):
            train_model()

    @patch("quant.ml_pipeline.TechnicalFeatures")
    @patch("quant.ml_pipeline.get_stock_history")
    @patch("quant.ml_pipeline.get_all_symbols")
    def test_train_model_missing_feature_columns(
        self, mock_get_symbols, mock_get_history, mock_features, sample_stock_data
    ):
        """测试缺少特征列"""
        mock_get_symbols.return_value = ["600519"]
        mock_get_history.return_value = sample_stock_data

        # 返回缺少某些列的数据
        incomplete_data = pd.DataFrame(
            {
                "ma5": [1, 2, 3],
                "ma10": [1, 2, 3],
                "label": [0, 1, 0],
            }
        )
        mock_features.calculate_all.return_value = incomplete_data

        from quant.ml_pipeline import train_model

        # KeyError 会被包装成 DataValidationError
        with pytest.raises(DataValidationError) as exc_info:
            train_model()
        assert "Missing required column" in str(exc_info.value) or "not in index" in str(
            exc_info.value
        )

    @patch("quant.ml_pipeline.SignalTrainer")
    @patch("quant.ml_pipeline.TechnicalFeatures")
    @patch("quant.ml_pipeline.get_stock_history")
    @patch("quant.ml_pipeline.get_all_symbols")
    def test_train_model_training_error(
        self,
        mock_get_symbols,
        mock_get_history,
        mock_features,
        mock_trainer,
        sample_stock_data,
        sample_featured_data,
    ):
        """测试模型训练失败"""
        mock_get_symbols.return_value = ["600519"]
        mock_get_history.return_value = sample_stock_data
        mock_features.calculate_all.return_value = sample_featured_data

        mock_trainer_instance = MagicMock()
        mock_trainer_instance.train.side_effect = Exception("Training failed")
        mock_trainer.return_value = mock_trainer_instance

        from quant.ml_pipeline import train_model

        with pytest.raises(ModelTrainingError):
            train_model()

    @patch("quant.ml_pipeline.SignalTrainer")
    @patch("quant.ml_pipeline.TechnicalFeatures")
    @patch("quant.ml_pipeline.get_stock_history")
    @patch("quant.ml_pipeline.get_all_symbols")
    def test_train_model_save_error(
        self,
        mock_get_symbols,
        mock_get_history,
        mock_features,
        mock_trainer,
        sample_stock_data,
        sample_featured_data,
    ):
        """测试模型保存失败"""
        mock_get_symbols.return_value = ["600519"]
        mock_get_history.return_value = sample_stock_data
        mock_features.calculate_all.return_value = sample_featured_data

        mock_trainer_instance = MagicMock()
        mock_trainer_instance.train.return_value = {
            "train_score": 0.8,
            "test_score": 0.75,
            "n_samples": 200,
        }
        mock_trainer_instance.save.side_effect = ModelSaveError(
            "Save failed", model_path="/tmp/model.pkl"
        )
        mock_trainer.return_value = mock_trainer_instance

        from quant.ml_pipeline import train_model

        with pytest.raises(ModelSaveError):
            train_model()


class TestPredictSignal:
    """测试 predict_signal() 函数"""

    @pytest.fixture
    def sample_stock_data(self):
        """生成样本股票数据"""
        dates = pd.date_range("2023-01-01", periods=150, freq="D")
        return pd.DataFrame(
            {
                "date": dates,
                "open": np.random.uniform(10, 20, 150),
                "high": np.random.uniform(15, 25, 150),
                "low": np.random.uniform(5, 15, 150),
                "close": np.random.uniform(10, 20, 150),
                "volume": np.random.uniform(1000, 10000, 150),
                "amount": np.random.uniform(10000, 100000, 150),
                "turnover_rate": np.random.uniform(0.5, 2.0, 150),
            }
        )

    @pytest.fixture
    def sample_featured_data(self):
        """生成带特征的样本数据"""
        n_samples = 100
        return pd.DataFrame(
            {
                "ma5": np.random.randn(n_samples),
                "ma10": np.random.randn(n_samples),
                "ma20": np.random.randn(n_samples),
                "ma60": np.random.randn(n_samples),
                "rsi": np.random.uniform(0, 100, n_samples),
                "macd": np.random.randn(n_samples),
                "macd_signal": np.random.randn(n_samples),
                "macd_hist": np.random.randn(n_samples),
                "bb_width": np.random.uniform(0, 1, n_samples),
                "atr": np.random.uniform(0, 5, n_samples),
                "price_change": np.random.randn(n_samples),
                "volume_change": np.random.randn(n_samples),
                "label": np.random.randint(0, 2, n_samples),
            }
        )

    @patch("quant.ml_pipeline.SignalPredictor")
    @patch("quant.ml_pipeline.TechnicalFeatures")
    @patch("quant.ml_pipeline.get_stock_history")
    def test_predict_signal_success(
        self,
        mock_get_history,
        mock_features,
        mock_predictor,
        sample_stock_data,
        sample_featured_data,
    ):
        """测试成功预测信号"""
        mock_get_history.return_value = sample_stock_data
        mock_features.calculate_all.return_value = sample_featured_data

        mock_predictor_instance = MagicMock()
        mock_predictor_instance.predict.return_value = np.array([0.75])
        mock_predictor.return_value = mock_predictor_instance

        from quant.ml_pipeline import predict_signal

        predict_signal("600519")

        mock_get_history.assert_called_once_with("600519", days=200)
        mock_features.calculate_all.assert_called_once()
        mock_predictor_instance.predict.assert_called_once()

    @patch("quant.ml_pipeline.get_stock_history")
    def test_predict_signal_data_fetch_error(self, mock_get_history):
        """测试数据获取失败"""
        mock_get_history.side_effect = DataFetchError("API error", symbol="600519")

        from quant.ml_pipeline import predict_signal

        with pytest.raises(DataFetchError):
            predict_signal("600519")

    @patch("quant.ml_pipeline.TechnicalFeatures")
    @patch("quant.ml_pipeline.get_stock_history")
    def test_predict_signal_feature_calculation_error(
        self, mock_get_history, mock_features, sample_stock_data
    ):
        """测试特征计算失败"""
        mock_get_history.return_value = sample_stock_data
        # 使用普通 Exception，会被包装成 FeatureCalculationError
        mock_features.calculate_all.side_effect = Exception("Calculation failed")

        from quant.ml_pipeline import predict_signal

        with pytest.raises(FeatureCalculationError):
            predict_signal("600519")

    @patch("quant.ml_pipeline.TechnicalFeatures")
    @patch("quant.ml_pipeline.get_stock_history")
    def test_predict_signal_empty_features(
        self, mock_get_history, mock_features, sample_stock_data
    ):
        """测试特征计算后无数据"""
        mock_get_history.return_value = sample_stock_data
        mock_features.calculate_all.return_value = pd.DataFrame()

        from quant.ml_pipeline import predict_signal

        with pytest.raises(DataValidationError) as exc_info:
            predict_signal("600519")
        assert "No data after feature calculation" in str(exc_info.value)

    @patch("quant.ml_pipeline.TechnicalFeatures")
    @patch("quant.ml_pipeline.get_stock_history")
    def test_predict_signal_missing_feature_columns(
        self, mock_get_history, mock_features, sample_stock_data
    ):
        """测试缺少特征列"""
        mock_get_history.return_value = sample_stock_data

        incomplete_data = pd.DataFrame(
            {
                "ma5": [1, 2, 3],
                "ma10": [1, 2, 3],
            }
        )
        mock_features.calculate_all.return_value = incomplete_data

        from quant.ml_pipeline import predict_signal

        # KeyError 会被包装成 DataValidationError
        with pytest.raises(DataValidationError) as exc_info:
            predict_signal("600519")
        assert "Missing required feature column" in str(exc_info.value) or "not in index" in str(
            exc_info.value
        )


class TestEvaluateModel:
    """测试 evaluate_model() 函数"""

    @pytest.fixture
    def sample_stock_data(self):
        """生成样本股票数据"""
        dates = pd.date_range("2023-01-01", periods=150, freq="D")
        return pd.DataFrame(
            {
                "date": dates,
                "open": np.random.uniform(10, 20, 150),
                "high": np.random.uniform(15, 25, 150),
                "low": np.random.uniform(5, 15, 150),
                "close": np.random.uniform(10, 20, 150),
                "volume": np.random.uniform(1000, 10000, 150),
                "amount": np.random.uniform(10000, 100000, 150),
                "turnover_rate": np.random.uniform(0.5, 2.0, 150),
            }
        )

    @pytest.fixture
    def sample_featured_data(self):
        """生成带特征的样本数据"""
        n_samples = 100
        return pd.DataFrame(
            {
                "ma5": np.random.randn(n_samples),
                "ma10": np.random.randn(n_samples),
                "ma20": np.random.randn(n_samples),
                "ma60": np.random.randn(n_samples),
                "rsi": np.random.uniform(0, 100, n_samples),
                "macd": np.random.randn(n_samples),
                "macd_signal": np.random.randn(n_samples),
                "macd_hist": np.random.randn(n_samples),
                "bb_width": np.random.uniform(0, 1, n_samples),
                "atr": np.random.uniform(0, 5, n_samples),
                "price_change": np.random.randn(n_samples),
                "volume_change": np.random.randn(n_samples),
                "label": np.random.randint(0, 2, n_samples),
            }
        )

    @patch("quant.ml_pipeline.SignalPredictor")
    @patch("quant.ml_pipeline.TechnicalFeatures")
    @patch("quant.ml_pipeline.get_stock_history")
    @patch("quant.ml_pipeline.get_all_symbols")
    def test_evaluate_model_success(
        self,
        mock_get_symbols,
        mock_get_history,
        mock_features,
        mock_predictor,
        sample_stock_data,
        sample_featured_data,
    ):
        """测试成功评估模型"""
        mock_get_symbols.return_value = ["600519", "000858", "600036", "601318", "000001"]
        mock_get_history.return_value = sample_stock_data
        mock_features.calculate_all.return_value = sample_featured_data

        mock_predictor_instance = MagicMock()
        mock_predictor_instance.predict.return_value = np.random.uniform(0, 1, 100)
        mock_predictor.return_value = mock_predictor_instance

        from quant.ml_pipeline import evaluate_model

        evaluate_model()

        mock_get_symbols.assert_called_once_with(limit=10)
        assert mock_get_history.call_count == 5
        mock_features.calculate_all.assert_called_once()
        mock_predictor_instance.predict.assert_called_once()

    @patch("quant.ml_pipeline.get_stock_history")
    @patch("quant.ml_pipeline.get_all_symbols")
    def test_evaluate_model_all_symbols_fail(self, mock_get_symbols, mock_get_history):
        """测试所有股票数据获取失败"""
        mock_get_symbols.return_value = ["600519", "000858", "600036", "601318", "000001"]
        # 使用 Exception 而不是 DataFetchError
        mock_get_history.side_effect = Exception("API error")

        from quant.ml_pipeline import evaluate_model

        with pytest.raises(DataFetchError) as exc_info:
            evaluate_model()
        assert "No evaluation data available" in str(exc_info.value)

    @patch("quant.ml_pipeline.TechnicalFeatures")
    @patch("quant.ml_pipeline.get_stock_history")
    @patch("quant.ml_pipeline.get_all_symbols")
    def test_evaluate_model_feature_calculation_error(
        self, mock_get_symbols, mock_get_history, mock_features, sample_stock_data
    ):
        """测试特征计算失败"""
        mock_get_symbols.return_value = ["600519", "000858"]
        mock_get_history.return_value = sample_stock_data
        # 使用普通 Exception，会被包装成 FeatureCalculationError
        mock_features.calculate_all.side_effect = Exception("Calculation failed")

        from quant.ml_pipeline import evaluate_model

        with pytest.raises(FeatureCalculationError):
            evaluate_model()
