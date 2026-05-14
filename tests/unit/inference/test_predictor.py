"""SignalPredictor 单元测试"""

import pickle
from pathlib import Path
from unittest.mock import MagicMock, mock_open, patch

import numpy as np
import pandas as pd
import pytest
from quant.exceptions import (
    DataValidationError,
    ModelLoadError,
    ModelNotFoundError,
    ModelPredictionError,
)
from quant.inference.predictor import SignalPredictor


class TestSignalPredictorInit:
    """测试 SignalPredictor 初始化"""

    def test_init_default_path(self):
        """测试默认模型路径"""
        predictor = SignalPredictor()
        assert predictor.model_path.name == "signal_model.pkl"
        assert "models" in str(predictor.model_path)
        assert predictor.model is None

    def test_init_custom_string_path(self):
        """测试自定义字符串路径"""
        custom_path = "/tmp/custom_model.pkl"
        predictor = SignalPredictor(model_path=custom_path)
        assert str(predictor.model_path) == custom_path

    def test_init_custom_path_object(self):
        """测试自定义 Path 对象"""
        custom_path = Path("/tmp/custom_model.pkl")
        predictor = SignalPredictor(model_path=custom_path)
        assert predictor.model_path == custom_path

    def test_init_invalid_path_type(self):
        """测试无效路径类型"""
        with pytest.raises(DataValidationError) as exc_info:
            SignalPredictor(model_path=123)
        assert "must be a string or Path object" in str(exc_info.value)


class TestSignalPredictorLoad:
    """测试 SignalPredictor.load()"""

    def test_load_model_not_found(self, tmp_path):
        """测试模型文件不存在"""
        model_path = tmp_path / "nonexistent.pkl"
        predictor = SignalPredictor(model_path=str(model_path))

        with pytest.raises(ModelNotFoundError) as exc_info:
            predictor.load()
        assert "does not exist" in str(exc_info.value)
        assert "Run training first" in str(exc_info.value)

    def test_load_success(self, tmp_path):
        """测试成功加载模型"""
        # 创建真实的 sklearn 模型
        from sklearn.ensemble import RandomForestClassifier

        model = RandomForestClassifier(n_estimators=5, random_state=42)
        X_train = np.array([[1, 2], [3, 4], [5, 6], [7, 8]])
        y_train = np.array([0, 1, 0, 1])
        model.fit(X_train, y_train)

        model_path = tmp_path / "test_model.pkl"

        # 保存模型
        with open(model_path, "wb") as f:
            pickle.dump(model, f)

        # 加载模型
        predictor = SignalPredictor(model_path=str(model_path))
        predictor.load()

        assert predictor.model is not None

    def test_load_corrupted_file(self, tmp_path):
        """测试加载损坏的模型文件"""
        model_path = tmp_path / "corrupted.pkl"

        # 创建损坏的文件
        with open(model_path, "w") as f:
            f.write("not a pickle file")

        predictor = SignalPredictor(model_path=str(model_path))

        with pytest.raises(ModelLoadError) as exc_info:
            predictor.load()
        assert "Failed to load model file" in str(exc_info.value)


class TestSignalPredictorPredict:
    """测试 SignalPredictor.predict()"""

    @pytest.fixture
    def mock_predictor(self, tmp_path):
        """创建带有真实模型的预测器"""
        from sklearn.ensemble import RandomForestClassifier

        model = RandomForestClassifier(n_estimators=5, random_state=42)
        X_train = np.array([[1, 2], [3, 4], [5, 6], [7, 8]])
        y_train = np.array([0, 1, 0, 1])
        model.fit(X_train, y_train)

        model_path = tmp_path / "test_model.pkl"
        with open(model_path, "wb") as f:
            pickle.dump(model, f)

        predictor = SignalPredictor(model_path=str(model_path))
        predictor.load()
        return predictor

    def test_predict_invalid_input_type(self, mock_predictor):
        """测试无效输入类型"""
        with pytest.raises(DataValidationError) as exc_info:
            mock_predictor.predict([1, 2, 3])
        assert "must be a pandas DataFrame" in str(exc_info.value)

    def test_predict_empty_dataframe(self, mock_predictor):
        """测试空 DataFrame"""
        empty_df = pd.DataFrame()
        with pytest.raises(DataValidationError) as exc_info:
            mock_predictor.predict(empty_df)
        assert "empty" in str(exc_info.value).lower()

    def test_predict_success(self, mock_predictor):
        """测试成功预测"""
        X = pd.DataFrame({"feature1": [1.0, 2.0], "feature2": [3.0, 4.0]})

        result = mock_predictor.predict(X)

        assert isinstance(result, np.ndarray)
        assert len(result) == 2
        # 验证概率值在 [0, 1] 范围内
        assert all(0 <= p <= 1 for p in result)

    def test_predict_auto_load(self, tmp_path):
        """测试自动加载模型"""
        from sklearn.ensemble import RandomForestClassifier

        model = RandomForestClassifier(n_estimators=5, random_state=42)
        X_train = np.array([[1, 2], [3, 4], [5, 6], [7, 8]])
        y_train = np.array([0, 1, 0, 1])
        model.fit(X_train, y_train)

        model_path = tmp_path / "test_model.pkl"
        with open(model_path, "wb") as f:
            pickle.dump(model, f)

        # 创建预测器但不手动加载
        predictor = SignalPredictor(model_path=str(model_path))
        assert predictor.model is None

        # 预测时应自动加载
        X = pd.DataFrame([[1.0, 2.0]], columns=["f1", "f2"])
        result = predictor.predict(X)

        assert predictor.model is not None
        assert len(result) == 1

    def test_predict_model_error(self, tmp_path):
        """测试模型预测失败"""
        from sklearn.ensemble import RandomForestClassifier

        # 创建一个训练好的模型
        model = RandomForestClassifier(n_estimators=5, random_state=42)
        X_train = np.array([[1, 2], [3, 4], [5, 6], [7, 8]])
        y_train = np.array([0, 1, 0, 1])
        model.fit(X_train, y_train)

        model_path = tmp_path / "test_model.pkl"
        with open(model_path, "wb") as f:
            pickle.dump(model, f)

        predictor = SignalPredictor(model_path=str(model_path))
        predictor.load()

        # 使用错误的特征数量（模型期望2个特征，但只提供1个）
        X = pd.DataFrame({"feature1": [1.0]})

        with pytest.raises(ModelPredictionError) as exc_info:
            predictor.predict(X)
        assert "Prediction failed" in str(exc_info.value)


class TestSignalPredictorIntegration:
    """集成测试"""

    def test_full_workflow(self, tmp_path):
        """测试完整工作流程"""
        # 创建真实的 sklearn 模型
        from sklearn.ensemble import RandomForestClassifier

        model = RandomForestClassifier(n_estimators=10, random_state=42)
        X_train = np.array([[1, 2], [3, 4], [5, 6], [7, 8]])
        y_train = np.array([0, 1, 0, 1])
        model.fit(X_train, y_train)

        # 保存模型
        model_path = tmp_path / "rf_model.pkl"
        with open(model_path, "wb") as f:
            pickle.dump(model, f)

        # 使用预测器
        predictor = SignalPredictor(model_path=str(model_path))
        X_test = pd.DataFrame([[2, 3], [6, 7]], columns=["f1", "f2"])

        result = predictor.predict(X_test)

        assert isinstance(result, np.ndarray)
        assert len(result) == 2
        assert all(0 <= p <= 1 for p in result)
