"""信号预测器"""

import pickle
from pathlib import Path

import pandas as pd
from quant.exceptions import (
    DataValidationError,
    ModelLoadError,
    ModelNotFoundError,
    ModelPredictionError,
)


class SignalPredictor:
    def __init__(self, model_path: str = None):
        """
        初始化预测器

        Args:
            model_path: 模型文件路径（可选）

        Raises:
            DataValidationError: 路径格式不正确
        """
        if model_path is None:
            # 默认使用当前项目的模型路径
            model_path = Path(__file__).resolve().parent.parent / "models" / "signal_model.pkl"

        # 验证路径
        if isinstance(model_path, str):
            self.model_path = Path(model_path)
        elif isinstance(model_path, Path):
            self.model_path = model_path
        else:
            raise DataValidationError(
                "model_path must be a string or Path object",
                model_path_type=type(model_path).__name__,
            )

        self.model = None

    def load(self):
        """
        加载模型

        Raises:
            ModelNotFoundError: 模型文件不存在
            ModelLoadError: 模型加载失败
        """
        if not self.model_path.exists():
            raise ModelNotFoundError(
                "Model file does not exist",
                model_path=str(self.model_path),
                suggestion="Run training first: python ml_pipeline.py train",
            )

        try:
            with open(self.model_path, "rb") as f:
                self.model = pickle.load(f)
        except Exception as e:
            raise ModelLoadError(
                "Failed to load model file",
                model_path=str(self.model_path),
                error=str(e),
                error_type=type(e).__name__,
            ) from e

    def predict(self, X: pd.DataFrame):
        """
        预测信号

        Args:
            X: 特征数据

        Returns:
            预测概率数组

        Raises:
            DataValidationError: 输入数据验证失败
            ModelNotFoundError: 模型未加载
            ModelPredictionError: 预测失败
        """
        # 输入验证
        if not isinstance(X, pd.DataFrame):
            raise DataValidationError(
                "Input must be a pandas DataFrame", input_type=type(X).__name__
            )

        if X.empty:
            raise DataValidationError("Input DataFrame is empty", rows=0)

        # 加载模型（如果未加载）
        if self.model is None:
            self.load()

        # 预测
        try:
            proba = self.model.predict_proba(X)
            return proba[:, 1]
        except Exception as e:
            raise ModelPredictionError(
                "Prediction failed",
                error=str(e),
                error_type=type(e).__name__,
                input_shape=X.shape,
                input_columns=list(X.columns),
            ) from e
