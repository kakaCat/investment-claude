#!/usr/bin/env python
"""ML Pipeline - 量化分析主入口"""

import argparse
import sys
from pathlib import Path

# 添加当前目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent))

from data_adapter import get_all_symbols, get_stock_history
from exceptions import (
    DataFetchError,
    DataValidationError,
    FeatureCalculationError,
    InsufficientDataError,
    ModelSaveError,
    ModelTrainingError,
    QuantException,
)
from features.technical import TechnicalFeatures
from inference.predictor import SignalPredictor
from logger import setup_logger
from training.trainer import SignalTrainer

logger = setup_logger(__name__)


def train_model():
    """训练模型"""
    logger.info("Starting model training")
    print("[Train] 开始训练模型...")

    try:
        # 获取训练数据（多只股票）
        symbols = get_all_symbols(limit=20)
        all_data = []
        failed_symbols = []

        for symbol in symbols:
            try:
                logger.info("Fetching training data", extra={"symbol": symbol})
                print(f"[Train] 获取 {symbol} 数据...")
                df = get_stock_history(symbol, days=500)
                all_data.append(df)
                logger.info("Successfully fetched data", extra={"symbol": symbol, "rows": len(df)})
            except (DataFetchError, InsufficientDataError, DataValidationError) as e:
                logger.warning(
                    "Failed to fetch data for symbol",
                    extra={"symbol": symbol, "error": str(e), "error_type": type(e).__name__},
                )
                print(f"[Train] 警告: {symbol} 数据获取失败 - {e}")
                failed_symbols.append(symbol)
                continue
            except Exception as e:
                logger.error(
                    "Unexpected error fetching data",
                    extra={"symbol": symbol, "error": str(e), "error_type": type(e).__name__},
                )
                print(f"[Train] 警告: {symbol} 数据获取失败 - {e}")
                failed_symbols.append(symbol)
                continue

        if failed_symbols:
            logger.warning(
                "Some symbols failed to fetch", extra={"failed_count": len(failed_symbols)}
            )

        if not all_data:
            error_msg = "No training data available after fetching all symbols"
            logger.error(
                error_msg,
                extra={"total_symbols": len(symbols), "failed_symbols": len(failed_symbols)},
            )
            print("[Train] 错误: 没有可用的训练数据")
            raise DataFetchError(
                error_msg, total_symbols=len(symbols), failed_symbols=len(failed_symbols)
            )

        # 合并所有数据
        import pandas as pd

        combined_df = pd.concat(all_data, ignore_index=True)
        logger.info(
            "Combined training data",
            extra={"total_rows": len(combined_df), "symbols_count": len(all_data)},
        )
        print(f"[Train] 总数据量: {len(combined_df)} 条")

        # 计算特征
        logger.info("Calculating technical indicators")
        print("[Train] 计算技术指标...")
        try:
            featured_df = TechnicalFeatures.calculate_all(combined_df)
            logger.info("Successfully calculated features", extra={"rows": len(featured_df)})
        except FeatureCalculationError as e:
            logger.error("Feature calculation failed", extra={"error": str(e)})
            print(f"[Train] 错误: 特征计算失败 - {e}")
            raise
        except Exception as e:
            logger.error(
                "Unexpected error during feature calculation",
                extra={"error": str(e), "error_type": type(e).__name__},
            )
            raise FeatureCalculationError(
                "Unexpected error during feature calculation", error=str(e)
            ) from e

        # 准备训练数据
        feature_columns = [
            "ma5",
            "ma10",
            "ma20",
            "ma60",
            "rsi",
            "macd",
            "macd_signal",
            "macd_hist",
            "bb_width",
            "atr",
            "price_change",
            "volume_change",
        ]

        try:
            X = featured_df[feature_columns]
            y = featured_df["label"]
        except KeyError as e:
            error_msg = f"Missing required column: {e}"
            logger.error(error_msg, extra={"available_columns": list(featured_df.columns)})
            print(f"[Train] 错误: {error_msg}")
            raise DataValidationError(error_msg, available_columns=list(featured_df.columns)) from e

        logger.info(
            "Prepared training data", extra={"features": len(feature_columns), "samples": len(X)}
        )
        print(f"[Train] 特征数量: {len(feature_columns)}, 样本数量: {len(X)}")

        # 训练模型
        logger.info("Training model")
        try:
            trainer = SignalTrainer()
            metrics = trainer.train(X, y)
            logger.info("Model training completed", extra=metrics)
        except (DataValidationError, InsufficientDataError) as e:
            logger.error("Training validation failed", extra={"error": str(e)})
            print(f"[Train] 错误: 训练数据验证失败 - {e}")
            raise
        except Exception as e:
            logger.error(
                "Model training failed", extra={"error": str(e), "error_type": type(e).__name__}
            )
            raise ModelTrainingError(
                "Model training failed", error=str(e), error_type=type(e).__name__
            ) from e

        # 保存模型
        logger.info("Saving model")
        try:
            model_path = trainer.save()
            logger.info("Model saved successfully", extra={"model_path": model_path})
        except ModelSaveError as e:
            logger.error("Failed to save model", extra={"error": str(e)})
            print(f"[Train] 错误: 模型保存失败 - {e}")
            raise

        print(f"[Train] 训练完成!")
        print(f"  - 训练集准确率: {metrics['train_score']:.2%}")
        print(f"  - 测试集准确率: {metrics['test_score']:.2%}")
        print(f"  - 样本数量: {metrics['n_samples']}")
        print(f"  - 模型路径: {model_path}")

    except QuantException:
        # 统一异常已经记录日志，直接抛出
        raise
    except Exception as e:
        logger.error(
            "Unexpected error in train_model",
            extra={"error": str(e), "error_type": type(e).__name__},
        )
        print(f"[Train] 错误: 训练过程中发生未预期错误 - {e}")
        raise


def predict_signal(symbol: str):
    """预测股票信号"""
    logger.info("Starting prediction", extra={"symbol": symbol})
    print(f"[Predict] 预测 {symbol} 信号...")

    try:
        # 获取数据
        logger.info("Fetching stock data for prediction", extra={"symbol": symbol, "days": 200})
        try:
            df = get_stock_history(symbol, days=200)
            logger.info("Successfully fetched data", extra={"symbol": symbol, "rows": len(df)})
        except (DataFetchError, InsufficientDataError, DataValidationError) as e:
            logger.error("Failed to fetch data", extra={"symbol": symbol, "error": str(e)})
            print(f"[Predict] 错误: 数据获取失败 - {e}")
            raise

        # 计算特征
        logger.info("Calculating features for prediction", extra={"symbol": symbol})
        try:
            featured_df = TechnicalFeatures.calculate_all(df)
            logger.info(
                "Successfully calculated features",
                extra={"symbol": symbol, "rows": len(featured_df)},
            )
        except FeatureCalculationError as e:
            logger.error("Feature calculation failed", extra={"symbol": symbol, "error": str(e)})
            print(f"[Predict] 错误: 特征计算失败 - {e}")
            raise
        except Exception as e:
            logger.error(
                "Unexpected error during feature calculation",
                extra={"symbol": symbol, "error": str(e), "error_type": type(e).__name__},
            )
            raise FeatureCalculationError(
                "Unexpected error during feature calculation", error=str(e)
            ) from e

        if len(featured_df) == 0:
            error_msg = "No data after feature calculation"
            logger.error(error_msg, extra={"symbol": symbol})
            print("[Predict] 错误: 特征计算后无数据")
            raise DataValidationError(error_msg, symbol=symbol, rows=0)

        # 准备预测数据（最新一条）
        feature_columns = [
            "ma5",
            "ma10",
            "ma20",
            "ma60",
            "rsi",
            "macd",
            "macd_signal",
            "macd_hist",
            "bb_width",
            "atr",
            "price_change",
            "volume_change",
        ]

        try:
            X = featured_df[feature_columns].tail(1)
        except KeyError as e:
            error_msg = f"Missing required feature column: {e}"
            logger.error(
                error_msg, extra={"symbol": symbol, "available_columns": list(featured_df.columns)}
            )
            print(f"[Predict] 错误: {error_msg}")
            raise DataValidationError(
                error_msg, symbol=symbol, available_columns=list(featured_df.columns)
            ) from e

        # 预测
        logger.info("Loading model and making prediction", extra={"symbol": symbol})
        try:
            predictor = SignalPredictor()
            proba = predictor.predict(X)[0]
            logger.info("Prediction completed", extra={"symbol": symbol, "probability": proba})
        except FileNotFoundError as e:
            logger.error("Model file not found", extra={"symbol": symbol})
            print("[Predict] 错误: 模型文件不存在，请先运行 train 命令训练模型")
            raise
        except Exception as e:
            logger.error(
                "Prediction failed",
                extra={"symbol": symbol, "error": str(e), "error_type": type(e).__name__},
            )
            print(f"[Predict] 错误: 预测失败 - {e}")
            raise

        # 输出结果
        signal = "买入" if proba > 0.6 else "持有"
        print(f"[Predict] 预测结果:")
        print(f"  - 股票代码: {symbol}")
        print(f"  - 上涨概率: {proba:.1%}")
        print(f"  - 信号: {signal}")

    except QuantException:
        # 统一异常已经记录日志，直接抛出
        raise
    except Exception as e:
        logger.error(
            "Unexpected error in predict_signal",
            extra={"symbol": symbol, "error": str(e), "error_type": type(e).__name__},
        )
        print(f"[Predict] 错误: 预测过程中发生未预期错误 - {e}")
        import traceback

        traceback.print_exc()
        raise


def evaluate_model():
    """评估模型性能"""
    logger.info("Starting model evaluation")
    print("[Evaluate] 评估模型性能...")

    try:
        # 获取测试数据
        symbols = get_all_symbols(limit=10)
        all_data = []
        failed_symbols = []

        for symbol in symbols[:5]:  # 只用5只股票测试
            try:
                logger.info("Fetching evaluation data", extra={"symbol": symbol})
                df = get_stock_history(symbol, days=200)
                all_data.append(df)
                logger.info("Successfully fetched data", extra={"symbol": symbol, "rows": len(df)})
            except (DataFetchError, InsufficientDataError, DataValidationError) as e:
                logger.warning(
                    "Failed to fetch data for evaluation",
                    extra={"symbol": symbol, "error": str(e), "error_type": type(e).__name__},
                )
                failed_symbols.append(symbol)
                continue
            except Exception as e:
                logger.error(
                    "Unexpected error fetching evaluation data",
                    extra={"symbol": symbol, "error": str(e), "error_type": type(e).__name__},
                )
                failed_symbols.append(symbol)
                continue

        if not all_data:
            error_msg = "No evaluation data available"
            logger.error(
                error_msg, extra={"total_symbols": 5, "failed_symbols": len(failed_symbols)}
            )
            print("[Evaluate] 错误: 没有可用的测试数据")
            raise DataFetchError(error_msg, total_symbols=5, failed_symbols=len(failed_symbols))

        import pandas as pd

        combined_df = pd.concat(all_data, ignore_index=True)
        logger.info(
            "Combined evaluation data",
            extra={"total_rows": len(combined_df), "symbols_count": len(all_data)},
        )

        # 计算特征
        logger.info("Calculating features for evaluation")
        try:
            featured_df = TechnicalFeatures.calculate_all(combined_df)
            logger.info("Successfully calculated features", extra={"rows": len(featured_df)})
        except FeatureCalculationError as e:
            logger.error("Feature calculation failed", extra={"error": str(e)})
            print(f"[Evaluate] 错误: 特征计算失败 - {e}")
            raise
        except Exception as e:
            logger.error(
                "Unexpected error during feature calculation",
                extra={"error": str(e), "error_type": type(e).__name__},
            )
            raise FeatureCalculationError(
                "Unexpected error during feature calculation", error=str(e)
            ) from e

        feature_columns = [
            "ma5",
            "ma10",
            "ma20",
            "ma60",
            "rsi",
            "macd",
            "macd_signal",
            "macd_hist",
            "bb_width",
            "atr",
            "price_change",
            "volume_change",
        ]

        try:
            X = featured_df[feature_columns]
            y = featured_df["label"]
        except KeyError as e:
            error_msg = f"Missing required column: {e}"
            logger.error(error_msg, extra={"available_columns": list(featured_df.columns)})
            print(f"[Evaluate] 错误: {error_msg}")
            raise DataValidationError(error_msg, available_columns=list(featured_df.columns)) from e

        # 加载模型并预测
        logger.info("Loading model for evaluation")
        try:
            predictor = SignalPredictor()
            y_pred_proba = predictor.predict(X)
            y_pred = (y_pred_proba > 0.5).astype(int)
            logger.info("Prediction completed", extra={"samples": len(X)})
        except FileNotFoundError as e:
            logger.error("Model file not found")
            print("[Evaluate] 错误: 模型文件不存在，请先运行 train 命令训练模型")
            raise
        except Exception as e:
            logger.error(
                "Prediction failed during evaluation",
                extra={"error": str(e), "error_type": type(e).__name__},
            )
            print(f"[Evaluate] 错误: 预测失败 - {e}")
            raise

        # 计算指标
        logger.info("Calculating evaluation metrics")
        try:
            from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

            accuracy = accuracy_score(y, y_pred)
            precision = precision_score(y, y_pred, zero_division=0)
            recall = recall_score(y, y_pred, zero_division=0)
            f1 = f1_score(y, y_pred, zero_division=0)

            metrics = {
                "accuracy": accuracy,
                "precision": precision,
                "recall": recall,
                "f1": f1,
                "samples": len(X),
            }
            logger.info("Evaluation completed", extra=metrics)

            print(f"[Evaluate] 评估结果:")
            print(f"  - 准确率: {accuracy:.2%}")
            print(f"  - 精确率: {precision:.2%}")
            print(f"  - 召回率: {recall:.2%}")
            print(f"  - F1分数: {f1:.2%}")
            print(f"  - 测试样本: {len(X)}")

        except Exception as e:
            logger.error(
                "Failed to calculate metrics",
                extra={"error": str(e), "error_type": type(e).__name__},
            )
            print(f"[Evaluate] 错误: 指标计算失败 - {e}")
            raise

    except QuantException:
        # 统一异常已经记录日志，直接抛出
        raise
    except Exception as e:
        logger.error(
            "Unexpected error in evaluate_model",
            extra={"error": str(e), "error_type": type(e).__name__},
        )
        print(f"[Evaluate] 错误: 评估过程中发生未预期错误 - {e}")
        import traceback

        traceback.print_exc()
        raise


def main():
    parser = argparse.ArgumentParser(description="ML Pipeline for Stock Prediction")
    parser.add_argument(
        "command", choices=["train", "predict", "evaluate"], help="Command to execute"
    )
    parser.add_argument("--symbol", type=str, help="Stock symbol (for predict)")

    args = parser.parse_args()

    if args.command == "train":
        train_model()
    elif args.command == "predict":
        if not args.symbol:
            print("错误: predict 命令需要 --symbol 参数")
            sys.exit(1)
        predict_signal(args.symbol)
    elif args.command == "evaluate":
        evaluate_model()


if __name__ == "__main__":
    main()
