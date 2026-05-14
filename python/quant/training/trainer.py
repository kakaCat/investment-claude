"""模型训练器"""

import pickle
from pathlib import Path

import pandas as pd
import xgboost as xgb
from quant.exceptions import (
    DataValidationError,
    InsufficientDataError,
    ModelLoadError,
    ModelNotFoundError,
    ModelSaveError,
)
from sklearn.model_selection import train_test_split


class SignalTrainer:
    def __init__(self, model_dir: str = None):
        """
        初始化训练器

        Args:
            model_dir: 模型保存目录（可选）
        """
        if model_dir is None:
            model_dir = Path(__file__).resolve().parent.parent / "models"
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(exist_ok=True)
        self.model = None

    def train(self, X: pd.DataFrame, y: pd.Series):
        """
        训练模型

        Args:
            X: 特征数据
            y: 标签数据

        Returns:
            训练指标字典

        Raises:
            DataValidationError: 输入数据验证失败
            InsufficientDataError: 训练数据不足
        """
        # 输入验证
        if not isinstance(X, pd.DataFrame):
            raise DataValidationError("X must be a pandas DataFrame", input_type=type(X).__name__)

        if not isinstance(y, (pd.Series, pd.DataFrame)):
            raise DataValidationError(
                "y must be a pandas Series or DataFrame", input_type=type(y).__name__
            )

        if X.empty:
            raise DataValidationError("Feature DataFrame is empty", rows=0)

        if len(y) == 0:
            raise DataValidationError("Label array is empty", length=0)

        if len(X) != len(y):
            raise DataValidationError(
                "X and y must have the same length", X_length=len(X), y_length=len(y)
            )

        # 检查训练数据量
        min_samples = 100
        if len(X) < min_samples:
            raise InsufficientDataError(
                "Not enough training samples", required=min_samples, actual=len(X)
            )

        # 训练模型
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        # 计算类别权重
        scale_pos_weight = (y_train == 0).sum() / (y_train == 1).sum()

        self.model = xgb.XGBClassifier(
            max_depth=5,
            learning_rate=0.1,
            n_estimators=100,
            scale_pos_weight=scale_pos_weight,
            random_state=42,
        )
        self.model.fit(X_train, y_train)
        return {
            "train_score": self.model.score(X_train, y_train),
            "test_score": self.model.score(X_test, y_test),
            "n_samples": len(X),
        }

    def save(self, name: str = "signal_model.pkl"):
        """
        保存模型

        Args:
            name: 模型文件名

        Returns:
            模型文件路径

        Raises:
            DataValidationError: 模型未训练
            ModelSaveError: 模型保存失败
        """
        if self.model is None:
            raise DataValidationError("No model to save. Train a model first.", model=None)

        path = self.model_dir / name

        try:
            with open(path, "wb") as f:
                pickle.dump(self.model, f)
            return str(path)
        except Exception as e:
            raise ModelSaveError(
                "Failed to save model",
                model_path=str(path),
                error=str(e),
                error_type=type(e).__name__,
            ) from e

    def load(self, name: str = "signal_model.pkl"):
        """
        加载模型

        Args:
            name: 模型文件名

        Raises:
            ModelNotFoundError: 模型文件不存在
            ModelLoadError: 模型加载失败
        """
        path = self.model_dir / name

        if not path.exists():
            raise ModelNotFoundError(
                "Model file does not exist", model_path=str(path), suggestion="Train a model first"
            )

        try:
            with open(path, "rb") as f:
                self.model = pickle.load(f)
        except Exception as e:
            raise ModelLoadError(
                "Failed to load model",
                model_path=str(path),
                error=str(e),
                error_type=type(e).__name__,
            ) from e
