"""数据适配器 - 将 akshare_bridge 的输出转换为量化模块需要的格式"""

import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

# 添加父目录到 sys.path 以便导入 akshare_bridge
sys.path.insert(0, str(Path(__file__).parent.parent))

import akshare_bridge
from quant.config import MAX_HISTORY_DAYS
from quant.data_quality import check_data_quality
from quant.exceptions import (
    DataFetchError,
    DataQualityError,
    DataValidationError,
    InsufficientDataError,
    validate_dataframe_columns,
    validate_days,
    validate_symbol,
)
from quant.logger import setup_logger

logger = setup_logger(__name__)


def _validate_and_clean_dataframe(df: pd.DataFrame, symbol: str) -> pd.DataFrame:
    """
    验证和清洗数据

    Args:
        df: 原始数据 DataFrame
        symbol: 股票代码

    Returns:
        清洗后的 DataFrame

    Raises:
        DataValidationError: 数据验证失败
        DataQualityError: 数据质量问题
    """
    if df.empty:
        raise DataValidationError("DataFrame is empty", symbol=symbol, rows=0)

    # 检查必需列
    required_cols = ["date", "open", "high", "low", "close", "volume"]
    validate_dataframe_columns(df, required_cols, symbol)

    # 删除缺失值
    before_len = len(df)
    df = df.dropna(subset=["open", "high", "low", "close", "volume"])
    after_len = len(df)

    if before_len != after_len:
        dropped = before_len - after_len
        logger.warning(
            "Dropped rows with missing values", extra={"symbol": symbol, "dropped_rows": dropped}
        )

    # 检查异常值（价格为0或负数）
    invalid_rows = (df["close"] <= 0) | (df["volume"] < 0)
    if invalid_rows.any():
        invalid_count = invalid_rows.sum()
        logger.warning(
            "Dropped rows with invalid values",
            extra={"symbol": symbol, "invalid_rows": invalid_count},
        )
        df = df[~invalid_rows]

    # 检查价格逻辑（high >= low, close在high和low之间）
    price_logic_error = (
        (df["high"] < df["low"]) | (df["close"] > df["high"]) | (df["close"] < df["low"])
    )
    if price_logic_error.any():
        error_count = price_logic_error.sum()
        logger.warning(
            "Dropped rows with price logic errors",
            extra={"symbol": symbol, "error_rows": error_count},
        )
        df = df[~price_logic_error]

    # 最终检查：清洗后数据是否为空
    if df.empty:
        raise DataQualityError(
            "All data was filtered out during validation",
            symbol=symbol,
            original_rows=before_len,
            remaining_rows=0,
        )

    return df


def get_stock_history(
    symbol: str,
    days: int = 500,
    retry: int = 3,
    timeout: int = 30,
    enable_quality_check: bool = True,
) -> pd.DataFrame:
    """
    获取股票历史数据（带重试机制）

    Args:
        symbol: 股票代码（如 "600519"）
        days: 获取天数（默认500天）
        retry: 重试次数（默认3次）
        timeout: 超时时间（秒，默认30秒）
        enable_quality_check: 是否启用数据质量检查（默认True）

    Returns:
        DataFrame with columns: date, open, high, low, close, volume, amount, turnover_rate

    Raises:
        InvalidSymbolError: 股票代码格式不正确
        InvalidParameterError: 参数值不在有效范围内
        DataFetchError: 数据获取失败（重试后仍失败）
        InsufficientDataError: 数据量不足
        DataValidationError: 数据验证失败
        DataQualityError: 数据质量问题
    """
    # 输入验证
    symbol = validate_symbol(symbol)
    days = validate_days(days, min_days=1, max_days=MAX_HISTORY_DAYS)

    logger.info("Fetching stock history", extra={"symbol": symbol, "days": days, "retry": retry})

    last_error = None

    # 重试机制（指数退避）
    for attempt in range(retry):
        try:
            # 根据代码位数自动路由：1-5位=港股，6位=A股
            if len(symbol) <= 5:
                result = akshare_bridge.get_hk_stock_history(symbol)
            else:
                result = akshare_bridge.get_stock_history(symbol, count=min(days, MAX_HISTORY_DAYS))

            # 检查 API 错误
            if "error" in result:
                error_msg = result["error"]
                raise DataFetchError(
                    "API returned error",
                    symbol=symbol,
                    days=days,
                    api_error=error_msg,
                    attempt=attempt + 1,
                )

            # 检查返回数据
            records = result.get("data", [])
            if not records:
                raise DataFetchError(
                    "API returned empty data", symbol=symbol, days=days, attempt=attempt + 1
                )

            # 转换为 DataFrame
            df = pd.DataFrame(records)

            # 添加缺失的列
            if "amount" not in df.columns:
                df["amount"] = df["close"] * df["volume"]

            if "turnover_rate" not in df.columns:
                df["turnover_rate"] = 1.0

            # 确保日期列为 datetime 类型
            df["date"] = pd.to_datetime(df["date"])

            # 按日期排序
            df = df.sort_values("date").reset_index(drop=True)

            # 验证数据质量
            df = _validate_and_clean_dataframe(df, symbol)

            # 检查数据量是否足够（至少需要60天用于MA60计算）
            min_required_rows = 60
            if len(df) < min_required_rows:
                raise InsufficientDataError(
                    "Not enough data for technical indicators",
                    symbol=symbol,
                    required=min_required_rows,
                    actual=len(df),
                    indicator="MA60",
                )

            # 数据质量检查（可选）
            if enable_quality_check:
                logger.info("Running data quality check", extra={"symbol": symbol})
                quality_report = check_data_quality(df, symbol=symbol)

                if not quality_report.is_passed:
                    logger.warning(
                        "Data quality check failed",
                        extra={
                            "symbol": symbol,
                            "error_count": sum(
                                1 for i in quality_report.issues if i.severity == "error"
                            ),
                            "warning_count": sum(
                                1 for i in quality_report.issues if i.severity == "warning"
                            ),
                        },
                    )
                    # 记录质量问题但不阻止返回（除非有严重错误）
                    error_issues = [i for i in quality_report.issues if i.severity == "error"]
                    if error_issues:
                        error_messages = [i.message for i in error_issues]
                        raise DataQualityError(
                            "Data quality check failed with errors",
                            symbol=symbol,
                            error_count=len(error_issues),
                            errors=error_messages,
                        )
                else:
                    logger.info("Data quality check passed", extra={"symbol": symbol})

            logger.info(
                "Successfully fetched stock history",
                extra={"symbol": symbol, "rows": len(df), "attempt": attempt + 1},
            )
            return df

        except (DataFetchError, InsufficientDataError, DataValidationError, DataQualityError):
            # 这些是业务异常，直接抛出，不重试
            raise

        except (ConnectionError, TimeoutError, OSError) as e:
            # 网络相关错误，可以重试
            last_error = e
            if attempt < retry - 1:
                wait_time = 2**attempt  # 指数退避: 1s, 2s, 4s
                logger.warning(
                    "Network error, retrying",
                    extra={
                        "symbol": symbol,
                        "attempt": attempt + 1,
                        "retry_in": wait_time,
                        "error": str(e),
                    },
                )
                time.sleep(wait_time)
            else:
                # 最后一次重试失败
                raise DataFetchError(
                    "Failed to fetch data after retries",
                    symbol=symbol,
                    days=days,
                    retry_count=retry,
                    last_error=str(e),
                ) from e

        except Exception as e:
            # 未预期的错误
            logger.error(
                "Unexpected error while fetching data",
                extra={"symbol": symbol, "error": str(e), "type": type(e).__name__},
            )
            raise DataFetchError(
                "Unexpected error during data fetch",
                symbol=symbol,
                days=days,
                error=str(e),
                error_type=type(e).__name__,
            ) from e

    # 理论上不会到这里，但为了安全
    if last_error:
        raise DataFetchError(
            "Failed to fetch data after all retries",
            symbol=symbol,
            days=days,
            retry_count=retry,
            last_error=str(last_error),
        ) from last_error


def get_all_symbols(limit: int = 100) -> list:
    """
    获取所有股票代码列表

    Args:
        limit: 返回数量限制

    Returns:
        股票代码列表
    """
    # 返回一些常见股票代码用于训练
    default_symbols = [
        "600519",
        "000858",
        "600036",
        "601318",
        "000001",
        "600030",
        "601166",
        "600887",
        "000002",
        "600276",
        "601398",
        "601288",
        "600016",
        "601328",
        "600000",
        "601988",
        "601668",
        "600028",
        "601601",
        "600048",
    ]

    return default_symbols[:limit]
